"""Classify the source AI client based on the User-Agent header.

We look at the User-Agent the client sent (Cursor, BoltAI, Continue, etc.)
and map it to a short label. Unknown clients pass through as "other" — we
still record the raw UA in source_app_raw so we can refine the classifier
later without losing data.

Adding a new client is one line: append a (label, regex) tuple to
SOURCE_APP_PATTERNS. Order matters — first match wins.
"""
import re
from typing import Optional

# (label, pattern) — checked in order, first match wins.
# Patterns are case-insensitive substring matches via re.search.
SOURCE_APP_PATTERNS: list[tuple[str, re.Pattern]] = [
    # Editor-integrated assistants
    ("cursor",         re.compile(r"cursor",                       re.IGNORECASE)),
    ("continue",       re.compile(r"\bcontinue\b",                 re.IGNORECASE)),
    ("cline",          re.compile(r"cline|claude[\-_]?dev",        re.IGNORECASE)),
    ("zed",            re.compile(r"\bzed\b",                      re.IGNORECASE)),
    ("windsurf",       re.compile(r"windsurf|codeium",             re.IGNORECASE)),

    # Chat clients
    ("bolt_ai",        re.compile(r"bolt[\-_]?ai|boltai",          re.IGNORECASE)),
    ("chatwise",       re.compile(r"chatwise",                     re.IGNORECASE)),
    ("librechat",      re.compile(r"librechat",                    re.IGNORECASE)),

    # Official desktop / web apps
    ("chatgpt_app",    re.compile(r"chatgpt(?!\-)",                re.IGNORECASE)),
    ("claude_desktop", re.compile(r"claude[\-_\s]?desktop",        re.IGNORECASE)),

    # SDKs (programmatic callers — not editor-bound but worth distinguishing)
    ("openai_sdk",     re.compile(r"openai[\-_/](python|node|js)", re.IGNORECASE)),
    ("anthropic_sdk",  re.compile(r"anthropic[\-_/](python|sdk)",  re.IGNORECASE)),
    ("langchain",      re.compile(r"langchain",                    re.IGNORECASE)),
    ("llamaindex",     re.compile(r"llama[\-_]?index",             re.IGNORECASE)),

    # Generic HTTP clients (last-resort labels — distinguishable from "no UA")
    ("curl",           re.compile(r"^curl/",                       re.IGNORECASE)),
    ("python_httpx",   re.compile(r"python-httpx",                 re.IGNORECASE)),
    ("python_requests", re.compile(r"python-requests",             re.IGNORECASE)),
]


def classify_source_app(user_agent: Optional[str]) -> tuple[str, Optional[str]]:
    """Return (label, raw_ua) for a request's User-Agent.

    - If user_agent is None or empty -> ("unknown", None)
    - If it matches a known pattern  -> (matched_label, original_ua)
    - Otherwise                       -> ("other", original_ua)

    The raw UA is always preserved (when present) so the frontend or future
    classifier passes can do something smarter than the label alone.
    """
    if not user_agent:
        return ("unknown", None)
    ua = user_agent.strip()
    if not ua:
        return ("unknown", None)
    for label, pattern in SOURCE_APP_PATTERNS:
        if pattern.search(ua):
            return (label, ua)
    return ("other", ua)
