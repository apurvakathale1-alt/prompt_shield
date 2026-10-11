import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// ⬇️ Worker setup — jsdelivr CDN (reliable)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function PDFUploader({ onAnalyze }) {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [cleanText, setCleanText] = useState("");
  const [removed, setRemoved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setRemoved([]);
    setCleanText("");

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }

      setExtractedText(fullText);

      const result = analyzePDF(fullText);
      setCleanText(result.clean);
      setRemoved(result.removed);

      if (onAnalyze) {
        onAnalyze(fullText, "document");
      }
    } catch (err) {
      setError("PDF वाचता आली नाही: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzePDF = (text) => {
    const matches = [];

    const getContext = (start, end) => {
      const contextStart = Math.max(0, start - 40);
      const contextEnd = Math.min(text.length, end + 40);
      const context = text.slice(contextStart, contextEnd);
      return (contextStart > 0 ? "..." : "") +
        context +
        (contextEnd < text.length ? "..." : "");
    };

    const collectMatches = (pattern, type, reason, replacement) => {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const overlaps = matches.some(
          (existing) => start < existing.end && existing.start < end,
        );

        if (!overlaps) {
          matches.push({
            start,
            end,
            replacement,
            item: {
              type,
              value: match[0].trim(),
              reason,
              context: getContext(start, end),
            },
          });
        }

        if (match[0].length === 0) pattern.lastIndex += 1;
      }
    };

    collectMatches(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "Email",
      "Personal email address — privacy risk",
      "[EMAIL_REDACTED]",
    );
    collectMatches(
      /\b(sk|pk|api)[-_][a-zA-Z0-9]{16,}\b/gi,
      "API Key",
      "Secret API key — चोरीला जाऊ शकते",
      "[API_KEY_REDACTED]",
    );
    collectMatches(
      /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
      "Aadhaar",
      "Government ID number — sensitive",
      "[AADHAAR_REDACTED]",
    );
    collectMatches(
      /(\+91[\s-]?)?[6-9]\d{9}\b/g,
      "Phone",
      "Personal phone number — privacy risk",
      "[PHONE_REDACTED]",
    );
    collectMatches(
      /\b[A-Z]{5}\d{4}[A-Z]\b/g,
      "PAN",
      "Tax ID — sensitive",
      "[PAN_REDACTED]",
    );

    const injectionChecks = [
      {
        pattern: /ignore\s+all\s+prior\s+rules/gi,
        type: "Instruction Override",
        reason:
          "AI ला फसवण्याचा प्रयत्न — 'ignore all prior rules' म्हणजे AI ने नियम विसरावेत",
      },
      {
        pattern: /system\s+override[^.]*/gi,
        type: "System Override",
        reason: "AI च्या system instructions बदलण्याचा प्रयत्न",
      },
      {
        pattern: /ignore\s+(all\s+)?(previous\s+)?instructions[^.]*/gi,
        type: "Instruction Override",
        reason: "AI ने आधीच्या सूचना विसराव्यात अशी फसवणूक",
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
        reason: "Untrusted document मधून AI ला सूचना देण्याचा प्रयत्न",
      },
    ];

    injectionChecks.forEach(({ pattern, type, reason }) => {
      collectMatches(pattern, type, reason, "[INJECTION_REMOVED]");
    });

    collectMatches(
      /(https?:\/\/[^\s]*?(evil|attacker|hacker|malicious)[^\s]*)/gi,
      "Malicious URL",
      "संशयास्पद URL — data leak होऊ शकतो",
      "[URL_REMOVED]",
    );

    const clean = [...matches]
      .sort((a, b) => b.start - a.start)
      .reduce(
        (current, match) =>
          current.slice(0, match.start) +
          match.replacement +
          current.slice(match.end),
        text,
      );

    return {
      clean: clean.trim(),
      removed: matches.map(({ item }) => item),
    };
  };

  const downloadClean = () => {
    const blob = new Blob([cleanText], { type: "text/plain" });
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
        <h3>📄 PDF Upload & Sanitize</h3>
        <p>Upload a PDF — AI will detect and remove unwanted content</p>
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

      {loading && (
        <div className="pdf-loading">⏳ Extracting and analyzing...</div>
      )}

      {error && <div className="pdf-error">❌ {error}</div>}

      {removed.length > 0 && (
        <div className="pdf-report">
          <h4>📊 Analysis Report</h4>
          <p>
            <b>{removed.length}</b> unwanted item(s) removed, safe content preserved.
          </p>
          <div className="removed-list">
            {removed.map((item, i) => (
              <div key={`${item.type}-${i}`} className="removed-detail">
                <div className="removed-header">
                  <span className="removed-type">{item.type}</span>
                </div>
                <div className="removed-text">
                  <span className="label">❌ काढलेला text:</span>
                  <code className="exact-text">"{item.value}"</code>
                </div>
                <div className="removed-reason">
                  <span className="label">📌 कारण:</span>
                  <span className="reason-text">{item.reason}</span>
                </div>
                {item.context && (
                  <div className="removed-context">
                    <span className="label">🔍 Context:</span>
                    <code className="context-text">{item.context}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cleanText && (
        <div className="pdf-output">
          <div className="output-header">
            <h4>✅ Clean Output</h4>
            <button className="primary-button" onClick={downloadClean}>
              ⬇ Download
            </button>
          </div>
          <pre className="clean-text">{cleanText}</pre>
        </div>
      )}

      {extractedText && !cleanText && (
        <div className="pdf-output">
          <h4>📄 Extracted Text</h4>
          <pre className="clean-text">{extractedText}</pre>
        </div>
      )}
    </div>
  );
}

export default PDFUploader;