const URL_SHORTENER_HOSTS = new Set([
  "bit.ly",
  "cutt.ly",
  "goo.gl",
  "is.gd",
  "rb.gy",
  "t.co",
  "tinyurl.com",
]);

const GIFT_LURE_TERMS = [
  "birthday",
  "claim",
  "congratulations",
  "free",
  "gift",
  "prize",
  "reward",
  "winner",
];

export function inspectUrl(value) {
  const originalUrl = value.trim().replace(/[.,!?;:)\]}]+$/, "");
  const reasons = [];
  let candidate = originalUrl;

  if (!candidate) {
    reasons.push("Enter a web address to check.");
  } else if (
    Array.from(candidate).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x20 || code === 0x7f;
    })
  ) {
    reasons.push("The URL contains whitespace or control characters.");
  } else if (/^hxxps?:\/\//i.test(candidate)) {
    reasons.push("The URL uses an obfuscated web scheme.");
  } else if (/^www\./i.test(candidate) || !candidate.includes("://")) {
    candidate = `https://${candidate}`;
  }

  let parsed = null;
  let host = "";
  if (candidate && reasons.length === 0) {
    try {
      parsed = new URL(candidate);
      host = parsed.hostname.replace(/\.$/, "").toLowerCase();
    } catch {
      reasons.push("The URL format is invalid.");
    }

    if (parsed) {
      if (parsed.protocol.toLowerCase() !== "https:") {
        reasons.push("Only secure HTTPS web links are allowed.");
      }
      if (!host) {
        reasons.push("The URL does not contain a valid website host.");
      }
      if (parsed.username || parsed.password) {
        reasons.push("The URL contains hidden username or password information.");
      }
      if (parsed.port && !["80", "443"].includes(parsed.port)) {
        reasons.push("The URL uses a non-standard network port.");
      }

      const ipHost = host.replace(/^\[|\]$/g, "");
      if (ipHost.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ipHost)) {
        reasons.push("Direct IP-address links are blocked.");
      } else if (/^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+)){0,3}$/i.test(host)) {
        reasons.push("Numeric IP-like host names are blocked.");
      }

      if (
        host === "localhost" ||
        /\.(?:localhost|local|internal|test|invalid|onion)$/.test(host)
      ) {
        reasons.push("Local or non-public network addresses are blocked.");
      }
      if (
        host.includes("xn--") ||
        Array.from(host).some((character) => character.charCodeAt(0) > 0x7f)
      ) {
        reasons.push("Internationalized host names can hide look-alike domains.");
      }
      if (URL_SHORTENER_HOSTS.has(host)) {
        reasons.push("This URL shortener hides the final destination.");
      }

      const labels = host.split(".");
      if (
        host.length > 253 ||
        labels.length < 2 ||
        labels.some(
          (label) =>
            !label ||
            label.length > 63 ||
            !/^[a-z0-9-]+$/.test(label) ||
            label.startsWith("-") ||
            label.endsWith("-"),
        )
      ) {
        reasons.push("The website host name is malformed.");
      }

      let decodedDestination = candidate;
      try {
        decodedDestination = decodeURIComponent(
          decodeURIComponent(decodedDestination),
        );
      } catch {
        // Keep the original URL when its percent-encoding is malformed.
      }
      const lureTerms = GIFT_LURE_TERMS.filter((term) =>
        new RegExp(`\\b${term}\\b`, "i").test(decodedDestination),
      );
      if (new Set(lureTerms).size >= 2) {
        reasons.push(
          "The URL combines prize, gift, or claim language commonly used in lures.",
        );
      }
      if (
        /\b(?:verify|login|sign[\s-]?in|password|account)\b/i.test(
          decodedDestination,
        ) &&
        /\b(?:urgent|suspend|expire|unlock|confirm)\b/i.test(
          decodedDestination,
        )
      ) {
        reasons.push(
          "The URL combines account-verification and urgency language.",
        );
      }
    }
  }

  const allowed = reasons.length === 0;
  const normalizedUrl =
    allowed && parsed
      ? `${parsed.protocol.toLowerCase()}//${parsed.host}${parsed.pathname || "/"}${parsed.search}${parsed.hash}`
      : "";
  const summary = allowed
    ? `This link points to ${host}. Its page was not opened or independently verified.`
    : "This link has URL-level warning signs and should not be opened.";

  if (allowed) {
    reasons.push(
      "No common URL-level warning signs were detected; this is not a guarantee of safety.",
    );
  }

  return {
    allowed,
    original_url: originalUrl,
    normalized_url: normalizedUrl,
    host,
    summary,
    reasons,
  };
}
