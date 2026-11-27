"""Deterministic detection of hidden instructions and secret redaction (Phase 96)."""

from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urlparse

ZERO_WIDTH = ("\u200b", "\u200c", "\u200d", "\u2060", "\ufeff", "\u180e")

HIDDEN_INSTRUCTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)", re.I),
    re.compile(r"disregard\s+(the\s+)?(system|developer)\s+prompt", re.I),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+\w+", re.I),
    re.compile(r"system\s*:\s*", re.I),
    re.compile(r"<\s*/?\s*(?:system|assistant|user)\s*>", re.I),
    re.compile(r"exfiltrat", re.I),
    re.compile(r"send\\b[^\\n]{0,60}(?:secret|token|password|data)[^\\n]{0,60}\\bto\\b", re.I),
    re.compile(r"ignora\s+(le\s+)?istruzioni\s+precedenti", re.I),
    re.compile(r"sei\s+ora\s+un", re.I),
    re.compile(r"invia\\b[^\\n]{0,60}(?:segreto|token|password|dati)[^\\n]{0,60}\\ba\\b", re.I),
]

HIDDEN_MARKUP_PATTERNS = [
    re.compile(r"display\s*:\s*none", re.I),
    re.compile(r"visibility\s*:\s*hidden", re.I),
    re.compile(r"font-size\s*:\s*0", re.I),
    re.compile(r"opacity\s*:\s*0", re.I),
    re.compile(r"<!--.*?-->", re.S),
]

EXFIL_URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.I)

SECRET_PATTERNS = [
    (re.compile(r"sk-[A-Za-z0-9]{20,}"), "[REDACTED:openai-key]"),
    (re.compile(r"ghp_[A-Za-z0-9]{30,}"), "[REDACTED:github-token]"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED:aws-key]"),
    (re.compile(r"Bearer\s+[A-Za-z0-9._\-]{20,}", re.I), "[REDACTED:bearer]"),
    (re.compile(r"(?:password|passwd|pwd)\s*[:=]\s*\S+", re.I), "[REDACTED:password]"),
    (re.compile(r"(?:api[_-]?key|secret|token)\s*[:=]\s*\S+", re.I), "[REDACTED:secret]"),
]


def detect_hidden_instructions(text: str) -> dict:
    reasons: list[str] = []
    if any(ch in text for ch in ZERO_WIDTH):
        reasons.append("zero-width characters")
    for pattern in HIDDEN_INSTRUCTION_PATTERNS:
        if pattern.search(text):
            reasons.append(f"hidden instruction: {pattern.pattern}")
            break
    for pattern in HIDDEN_MARKUP_PATTERNS:
        if pattern.search(text):
            reasons.append(f"hidden markup: {pattern.pattern}")
            break
    for url in EXFIL_URL_PATTERN.findall(text):
        lowered = url.lower()
        if any(marker in lowered for marker in ("169.254.169.254", "localhost", "127.0.0.1", "0.0.0.0")):
            reasons.append("suspicious exfiltration URL")
            break
    return {"risky": bool(reasons), "reasons": reasons}


def redact_secrets(text: str) -> str:
    result = text
    for pattern, replacement in SECRET_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def wrap_untrusted(content: str) -> str:
    return f"<untrusted-content>\n{content}\n</untrusted-content>"


def _is_private_host(hostname: str) -> bool:
    if hostname.lower() in {"localhost", "0.0.0.0"}:
        return True
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return True
    return False


def validate_url(url: str) -> tuple[bool, str]:
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False, "invalid URL"
    if parsed.scheme not in {"http", "https"}:
        return False, "only http/https allowed"
    if not parsed.hostname:
        return False, "missing host"
    if _is_private_host(parsed.hostname):
        return False, "host is not allowed (private/loopback/link-local)"
    if parsed.hostname.lower() == "169.254.169.254":
        return False, "metadata endpoint blocked"
    return True, "ok"
