import { useMemo, useState } from "react";

function AttackReplay({ events, onOpenReports }) {
  const [outcome, setOutcome] = useState("ALL");
  const [query, setQuery] = useState("");

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesOutcome = outcome === "ALL" || event.outcome === outcome;
      const searchableText = [
        event.prompt,
        event.reason,
        event.rule,
        event.category,
        event.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesOutcome && searchableText.includes(normalizedQuery);
    });
  }, [events, outcome, query]);

  return (
    <section className="replay-page">
      <header className="feature-page-heading">
        <div className="feature-page-icon" aria-hidden="true">
          ◷
        </div>
        <div>
          <h2>Attack Replay Timeline</h2>
          <p>
            Review prompt decisions, matched rules, and timestamps from this
            session.
          </p>
        </div>
      </header>

      <section className="panel replay-panel">
        <div className="panel-heading">
          <div>
            <h3>Security event timeline</h3>
            <p>
              {events.length} event{events.length === 1 ? "" : "s"} captured in
              this session · newest first
            </p>
          </div>
          <button className="text-button" onClick={onOpenReports}>
            Open reports →
          </button>
        </div>

        <div className="replay-controls">
          <label className="dashboard-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prompt, rule, or category"
              aria-label="Search attack replay events"
            />
          </label>
          <div className="event-filters" aria-label="Filter replay events">
            {["ALL", "BLOCK", "ALLOW", "SANITIZE"].map((filter) => (
              <button
                key={filter}
                className={`event-filter ${outcome === filter ? "active" : ""}`}
                onClick={() => setOutcome(filter)}
              >
                {filter === "SANITIZE" ? "CLEANED" : filter}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length ? (
          <ol className="replay-timeline">
            {filteredEvents.map((event) => (
              <li
                className={`replay-event replay-event-${event.outcome.toLowerCase()}`}
                key={event.id}
              >
                <span className="replay-marker" aria-hidden="true">
                  {event.outcome === "BLOCK"
                    ? "×"
                    : event.outcome === "SANITIZE"
                      ? "✂"
                      : "✓"}
                </span>
                <div className="replay-event-content">
                  <div className="replay-event-meta">
                    <time dateTime={event.timestamp}>{event.time}</time>
                    <span className={`replay-outcome replay-outcome-${event.outcome.toLowerCase()}`}>
                      {event.outcome}
                    </span>
                    {event.rule && <code>{event.rule}</code>}
                    <span className="replay-category">{event.category}</span>
                    <span className="replay-source">{event.source}</span>
                  </div>
                  <p className="replay-prompt">{event.prompt}</p>
                  <p className="replay-reason">{event.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="replay-empty">
            <span aria-hidden="true">◷</span>
            <h3>
              {events.length
                ? "No events match these filters"
                : "No security events yet"}
            </h3>
            <p>
              {events.length
                ? "Try another outcome or search term."
                : "Run a prompt in Testing Lab or use a quick test on the Dashboard. Results will appear here immediately."}
            </p>
          </div>
        )}
      </section>
      <p className="feature-note">
        Replay history is kept in memory for this browser session and clears
        when the page reloads. Prompt contents are not stored permanently.
      </p>
    </section>
  );
}

export default AttackReplay;
