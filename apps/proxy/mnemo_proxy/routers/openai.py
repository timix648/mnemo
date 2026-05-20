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
from mnemo_proxy.upstream_keys import get_upstream_key

router = APIRouter(prefix="/u/{user_id}/v1", tags=["openai"])
log = logging.getLogger("mnemo.proxy.openai")


@router.post("/chat/completions")
async def chat_completions(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
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

    upstream_url = f"{settings.openai_base_url}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {upstream_key}",
        "Content-Type": "application/json",
    }

    streaming = bool(body.get("stream", False))
    if streaming:
        return StreamingResponse(
            _stream(upstream_url, raw_body, headers, user, body),
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
                "sui_address": user.sui_address,
                "provider": "openai",
                "request_body": body,
                "response_body": resp_json,
            })

        return JSONResponse(content=resp_json, status_code=resp.status_code)


async def _stream(upstream_url, raw_body, headers, user, request_body):
    """Forward an SSE-streamed OpenAI response, accumulating for capture."""
    parts: list[str] = []
    accum_model: Optional[str] = None
    role: Optional[str] = None

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
                try:
                    delta = chunk["choices"][0].get("delta", {})
                except (IndexError, KeyError):
                    continue
                if "role" in delta:
                    role = delta["role"]
                if "content" in delta and delta["content"]:
                    parts.append(delta["content"])

    if settings.capture_enabled and parts and user.default_namespace_id:
        reconstructed = {
            "model": accum_model,
            "choices": [{
                "message": {"role": role or "assistant", "content": "".join(parts)},
                "finish_reason": "stop",
            }],
        }
        try:
            await enqueue_capture({
                "user_id": str(user.id),
                "namespace_id": str(user.default_namespace_id),
                "sui_address": user.sui_address,
                "provider": "openai",
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
