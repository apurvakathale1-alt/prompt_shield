import { useMemo, useState } from "react";

const SAMPLE_AGREEMENT = `By using this app, you agree that we may collect your name, email address, contacts, and precise location. We may share your personal information with third-party advertising partners.

Your subscription automatically renews every month. You must cancel at least 30 days before renewal by contacting support. Fees already paid are non-refundable.

You grant us a perpetual, worldwide, royalty-free license to use, modify, and distribute content you upload. Disputes will be resolved by binding arbitration, and you waive your right to join a class action.

We may change these terms at any time by posting an updated version.`;

const CLAUSE_RULES = [
  {
    id: "data-sharing",
    title: "Personal data collection or sharing",
    severity: "high",
    patterns: [
      /\bcollect(?:s|ed|ing)?\b.{0,100}\b(personal|personal information|personal data|name|email|phone|contacts|location|browsing|usage|device)\b/i,
      /\b(personal information|personal data|your data|user data)\b.{0,100}\b(share|sell|disclose|transfer|provide|third[- ]party|advertis(?:er|ing))\b/i,
      /\b(share|sell|disclose|transfer|provide)\b.{0,100}\b(personal information|personal data|your data|user data|third[- ]party|advertis(?:er|ing))\b/i,
    ],
    impact:
      "The app may gather personal details or pass information to other companies. Check exactly what is collected and whether you can opt out.",
  },
  {
    id: "sensitive-permissions",
    title: "Sensitive device access or tracking",
    severity: "high",
    patterns: [
      /\b(always|precise|continuous|background)\b.{0,50}\b(location|track(?:ing)?)\b/i,
      /\b(access|collect|monitor|track|record)\b.{0,70}\b(contacts|location|microphone|camera|messages|call logs|photos|browsing history)\b/i,
      /\b(location|contacts|microphone|camera|messages|call logs|photos|browsing history)\b.{0,70}\b(access|collect|monitor|track|record|share)\b/i,
    ],
    impact:
      "Accepting may allow access to sensitive device data or ongoing tracking. Review the app permissions separately and deny anything it does not need.",
  },
  {
    id: "auto-renewal",
    title: "Automatic renewal or recurring charges",
    severity: "medium",
    patterns: [
      /\b(auto(?:matic(?:ally)?)?[- ]renew(?:s|al|ed)?|automatically renews|recurring (?:billing|charges|payment)|subscription renews|billed every|charged every)\b/i,
    ],
    impact:
      "A subscription or payment may continue automatically. Note the renewal date and set a reminder before any trial or billing period ends.",
  },
  {
    id: "cancellation",
    title: "Cancellation barriers or non-refundable fees",
    severity: "medium",
    patterns: [
      /\b(cancel(?:lation)?|terminate|opt out)\b.{0,100}\b(30|60|90) days?\b/i,
      /\b(non[- ]?refundable|no refunds?|cannot be refunded|early termination fee|cancellation fee)\b/i,
      /\b(cancel(?:lation)?|terminate)\b.{0,80}\b(contact support|in writing|by phone|in person|fee|penalty)\b/i,
      /\b(reserve the right|may|can)\b.{0,50}\b(cancel|cancell?ation)\b.{0,50}\b(orders?|purchases?|bookings?|accounts?|services?)\b.{0,40}\b(without notice|at any time|for any reason)\b/i,
    ],
    impact:
      "The terms may make cancellation, refunds, or keeping an order difficult. Confirm the exact conditions and cancellation steps before paying.",
  },
  {
    id: "return-restrictions",
    title: "Restricted returns or exchanges",
    severity: "medium",
    patterns: [
      /\b(no returns?(?: accepted)?|returns? (?:are )?not accepted|all sales (?:are )?final|no exchanges?(?: accepted)?|exchanges? (?:are )?not accepted)\b/i,
    ],
    impact:
      "You may be unable to return or exchange a purchase. Check exceptions for damaged, incorrect, or undelivered items before ordering.",
  },
  {
    id: "independent-verification",
    title: "Offer secrecy or restrictions on independent verification",
    severity: "high",
    block: true,
    patterns: [
      /\b(do not|don't|must not|may not|cannot|can not)\b.{0,60}\b(share|discuss|show|tell|post|publish)\b.{0,60}\b(anyone|anybody|others|public|online|offer|agreement|terms)\b/i,
      /\b(screenshots?|screen captures?)\b.{0,50}\b(not allowed|prohibited|forbidden|not permitted|must not|may not)\b/i,
      /\b(not allowed|prohibited|forbidden|not permitted)\b.{0,50}\b(screenshots?|screen captures?)\b/i,
    ],
    impact:
      "Pressure to keep an offer secret or prevent screenshots makes independent verification harder. Treat this as a serious warning sign and verify through the company's official contact details before paying or sharing information.",
  },
  {
    id: "legal-remedy-waiver",
    title: "Attempt to prevent legal action or remedies",
    severity: "high",
    block: true,
    patterns: [
      /\bno legal action (?:can|may) be taken\b/i,
      /\b(?:you|customer|user)s?\s+(?:may not|must not|cannot|can not)\s+(?:sue|take legal action|seek legal recourse)\b/i,
      /\bwaive\b.{0,70}\b(right to sue|legal action|legal recourse|all legal claims|all claims)\b/i,
      /\b(?:must not|may not|cannot|can not)\b.{0,60}\b(complain|report|contact)\b.{0,60}\b(bank|police|authorities|consumer protection|consumer forum)\b/i,
      /\b(?:company|we|seller|provider)\b.{0,70}\b(?:not liable|no liability)\b.{0,70}\b(?:under any circumstances|for any reason|for any loss)\b/i,
    ],
    impact:
      "This wording appears to restrict legal remedies or deny responsibility. Its meaning and enforceability depend on the full agreement and local law; consider qualified advice before accepting.",
  },
  {
    id: "content-license",
    title: "Broad rights to your uploaded content",
    severity: "high",
    patterns: [
      /\b(perpetual|irrevocable|worldwide|royalty[- ]free)\b.{0,100}\b(license|licence|right|use|content|upload)\b/i,
      /\b(grant|give)\b.{0,50}\b(us|the company|the service)\b.{0,100}\b(license|licence|right)\b/i,
      /\b(content|upload(?:ed)?)\b.{0,100}\b(perpetual|irrevocable|worldwide|royalty[- ]free|sublicense|distribute)\b/i,
    ],
    impact:
      "The service may claim continuing rights to use or distribute things you upload. Check whether the license ends when you delete content or close your account.",
  },
  {
    id: "dispute-waiver",
    title: "Arbitration or giving up group legal claims",
    severity: "medium",
    patterns: [
      /\b(binding arbitration|mandatory arbitration|arbitration agreement|waive.{0,50}(?:class action|jury trial)|class[- ]action waiver|waive your right to sue)\b/i,
    ],
    impact:
      "You may be giving up some ways to resolve disputes, such as joining a group claim. Consider getting qualified advice if this matters to you.",
  },
  {
    id: "unilateral-changes",
    title: "Company can change terms unilaterally",
    severity: "medium",
    patterns: [
      /\b(we|company|service|provider)\b.{0,60}\b(may|can|reserve the right to)\b.{0,50}\b(change|modify|update|revise)\b.{0,40}\b(terms|agreement|policy|price|fee)\b/i,
      /\b(change|modify|update|revise)\b.{0,50}\b(terms|agreement|policy|price|fee)\b.{0,60}\b(without notice|at any time|without your consent)\b/i,
    ],
    impact:
      "The company may change important terms, prices, or policies. Look for how it will notify you and whether you can leave after a change.",
  },
  {
    id: "liability-limits",
    title: "Limits on company responsibility",
    severity: "medium",
    patterns: [
      /\b(no liability|not liable|limit(?:ed)? liability|limitation of liability|disclaim(?:s|er)? all warranties|as is basis)\b/i,
    ],
    impact:
      "The company may limit its responsibility if the service causes problems. The practical effect depends on the full wording and applicable law.",
  },
  {
    id: "advance-prize-fee",
    title: "Payment requested to claim a prize or gift",
    severity: "high",
    block: true,
    patterns: [
      /\b(pay|payment|send|transfer|deposit|processing|delivery|shipping)\b.{0,70}\b(fee|charge|money|amount|tax|upi)\b.{0,80}\b(claim|receive|unlock|release|get)\b.{0,60}\b(prize|gift|reward|lottery|winnings?)\b/i,
      /\b(claim|receive|unlock|release|get)\b.{0,60}\b(prize|gift|reward|lottery|winnings?)\b.{0,80}\b(pay|payment|fee|charge|tax|upi)\b/i,
    ],
    impact:
      "Being asked to pay in advance to claim a prize or gift is a common scam warning sign. Do not pay or share OTPs, PINs, or banking details; verify the offer using an official channel you find independently.",
  },
];

function analyzeAgreement(text) {
  const normalizedText = text.normalize("NFKC").replace(/\u00a0/g, " ");
  const clauses = normalizedText
    .split(/(?<=[.!?;])\s+|\n+|^\s*(?:[-*•]|\d+[.)])\s+/m)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const findings = [];
  for (const clause of clauses) {
    for (const rule of CLAUSE_RULES) {
      if (
        rule.patterns.some((pattern) => pattern.test(clause)) &&
        !findings.some(
          (finding) => finding.id === rule.id && finding.clause === clause,
        )
      ) {
        findings.push({
          id: rule.id,
          title: rule.title,
          severity: rule.severity,
          block: Boolean(rule.block),
          impact: rule.impact,
          clause,
        });
      }
    }
  }

  const highRiskCount = findings.filter(
    (finding) => finding.severity === "high",
  ).length;
  const blockingFindings = findings.filter((finding) => finding.block);
  const decision = blockingFindings.length
    ? "BLOCK"
    : findings.length
      ? "REVIEW"
      : "ALLOW";
  const risk =
    decision === "BLOCK"
      ? "high"
      : decision === "REVIEW" || highRiskCount > 0
        ? "review"
        : "low";

  return { findings, risk, decision, blockingFindings };
}

