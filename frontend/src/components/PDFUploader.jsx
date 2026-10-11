import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PDFUploader({ onAnalyze }) {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("clean"); // "clean" | "original"

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setError("फक्त PDF files allowed आहेत");
      return;
    }

    setFile(selectedFile);
    setError("");
    setLoading(true);
    setPages([]);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      const pageResults = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        const analysis = analyzePage(pageText);

        pageResults.push({
          pageNumber: i,
          originalText: pageText,
          cleanText: analysis.clean,
          removed: analysis.removed,
          hasIssues: analysis.removed.length > 0,
        });
      }

      setPages(pageResults);

      if (onAnalyze) {
        onAnalyze("PDF uploaded: " + selectedFile.name, "document");
      }
    } catch (err) {
      setError("PDF वाचता आली नाही: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzePage = (text) => {
    let clean = text;
    const removedItems = [];

    const getContext = (fullText, match) => {
      const index = fullText.indexOf(match);
      if (index === -1) return "";
      const start = Math.max(0, index - 40);
      const end = Math.min(fullText.length, index + match.length + 40);
      return (
        (start > 0 ? "..." : "") +
        fullText.slice(start, end) +
        (end < fullText.length ? "..." : "")
      );
    };

    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let m;
    while ((m = emailRegex.exec(text)) !== null) {
      removedItems.push({
        type: "Email",
        value: m[0],
        reason: "Personal email address — privacy risk",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(emailRegex, "[EMAIL_REDACTED]");

    // Phone
    const phoneRegex = /(\+91[\s-]?)?[6-9]\d{9}\b/g;
    while ((m = phoneRegex.exec(text)) !== null) {
      removedItems.push({
        type: "Phone",
        value: m[0],
        reason: "Personal phone number — privacy risk",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(phoneRegex, "[PHONE_REDACTED]");

    // API Keys
    const apiKeyRegex = /\b(sk|pk|api)[-_][a-zA-Z0-9]{16,}\b/gi;
    while ((m = apiKeyRegex.exec(text)) !== null) {
      removedItems.push({
        type: "API Key",
        value: m[0],
        reason: "Secret API key — चोरीला जाऊ शकते",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(apiKeyRegex, "[API_KEY_REDACTED]");

    // Aadhaar
    const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
    while ((m = aadhaarRegex.exec(text)) !== null) {
      removedItems.push({
        type: "Aadhaar",
        value: m[0],
        reason: "Government ID — sensitive",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(aadhaarRegex, "[AADHAAR_REDACTED]");

    // PAN
    const panRegex = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
    while ((m = panRegex.exec(text)) !== null) {
      removedItems.push({
        type: "PAN",
        value: m[0],
        reason: "Tax ID — sensitive",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(panRegex, "[PAN_REDACTED]");

    // Injection checks
    const injectionChecks = [
      {
        pattern: /ignore\s+all\s+prior\s+rules/gi,
        type: "Instruction Override",
        reason: "AI ला फसवण्याचा प्रयत्न — नियम विसरावेत",
      },
      {
        pattern: /system\s+override[^.]*/gi,
        type: "System Override",
        reason: "AI च्या system instructions बदलण्याचा प्रयत्न",
      },
      {
        pattern: /ignore\s+(all\s+)?(previous\s+)?instructions[^.]*/gi,
        type: "Instruction Override",
        reason: "आधीच्या सूचना विसराव्यात अशी फसवणूक",
      },
      {
        pattern: /print\s+secret\s+keys?/gi,
        type: "Data Leak",
        reason: "गुप्त keys उघड करण्याचा प्रयत्न",
      },
      {
        pattern: /send\s+.*(to\s+)?(attacker|evil|hacker)@[^\s]+/gi,
        type: "Data Exfiltration",
        reason: "Data चोरून बाहेर पाठवण्याचा प्रयत्न",
      },
      {
        pattern: /execute\s+command[^.]*/gi,
        type: "Command Injection",
        reason: "System वर command चालवण्याचा प्रयत्न",
      },
      {
        pattern: /curl\s+https?:\/\/[^\s]+/gi,
        type: "Malicious Command",
        reason: "External server ला data पाठवण्याचा प्रयत्न",
      },
      {
        pattern: /draft\s+a\s+polite\s+sick\s+leave\s+email[^.]*/gi,
        type: "Hidden Command",
        reason: "दुसऱ्या कामासाठी AI ला भाग पाडणे",
      },
      {
        pattern: /NOTE\s+TO\s+AGENT[^.]*/gi,
        type: "Indirect Injection",
        reason: "Untrusted document मधून AI ला सूचना",
      },
    ];

    injectionChecks.forEach(({ pattern, type, reason }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        removedItems.push({
          type,
          value: match[0].trim(),
          reason,
          context: getContext(text, match[0].trim()),
        });
      }
      clean = clean.replace(pattern, "[INJECTION_REMOVED]");
    });

    // Malicious URLs
    const urlRegex = /(https?:\/\/[^\s]*?(evil|attacker|hacker|malicious)[^\s]*)/gi;
    while ((m = urlRegex.exec(text)) !== null) {
      removedItems.push({
        type: "Malicious URL",
        value: m[0],
        reason: "संशयास्पद URL — data leak",
        context: getContext(text, m[0]),
      });
    }
    clean = clean.replace(urlRegex, "[URL_REMOVED]");

    return { clean: clean.trim(), removed: removedItems };
  };

  const totalPages = pages.length;
  const pagesWithIssues = pages.filter((p) => p.hasIssues).length;
  const totalRemoved = pages.reduce((sum, p) => sum + p.removed.length, 0);
  const cleanPages = totalPages - pagesWithIssues;

  const downloadClean = () => {
    const fullText = pages
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.cleanText}`)
      .join("\n\n");
    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clean_output.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pdf-uploader">
      <div className="pdf-header">
        <h3>📄 PDF Upload & Page-wise Analysis</h3>
        <p>Upload a PDF — each page will be analyzed separately</p>
      </div>

      <div className="pdf-upload-box">
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          id="pdf-input"
          style={{ display: "none" }}
        />
        <label htmlFor="pdf-input" className="pdf-upload-label">
          <span className="upload-icon">📎</span>
          {file ? file.name : "Choose PDF File"}
        </label>
      </div>

      {loading && <div className="pdf-loading">⏳ Analyzing page by page...</div>}
      {error && <div className="pdf-error">❌ {error}</div>}

      {/* Summary */}
      {pages.length > 0 && (
        <div className="pdf-summary">
          <h4>📊 Analysis Summary</h4>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-label">TOTAL PAGES</span>
              <span className="summary-value">{totalPages}</span>
            </div>
            <div className="summary-card summary-clean">
              <span className="summary-label">✅ CLEAN PAGES</span>
              <span className="summary-value">{cleanPages}</span>
            </div>
            <div className="summary-card summary-issues">
              <span className="summary-label">❌ PAGES WITH ISSUES</span>
              <span className="summary-value">{pagesWithIssues}</span>
            </div>
            <div className="summary-card summary-removed">
              <span className="summary-label">🗑️ TOTAL REMOVED</span>
              <span className="summary-value">{totalRemoved}</span>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      {pages.length > 0 && (
        <div className="pdf-view-toggle">
          <button
            className={`toggle-btn ${viewMode === "clean" ? "active" : ""}`}
            onClick={() => setViewMode("clean")}
          >
            ✅ Clean Output
          </button>
          <button
            className={`toggle-btn ${viewMode === "original" ? "active" : ""}`}
            onClick={() => setViewMode("original")}
          >
            📄 Original PDF Text
          </button>
          <button className="primary-button" onClick={downloadClean}>
            ⬇ Download Clean
          </button>
        </div>
      )}

      {/* Page-wise Cards */}
      {pages.length > 0 && (
        <div className="pdf-pages-container">
          {pages.map((page) => (
            <div
              key={page.pageNumber}
              className={`pdf-page-card ${
                page.hasIssues ? "page-has-issues" : "page-is-clean"
              }`}
            >
              {/* Page Header */}
              <div className="pdf-page-header">
                <div className="pdf-page-number">
                  📄 PAGE {page.pageNumber}
                </div>
                <div
                  className={`pdf-page-badge ${
                    page.hasIssues ? "badge-issues" : "badge-clean"
                  }`}
                >
                  {page.hasIssues
                    ? `❌ ${page.removed.length} ISSUE(S)`
                    : "✅ CLEAN"}
                </div>
              </div>

              {/* Removed Items */}
              {page.hasIssues && viewMode === "clean" && (
                <div className="pdf-removed-section">
                  <div className="pdf-removed-title">
                    🗑️ REMOVED FROM PAGE {page.pageNumber}:
                  </div>
                  {page.removed.map((item, i) => (
                    <div key={i} className="removed-detail">
                      <div className="removed-header">
                        <span className="removed-type">{item.type}</span>
                      </div>

                      <div className="removed-row">
                        <span className="label">❌ काढलेला text:</span>
                        <code className="exact-text">"{item.value}"</code>
                      </div>

                      <div className="removed-row">
                        <span className="label">📌 कारण:</span>
                        <span className="reason-text">{item.reason}</span>
                      </div>

                      {item.context && (
                        <div className="removed-row">
                          <span className="label">🔍 Context:</span>
                          <code className="context-text">{item.context}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Page Content */}
              <div className="pdf-page-content">
                <div className="pdf-content-label">
                  {viewMode === "clean" ? "✅ CLEAN TEXT:" : "📄 ORIGINAL TEXT:"}
                </div>
                <pre className="pdf-page-text">
                  {viewMode === "clean" ? page.cleanText : page.originalText}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PDFUploader;