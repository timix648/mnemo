"""Normalize OpenAI/Anthropic capture payloads into a shared MemoryPayload."""
from datetime import datetime, timezone
from typing import Any


def _safe_msgs_openai(req: dict[str, Any]) -> list[dict[str, str]]:
    out = []
    for m in req.get("messages", []) or []:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            # Multimodal content; extract text segments.
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        out.append({"role": role, "content": str(content)})
    return out


def _safe_response_text_openai(resp: dict[str, Any]) -> str:
    choices = resp.get("choices") or []
    if not choices:
        return ""
    msg = choices[0].get("message") or {}
    content = msg.get("content", "")
    return str(content or "")


def _safe_msgs_anthropic(req: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    sys = req.get("system")
    if isinstance(sys, str) and sys:
        out.append({"role": "system", "content": sys})
    for m in req.get("messages", []) or []:
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text")
        out.append({"role": role, "content": str(content)})
    return out


def _safe_response_text_anthropic(resp: dict[str, Any]) -> str:
    blocks = resp.get("content") or []
    return "".join(b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text")


def build_payload(provider: str, request_body: dict, response_body: dict) -> dict:
    if provider == "openai":
        prompt = _safe_msgs_openai(request_body)
        response_text = _safe_response_text_openai(response_body)
        usage = response_body.get("usage", {}) or {}
        input_tokens = int(usage.get("prompt_tokens", 0))
        output_tokens = int(usage.get("completion_tokens", 0))
        model = response_body.get("model") or request_body.get("model") or ""
    elif provider == "anthropic":
        prompt = _safe_msgs_anthropic(request_body)
        response_text = _safe_response_text_anthropic(response_body)
        usage = response_body.get("usage", {}) or {}
        input_tokens = int(usage.get("input_tokens", 0))
        output_tokens = int(usage.get("output_tokens", 0))
        model = response_body.get("model") or request_body.get("model") or ""
    else:
        raise ValueError(f"unknown provider: {provider}")

    return {
        "prompt_messages": prompt,
        "response_text": response_text,
        "model": model,
        "ts": datetime.now(timezone.utc).isoformat(),
        "token_counts": {"input": input_tokens, "output": output_tokens},
        "embedding_model": "text-embedding-3-small",
        "provider": provider,
    }


def preview_of(payload: dict, max_len: int = 200) -> str:
    """Build a short plaintext preview for fast search-result rendering."""
    # First user message is usually the most descriptive.
    for m in payload.get("prompt_messages", []):
        if m.get("role") == "user" and m.get("content"):
            text = m["content"].strip().replace("\n", " ")
            return text[:max_len]
    text = (payload.get("response_text") or "").strip().replace("\n", " ")
    return text[:max_len]