function PolicySimulator() {
  const [agreement, setAgreement] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [simulation, setSimulation] = useState(null);

  const highRiskFindings = useMemo(
    () =>
      analysis?.findings.filter((finding) => finding.severity === "high") || [],
    [analysis],
  );

  const runAnalysis = () => {
    if (!agreement.trim()) {
      setAnalysis(null);
      setSimulation(null);
      return;
    }
    setAnalysis(analyzeAgreement(agreement));
    setSimulation(null);
  };

  const loadSample = () => {
    setAgreement(SAMPLE_AGREEMENT);
    setAnalysis(null);
    setSimulation(null);
  };

  return (
    <section className="policy-simulator">
      <header className="policy-header">
        <div className="policy-heading-icon" aria-hidden="true">
          ◈
        </div>
        <div>
          <h2>Understand before you agree</h2>
          <p>
            Paste an app&apos;s agreement to spot clauses worth reviewing and
            simulate what accepting or declining could mean.
          </p>
        </div>
      </header>

      <div className="panel policy-input-panel">
        <div className="panel-heading">
          <div>
            <h3>Agreement text</h3>
            <p>Paste the Terms of Service, privacy policy, or consent screen.</p>
          </div>
          <button className="policy-sample-button" onClick={loadSample}>
            Load example
          </button>
        </div>
        <label className="field-label" htmlFor="policy-agreement">
          PASTE AGREEMENT
        </label>
        <textarea
          id="policy-agreement"
          className="policy-textarea"
          value={agreement}
          onChange={(event) => {
            setAgreement(event.target.value);
            setAnalysis(null);
            setSimulation(null);
          }}
          placeholder="Paste the agreement text here. Avoid including private account details."
          rows={10}
          maxLength={50000}
        />
        <div className="policy-input-footer">
          <span>{agreement.length.toLocaleString()} / 50,000 characters</span>
          <button
            className="primary-button"
            onClick={runAnalysis}
            disabled={!agreement.trim()}
          >
            Scan agreement →
          </button>
        </div>
        <p className="policy-privacy-note">
          Scanning happens in this browser. Your agreement text is not sent to
          Gemini or another service.
        </p>
      </div>

      {analysis && (
        <>
          <section
            className={`policy-summary policy-risk-${analysis.risk}`}
            aria-live="polite"
          >
            <div className="policy-summary-icon" aria-hidden="true">
              {analysis.risk === "high"
                ? "!"
                : analysis.risk === "review"
                  ? "?"
                  : "✓"}
            </div>
            <div>
              <span className="policy-summary-label">AUTOMATED SCAN</span>
              <h3>
                {analysis.decision === "BLOCK"
                  ? "Strong warning signs found — do not proceed yet"
                  : analysis.decision === "REVIEW"
                    ? "Review these clauses before agreeing"
                    : "No known red flags found — appears low-risk"}
              </h3>
              <p>
                {analysis.findings.length
                  ? `${analysis.findings.length} clause${analysis.findings.length === 1 ? "" : "s"} flagged. ${analysis.blockingFindings.length ? `${analysis.blockingFindings.length} strong warning sign${analysis.blockingFindings.length === 1 ? "" : "s"} need independent verification.` : "These terms deserve review but are not proof of fraud."}`
                  : "Nothing matched the current rules. This quick scan cannot verify that the agreement is actually safe or fair."}
              </p>
            </div>
            <strong className="policy-risk-badge">{analysis.decision}</strong>
          </section>

          {analysis.findings.length > 0 ? (
            <section className="panel policy-findings">
              <div className="panel-heading">
                <div>
                  <h3>
                    {analysis.decision === "BLOCK"
                      ? "Risky points to understand"
                      : "Clauses to review"}
                  </h3>
                  <p>Matched text and the reason it was flagged.</p>
                </div>
              </div>
              <div className="policy-finding-list">
                {analysis.findings.map((finding, index) => (
                  <article className="policy-finding" key={`${finding.id}-${index}`}>
                    <div className="policy-finding-top">
                      <h4>{finding.title}</h4>
                      <span
                        className={`policy-severity policy-severity-${finding.severity}`}
                      >
                        {finding.severity === "high"
                          ? finding.block
                            ? "BLOCK SIGNAL"
                            : "HIGH REVIEW"
                          : "REVIEW"}
                      </span>
                    </div>
                    <blockquote>{finding.clause}</blockquote>
                    <p>{finding.impact}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <section className="panel policy-no-findings">
              <h3>No matching clauses found</h3>
              <p>
                This is not a guarantee that the terms are harmless. Review the
                full agreement, especially payment, privacy, permissions, and
                cancellation terms.
              </p>
            </section>
          )}

          <section className="panel policy-simulation">
            <div className="panel-heading">
              <div>
                <h3>Simulate your choice</h3>
                <p>
                  Preview possible trade-offs. Nothing is accepted, signed, or
                  sent by these buttons.
                </p>
              </div>
            </div>
            <div className="policy-choice-grid">
              <button
                className={`policy-choice policy-choice-agree ${
                  simulation === "agree" ? "selected" : ""
                }`}
                onClick={() => setSimulation("agree")}
              >
                <span aria-hidden="true">✓</span>
                <strong>Simulate “I agree”</strong>
                <small>Show the possible effects of accepting flagged terms.</small>
              </button>
              <button
                className={`policy-choice policy-choice-decline ${
                  simulation === "decline" ? "selected" : ""
                }`}
                onClick={() => setSimulation("decline")}
              >
                <span aria-hidden="true">×</span>
                <strong>Simulate “I decline”</strong>
                <small>Show what access or features might not be available.</small>
              </button>
            </div>

            {simulation && (
              <div className="policy-simulation-result" aria-live="polite">
                <h4>
                  {simulation === "agree"
                    ? "If you choose to agree"
                    : "If you choose to decline"}
                </h4>
                {simulation === "agree" ? (
                  analysis.findings.length ? (
                    <ul>
                      {analysis.findings.map(
                        (finding, index) => (
                          <li key={`${finding.id}-agree-${index}`}>
                            <strong>{finding.title}:</strong> {finding.impact}
                          </li>
                        ),
                      )}
                    </ul>
                  ) : (
                    <p>
                      No configured clauses were flagged, but accepting still
                      means agreeing to the full text. Review it carefully.
                    </p>
                  )
                ) : (
                  <p>
                    You may not be able to create an account or use the app
                    without accepting. You can look for a decline, skip, or
                    limited-consent option, or choose not to use the app.
                    {highRiskFindings.length > 0 &&
                      " Declining also avoids the high-impact clauses flagged above."}
                  </p>
                )}
              </div>
            )}
          </section>

          <p className="policy-disclaimer">
            PromptShield uses local keyword patterns, not legal review or a fraud
            database. It can miss risks or flag ordinary wording. It cannot
            prove that an agreement is fraudulent or certify it as safe. BLOCK
            is a warning recommendation only; it cannot block another
            app&apos;s agreement screen. Seek qualified advice for important
            decisions.
          </p>
        </>
      )}
    </section>
  );
}

export default PolicySimulator;
