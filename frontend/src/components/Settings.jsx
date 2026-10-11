const RULES = [
  { id: "R-001", name: "Instruction Override", detail: "Detects attempts to replace or reveal system instructions." },
  { id: "R-002", name: "Data Exfiltration", detail: "Detects attempts to send passwords, secrets, or data elsewhere." },
  { id: "R-003", name: "Protected Data / Canary Token", detail: "Detects requests for secrets, credentials, and protected data." },
  { id: "R-004", name: "Obfuscated Email", detail: "Detects email addresses written with spacing or obfuscation." },
  { id: "R-005", name: "Policy Tamper", detail: "Detects attempts to weaken or change security rules." },
  { id: "R-006", name: "Imperative Command in Untrusted Context", detail: "Detects risky commands embedded in untrusted content." },
  { id: "R-007", name: "Surgical Sanitization", detail: "Removes a detected injection from otherwise useful text." },
];

const SENSITIVITY_LEVELS = [
  { value: "LOW", title: "Low", detail: "Standard pattern matching only" },
  { value: "MEDIUM", title: "Medium", detail: "Also inspect Base64-decoded text" },
  { value: "HIGH", title: "High", detail: "Also detect whitespace-obfuscated text" },
];

function Settings({ settings, onChange, onSave, saveMessage }) {
  return (
    <section className="settings-page">
      <header className="feature-page-heading">
        <div className="feature-page-icon" aria-hidden="true">
          ⚙
        </div>
        <div>
          <h2>Security Settings</h2>
          <p>Customize the checks applied to new prompt analyses.</p>
        </div>
      </header>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h3>Detection rules</h3>
            <p>Disabled rules are skipped by Testing Lab checks.</p>
          </div>
          <span className="pill">7 RULES</span>
        </div>
        <div className="settings-rule-list">
          {RULES.map((rule) => (
            <label className="settings-rule" key={rule.id}>
              <input
                type="checkbox"
                checked={settings.enabledRules[rule.id]}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    enabledRules: {
                      ...settings.enabledRules,
                      [rule.id]: event.target.checked,
                    },
                  })
                }
              />
              <span className="settings-rule-copy">
                <span>
                  <code>{rule.id}</code>
                  <strong>{rule.name}</strong>
                </span>
                <small>{rule.detail}</small>
              </span>
              <span className="settings-rule-state">
                {settings.enabledRules[rule.id] ? "ON" : "OFF"}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h3>Detection sensitivity</h3>
            <p>Controls which text transformations are checked.</p>
          </div>
        </div>
        <div className="sensitivity-options">
          {SENSITIVITY_LEVELS.map((level) => (
            <label
              className={`sensitivity-option ${
                settings.sensitivity === level.value ? "selected" : ""
              }`}
              key={level.value}
            >
              <input
                type="radio"
                name="sensitivity"
                value={level.value}
                checked={settings.sensitivity === level.value}
                onChange={() =>
                  onChange({ ...settings, sensitivity: level.value })
                }
              />
              <strong>{level.title}</strong>
              <small>{level.detail}</small>
            </label>
          ))}
        </div>
      </section>

      <section className="panel settings-panel settings-preferences">
        <div>
          <h3>Appearance</h3>
          <p>Choose the dashboard color theme.</p>
        </div>
        <div className="theme-toggle" aria-label="Color theme">
          {["dark", "light"].map((theme) => (
            <button
              type="button"
              key={theme}
              className={settings.theme === theme ? "selected" : ""}
              aria-pressed={settings.theme === theme}
              onClick={() => onChange({ ...settings, theme })}
            >
              {theme === "dark" ? "☾ Dark" : "☼ Light"}
            </button>
          ))}
        </div>
      </section>

      <section className="panel settings-key-note">
        <div className="settings-key-icon" aria-hidden="true">
          🔐
        </div>
        <div>
          <h3>Gemini API key</h3>
          <p>
            Managed by the backend service. The server key is never shown or
            stored in this browser. Configure it in the backend host&apos;s
            environment settings.
          </p>
        </div>
        <span className="pill">SERVER-SIDE</span>
      </section>

      <div className="settings-save-row">
        <span role="status">{saveMessage}</span>
        <button className="primary-button" type="button" onClick={onSave}>
          Save Settings
        </button>
      </div>
    </section>
  );
}

export default Settings;
