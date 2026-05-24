"""OpenAI-compatible proxy routes: /v1/chat/completions, /v1/embeddings."""
import json
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from mnemo_proxy.auth import authenticate
from mnemo_proxy.config import settings
from mnemo_proxy.queue import enqueue_capture
from mnemo_proxy.source_app import classify_source_app
from mnemo_proxy.upstream_keys import get_upstream_key

router = APIRouter(prefix="/u/{user_id}/v1", tags=["openai"])
log = logging.getLogger("mnemo.proxy.openai")


@router.post("/chat/completions")
async def chat_completions(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None),
):
    user = await authenticate(user_id, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="invalid session token")

    upstream_key = await get_upstream_key(user, "openai")
    if not upstream_key:
        raise HTTPException(status_code=400, detail="no openai key configured for this user")

    raw_body = await request.body()
    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid json body")

    source_app, source_app_raw = classify_source_app(user_agent)

    upstream_url = f"{settings.openai_base_url}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {upstream_key}",
        "Content-Type": "application/json",
    }

    streaming = bool(body.get("stream", False))
    if streaming:
        # Ask OpenAI to include usage in the final stream chunk so our capture
        # can record real token counts. Merge with any caller-supplied options.
        upstream_body = dict(body)
        existing_opts = upstream_body.get("stream_options") or {}
        if not isinstance(existing_opts, dict):
            existing_opts = {}
        existing_opts.setdefault("include_usage", True)
        upstream_body["stream_options"] = existing_opts
        upstream_raw = json.dumps(upstream_body).encode()
        return StreamingResponse(
            _stream(upstream_url, upstream_raw, headers, user, body, source_app, source_app_raw),
            media_type="text/event-stream",
        )

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(upstream_url, content=raw_body, headers=headers)
        try:
            resp_json = resp.json()
        except json.JSONDecodeError:
            resp_json = {"raw": resp.text}

        if resp.status_code == 200 and settings.capture_enabled and user.default_namespace_id:
            await enqueue_capture({
                "user_id": str(user.id),
                "namespace_id": str(user.default_namespace_id),
                "namespace_label": user.default_namespace_label or "default",
                "sui_address": user.sui_address,
                "provider": "openai",
                "source_app": source_app,
                "source_app_raw": source_app_raw,
                "request_body": body,
                "response_body": resp_json,
            })

        return JSONResponse(content=resp_json, status_code=resp.status_code)


async def _stream(upstream_url, raw_body, headers, user, request_body, source_app, source_app_raw):
    """Forward an SSE-streamed OpenAI response, accumulating for capture.

    Captures the final ``usage`` block emitted when ``stream_options.include_usage``
    is set, so token counts make it into the entries row.
    """
    parts: list[str] = []
    accum_model: Optional[str] = None
    role: Optional[str] = None
    usage: Optional[dict] = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", upstream_url, content=raw_body, headers=headers) as resp:
            if resp.status_code != 200:
                err = await resp.aread()
                yield err
                return

            async for line in resp.aiter_lines():
                yield (line + "\n").encode()
                if not line.startswith("data: "):
                    continue
                data = line[len("data: "):]
                if data == "[DONE]":
                    continue
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if "model" in chunk:
                    accum_model = chunk["model"]
                # The final usage chunk has an empty `choices` array but a populated
                # `usage` object. We capture both shapes here.
                if isinstance(chunk.get("usage"), dict):
                    usage = chunk["usage"]
                try:
                    delta = chunk["choices"][0].get("delta", {})
                except (IndexError, KeyError):
                    continue
                if "role" in delta:
                    role = delta["role"]
                if "content" in delta and delta["content"]:
                    parts.append(delta["content"])

    if settings.capture_enabled and parts and user.default_namespace_id:
        reconstructed: dict = {
            "model": accum_model,
            "choices": [{
                "message": {"role": role or "assistant", "content": "".join(parts)},
                "finish_reason": "stop",
            }],
        }
        if usage:
            reconstructed["usage"] = usage
        try:
            await enqueue_capture({
                "user_id": str(user.id),
                "namespace_id": str(user.default_namespace_id),
                "namespace_label": user.default_namespace_label or "default",
                "sui_address": user.sui_address,
                "provider": "openai",
                "source_app": source_app,
                "source_app_raw": source_app_raw,
                "request_body": request_body,
                "response_body": reconstructed,
            })
        except Exception as exc:
            log.warning("failed to enqueue streamed capture: %s", exc)


@router.post("/embeddings")
async def embeddings(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Pass-through for /v1/embeddings. We don't capture embedding calls."""
    user = await authenticate(user_id, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="invalid session token")
    upstream_key = await get_upstream_key(user, "openai")
    if not upstream_key:
        raise HTTPException(status_code=400, detail="no openai key configured")

    raw_body = await request.body()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.openai_base_url}/v1/embeddings",
            content=raw_body,
            headers={
                "Authorization": f"Bearer {upstream_key}",
                "Content-Type": "application/json",
            },
        )
        return JSONResponse(content=resp.json(), status_code=resp.status_code)
