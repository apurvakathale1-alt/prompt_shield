const OUTCOMES = [
  { key: "BLOCK", label: "Blocked", color: "#ef4444" },
  { key: "ALLOW", label: "Allowed", color: "#10b981" },
  { key: "SANITIZE", label: "Sanitized", color: "#f59e0b" },
];

function downloadCsv(events) {
  const columns = ["timestamp", "outcome", "rule", "category", "source", "reason", "prompt"];
  const escapeCsv = (value) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = events.map((event) =>
    columns
      .map((column) =>
        escapeCsv(column === "timestamp" ? event.timestamp : event[column])
      )
      .join(",")
  );
  const csv = [columns.join(","), ...rows].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "promptshield-security-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Reports({ events }) {
  const total = events.length;
  const outcomeCounts = Object.fromEntries(
    OUTCOMES.map(({ key }) => [
      key,
      events.filter((event) => event.outcome === key).length,
    ])
  );
  const ruleCounts = events.reduce((counts, event) => {
    counts[event.category] = (counts[event.category] || 0) + 1;
    return counts;
  }, {});
  const categories = Object.entries(ruleCounts).sort(
    ([first], [second]) => first.localeCompare(second)
  );

  return (
    <section className="reports-page">
      <header className="feature-page-heading">
        <div className="feature-page-icon" aria-hidden="true">
          ▥
        </div>
        <div>
          <h2>Security Reports</h2>
          <p>Analyze the real prompt checks recorded in this browser session.</p>
        </div>
      </header>

      <section className="report-summary-grid">
        <article className="report-stat-card">
          <span>Total analyzed</span>
          <strong>{total}</strong>
          <small>Checks in this session</small>
        </article>
        {OUTCOMES.map(({ key, label, color }) => (
          <article className="report-stat-card" key={key}>
            <span>{label}</span>
            <strong style={{ color }}>{outcomeCounts[key]}</strong>
            <small>
              {total
                ? `${Math.round((outcomeCounts[key] / total) * 100)}% of checks`
                : "No checks recorded"}
            </small>
          </article>
        ))}
      </section>

      <section className="panel report-panel">
        <div className="panel-heading">
          <div>
            <h3>Attack types and rule categories</h3>
            <p>Categories come from the rule that actually matched.</p>
          </div>
          <span className="pill">SESSION DATA</span>
        </div>
        {categories.length ? (
          <div className="report-categories">
            {categories.map(([category, count]) => (
              <div className="report-category-row" key={category}>
                <div className="report-category-label">
                  <span>{category}</span>
                  <strong>
                    {count} ({Math.round((count / total) * 100)}%)
                  </strong>
                </div>
                <div
                  className="report-bar-track"
                  role="img"
                  aria-label={`${category}: ${count} of ${total} events`}
                >
                  <span style={{ width: `${(count / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="replay-empty report-empty">
            <h3>No report data yet</h3>
            <p>Run checks in Testing Lab to build your security report.</p>
          </div>
        )}
      </section>

      <section className="panel report-export-panel">
        <div>
          <h3>Export this report</h3>
          <p>
            CSV contains full prompt text. PDF opens your browser&apos;s print
            dialog, where you can choose “Save as PDF”.
          </p>
        </div>
        <div className="report-export-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!total}
            onClick={() => downloadCsv(events)}
          >
            ↓ Export CSV
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!total}
            onClick={() => window.print()}
          >
            ↓ Save report as PDF
          </button>
        </div>
      </section>
      <p className="feature-note">
        Reports use in-memory browser-session events only. Refreshing the page
        clears this history; no server-wide or cross-user analytics are shown.
      </p>
    </section>
  );
}

export default Reports;
