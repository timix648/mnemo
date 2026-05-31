"""Anthropic-compatible proxy: /v1/messages.

Anthropic uses a different auth header ("x-api-key", not Bearer) and a different
streaming format (event: + data: pairs). We handle both.
"""
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

router = APIRouter(prefix="/u/{user_id}/anthropic/v1", tags=["anthropic"])
log = logging.getLogger("mnemo.proxy.anthropic")

ANTHROPIC_VERSION = "2023-06-01"


# Chat clients (Chatbox, etc.) make automatic side-calls to auto-title or
# summarize a conversation. These are not real user conversations — they're the
# model talking about the chat — so we forward them upstream (the client needs
# its title) but skip capturing them as memories. Anthropic carries the system
# prompt in a top-level `system` field (string OR list of blocks), so we check
# that in addition to the messages.
_TITLE_CALL_MARKERS = (
    "give this conversation a name",
    "name this conversation",
    "the name is:",
    "10 words max",
    "generate a title",
    "summarize this conversation in",
    "short title",
)


def _is_meta_call(body: dict) -> bool:
    """True if the request looks like an auto-title/summary side-call rather
    than a real conversation worth capturing. Forwarded upstream regardless;
    this only governs whether we store it as a memory."""
    if not isinstance(body, dict):
        return False
    blob_parts: list[str] = []

    # Anthropic system prompt: string or list of {type, text} blocks.
    system = body.get("system")
    if isinstance(system, str):
        blob_parts.append(system)
    elif isinstance(system, list):
        for block in system:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                blob_parts.append(block["text"])

    # Messages: content is a string or a list of blocks.
    for m in body.get("messages") or []:
        if not isinstance(m, dict):
            continue
        content = m.get("content")
        if isinstance(content, str):
            blob_parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and isinstance(block.get("text"), str):
                    blob_parts.append(block["text"])

    blob = " ".join(blob_parts).lower()
    if not blob:
        return False
    return any(marker in blob for marker in _TITLE_CALL_MARKERS)


@router.post("/messages")
async def messages(
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None),
):
    user = await authenticate(user_id, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="invalid session token")

    upstream_key = await get_upstream_key(user, "anthropic")
    if not upstream_key:
        raise HTTPException(status_code=400, detail="no anthropic key configured for this user")

    raw_body = await request.body()
    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid json body")

    source_app, source_app_raw = classify_source_app(user_agent)

    upstream_url = f"{settings.anthropic_base_url}/v1/messages"
    headers = {
        "x-api-key": upstream_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }

    streaming = bool(body.get("stream", False))
    if streaming:
        return StreamingResponse(
            _stream(upstream_url, raw_body, headers, user, body, source_app, source_app_raw),
            media_type="text/event-stream",
        )

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(upstream_url, content=raw_body, headers=headers)
        try:
            resp_json = resp.json()
        except json.JSONDecodeError:
            resp_json = {"raw": resp.text}

        if (
            resp.status_code == 200
            and settings.capture_enabled
            and user.default_namespace_id
            and not _is_meta_call(body)
        ):
            await enqueue_capture({
                "user_id": str(user.id),
                "namespace_id": str(user.default_namespace_id),
                "namespace_label": user.default_namespace_label or "default",
                "sui_address": user.sui_address,
                "provider": "anthropic",
                "source_app": source_app,
                "source_app_raw": source_app_raw,
                "request_body": body,
                "response_body": resp_json,
            })

        return JSONResponse(content=resp_json, status_code=resp.status_code)


async def _stream(upstream_url, raw_body, headers, user, request_body, source_app, source_app_raw):
    """Anthropic streams as `event: <name>\ndata: <json>\n\n` pairs."""
    text_parts: list[str] = []
    model: Optional[str] = None
    usage: dict = {}

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", upstream_url, content=raw_body, headers=headers) as resp:
            if resp.status_code != 200:
                yield await resp.aread()
                return

            async for line in resp.aiter_lines():
                yield (line + "\n").encode()
                if not line.startswith("data: "):
                    continue
                try:
                    payload = json.loads(line[len("data: "):])
                except json.JSONDecodeError:
                    continue
                event_type = payload.get("type")
                if event_type == "content_block_delta":
                    delta = payload.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text_parts.append(delta.get("text", ""))
                elif event_type == "message_start":
                    msg = payload.get("message", {})
                    model = msg.get("model")
                    usage = msg.get("usage", {})
                elif event_type == "message_delta":
                    usage.update(payload.get("usage", {}))

    if (
        settings.capture_enabled
        and text_parts
        and user.default_namespace_id
        and not _is_meta_call(request_body)
    ):
        reconstructed = {
            "model": model,
            "content": [{"type": "text", "text": "".join(text_parts)}],
            "usage": usage,
        }
        try:
            await enqueue_capture({
                "user_id": str(user.id),
                "namespace_id": str(user.default_namespace_id),
                "namespace_label": user.default_namespace_label or "default",
                "sui_address": user.sui_address,
                "provider": "anthropic",
                "source_app": source_app,
                "source_app_raw": source_app_raw,
                "request_body": request_body,
                "response_body": reconstructed,
            })
        except Exception as exc:
            log.warning("failed to enqueue streamed capture: %s", exc)