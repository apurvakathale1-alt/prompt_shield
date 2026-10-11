import re


INJECTION_RULES = (
    (
        re.compile(
            r"ignore\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions?|rules)",
            re.IGNORECASE,
        ),
        "Instruction Override",
    ),
    (
        re.compile(r"system\s+override[^.!?\n]*", re.IGNORECASE),
        "System Override",
    ),
    (
        re.compile(r"reveal\s+(?:the\s+)?system\s+prompt[^.!?\n]*", re.IGNORECASE),
        "Prompt Reveal",
    ),
    (re.compile(r"print\s+secret\s+keys?", re.IGNORECASE), "Data Leak"),
    (re.compile(r"NOTE\s+TO\s+AGENT[^.!?\n]*", re.IGNORECASE), "Indirect Injection"),
    (
        re.compile(r"(?:execute|run)\s+command[^.!?\n]*", re.IGNORECASE),
        "Command Injection",
    ),
    (
        re.compile(r"(?:curl|wget)\s+https?://\S+", re.IGNORECASE),
        "Malicious Command",
    ),
    (
        re.compile(
            r"(?:exfiltrate|send)\s+.{0,160}(?:password|secret|api[-_\s]?key|token)",
            re.IGNORECASE,
        ),
        "Data Exfiltration",
    ),
)

PERSONAL_INFO_RULES = (
    (
        re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
        "Email",
        "[EMAIL_REDACTED]",
    ),
    (re.compile(r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)"), "Phone", "[PHONE_REDACTED]"),
    (
        re.compile(r"\b(?:sk|pk|api)[-_][a-zA-Z0-9_-]{16,}\b|\bAIza[a-zA-Z0-9_-]{30,}\b"),
        "API Key",
        "[API_KEY_REDACTED]",
    ),
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "Aadhaar", "[AADHAAR_REDACTED]"),
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), "PAN", "[PAN_REDACTED]"),
)


def analyze_prompt(text: str) -> dict:
    threat_matches = []
    for pattern, threat_type in INJECTION_RULES:
        for match in pattern.finditer(text):
            threat_matches.append(
                (match.start(), match.end(), threat_type, match.group(0))
            )

    threats = []
    last_end = -1
    for start, end, threat_type, value in sorted(
        threat_matches, key=lambda item: (item[0], -(item[1] - item[0]))
    ):
        if start < last_end:
            continue
        threats.append({"type": threat_type, "value": value})
        last_end = end

    clean = text
    removed = []
    for pattern, info_type, replacement in PERSONAL_INFO_RULES:
        matches = list(pattern.finditer(clean))
        for match in matches:
            removed.append({"type": info_type, "value": match.group(0)})
        clean = pattern.sub(replacement, clean)

    return {"clean": clean, "removed": removed, "threats": threats}
