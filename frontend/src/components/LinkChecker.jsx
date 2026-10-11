import { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_CHAT_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://promptshield-api.onrender.com");

function LinkChecker() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkLink = async (event) => {
    event.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/links/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        },
      );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The link checker returned an unreadable response.");
      }
      if (!response.ok) {
        throw new Error(data.detail || "Could not check this link.");
      }
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? `Cannot reach the link checker at ${API_BASE_URL}. Check that the backend is running.`
          : requestError.message || "Could not check this link.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="link-checker">
      <header className="link-checker-header">
        <h2>Check a link before opening it</h2>
        <p>
          Paste a link to see URL-level warning signs. PromptShield never opens
          the link automatically.
        </p>
      </header>

      <form className="panel link-checker-form" onSubmit={checkLink}>
        <label className="field-label" htmlFor="link-checker-url">
          LINK TO CHECK
        </label>
        <input
          id="link-checker-url"
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          maxLength={2048}
          autoComplete="url"
          placeholder="https://example.com"
          disabled={loading}
        />
        <button className="primary-button" type="submit" disabled={loading || !url.trim()}>
          {loading ? "Checking..." : "Check link"}
        </button>
        <p className="link-checker-disclaimer">
          This checks the URL structure and common lure patterns only. It does
          not visit the website or verify page contents, reputation, redirects,
          or downloads. “Allowed” is not a guarantee that a site is safe.
        </p>
        {error && <p className="pdf-error" role="alert">{error}</p>}
      </form>

      {result && (
        <section
          className={`link-checker-result ${result.allowed ? "link-allowed" : "link-blocked"}`}
          aria-live="polite"
        >
          <div className="link-checker-verdict">
            <span className="link-verdict-badge">
              {result.allowed ? "ALLOWED" : "BLOCKED"}
            </span>
            <div>
              <h3>{result.allowed ? "No common URL warning signs found" : "Do not open this link"}</h3>
              <p>{result.summary}</p>
            </div>
          </div>
          <div className="link-checker-detail">
            <span className="label">HOST</span>
            <code>{result.host || "Could not identify a valid host"}</code>
          </div>
          <ul className="link-checker-reasons">
            {result.reasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
          {result.allowed && result.normalized_url && (
            <a
              className="primary-button link-open-button"
              href={result.normalized_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open checked link ↗
            </a>
          )}
        </section>
      )}
    </section>
  );
}

export default LinkChecker;
