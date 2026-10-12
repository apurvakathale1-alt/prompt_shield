import ipaddress
import re
from urllib.parse import unquote, urlsplit, urlunsplit


URL_PATTERN = re.compile(
    r"(?i)(?<![@\w])(?:[a-z][a-z0-9+.-]*://|www\.)[^\s<>()]+|"
    r"(?<![@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>()]*)?"
)
URL_SHORTENER_HOSTS = {
    "bit.ly",
    "cutt.ly",
    "goo.gl",
    "is.gd",
    "rb.gy",
    "t.co",
    "tinyurl.com",
}
GIFT_LURE_TERMS = {
    "birthday",
    "claim",
    "congratulations",
    "free",
    "gift",
    "offer",
    "prize",
    "reward",
    "winner",
}


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


def inspect_url(value: str) -> dict:
    original_url = value.strip().rstrip(".,!?;:)]}")
    reasons = []
    candidate = original_url

    if not candidate:
        reasons.append("Enter a web address to check.")
    elif re.search(r"[\x00-\x20\x7f]", candidate):
        reasons.append("The URL contains whitespace or control characters.")
    elif candidate.lower().startswith(("hxxp://", "hxxps://")):
        reasons.append("The URL uses an obfuscated web scheme.")
    else:
        if candidate.lower().startswith("www."):
            candidate = f"https://{candidate}"
        elif "://" not in candidate:
            candidate = f"https://{candidate}"

    normalized_url = ""
    host = ""
    if candidate and not reasons:
        try:
            parsed = urlsplit(candidate)
            host = (parsed.hostname or "").rstrip(".").lower()
            port = parsed.port
        except ValueError:
            parsed = None
            reasons.append("The URL format is invalid.")

        if parsed:
            if parsed.scheme.lower() != "https":
                reasons.append("Only secure HTTPS web links are allowed.")
            if not host:
                reasons.append("The URL does not contain a valid website host.")
            if parsed.username is not None or parsed.password is not None:
                reasons.append("The URL contains hidden username or password information.")
            if port is not None and port not in {80, 443}:
                reasons.append("The URL uses a non-standard network port.")

            try:
                ipaddress.ip_address(host.strip("[]"))
                reasons.append("Direct IP-address links are blocked.")
            except ValueError:
                if re.fullmatch(
                    r"(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+)){0,3}",
                    host,
                ):
                    reasons.append("Numeric IP-like host names are blocked.")

            if (
                host == "localhost"
                or host.endswith(
                    (".localhost", ".local", ".internal", ".test", ".invalid", ".onion")
                )
            ):
                reasons.append("Local or non-public network addresses are blocked.")
            if "xn--" in host or any(ord(character) > 127 for character in host):
                reasons.append("Internationalized host names can hide look-alike domains.")
            if host in URL_SHORTENER_HOSTS:
                reasons.append("This URL shortener hides the final destination.")

            labels = host.split(".")
            if (
                len(host) > 253
                or len(labels) < 2
                or any(
                    not label
                    or len(label) > 63
                    or not re.fullmatch(r"[a-z0-9-]+", label)
                    or label.startswith("-")
                    or label.endswith("-")
                    for label in labels
                )
            ):
                reasons.append("The website host name is malformed.")

            decoded_destination = candidate
            for _ in range(2):
                decoded_destination = unquote(decoded_destination)
            lure_terms = {
                term
                for term in GIFT_LURE_TERMS
                if re.search(rf"\b{re.escape(term)}\b", decoded_destination, re.IGNORECASE)
            }
            if len(lure_terms) >= 2:
                reasons.append(
                    "The URL combines free-offer, prize, gift, or claim language commonly used in lures."
                )
            if re.search(
                r"\b(?:verify|login|sign[\s-]?in|password|account)\b",
                decoded_destination,
                re.IGNORECASE,
            ) and re.search(
                r"\b(?:urgent|suspend|expire|unlock|confirm)\b",
                decoded_destination,
                re.IGNORECASE,
            ):
                reasons.append(
                    "The URL combines account-verification and urgency language."
                )

            if host and not reasons:
                normalized_url = urlunsplit(
                    (
                        parsed.scheme.lower(),
                        parsed.netloc,
                        parsed.path or "/",
                        parsed.query,
                        parsed.fragment,
                    )
                )

    allowed = not reasons
    summary = (
        f"This link points to {host}. Its page was not opened or independently verified."
        if allowed
        else "This link has URL-level warning signs and should not be opened."
    )
    if allowed:
        reasons = ["No common URL-level warning signs were detected; this is not a guarantee of safety."]

    return {
        "allowed": allowed,
        "original_url": original_url,
        "normalized_url": normalized_url,
        "host": host,
        "summary": summary,
        "reasons": reasons,
    }


def inspect_text_links(text: str) -> list[dict]:
    links = []
    seen = set()
    for match in URL_PATTERN.finditer(text):
        raw_url = match.group(0).rstrip(".,!?;:)]}")
        normalized_key = raw_url.lower()
        if normalized_key in seen:
            continue
        seen.add(normalized_key)
        links.append(inspect_url(raw_url))
    return links


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
