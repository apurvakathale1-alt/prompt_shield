import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
      }

      setExtractedText(fullText);

      // Analyze करा
      const result = analyzePDF(fullText);
      setCleanText(result.clean);
      setRemoved(result.removed);

      // Dashboard stats update
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
    let clean = text;
    const removedItems = [];

    // 1. Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    clean = clean.replace(emailRegex, (match) => {
      removedItems.push({ type: "Email", value: match });
      return "[EMAIL_REDACTED]";
    });

    // 2. Phone
    const phoneRegex = /(\+91[\s-]?)?[6-9]\d{9}\b/g;
    clean = clean.replace(phoneRegex, (match) => {
      removedItems.push({ type: "Phone", value: match });
      return "[PHONE_REDACTED]";
    });

    // 3. API keys
    const apiKeyRegex = /\b(sk|pk|api)[-_][a-zA-Z0-9]{16,}\b/gi;
    clean = clean.replace(apiKeyRegex, (match) => {
      removedItems.push({ type: "API Key", value: match });
      return "[API_KEY_REDACTED]";
    });

    // 4. Aadhaar
    const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
    clean = clean.replace(aadhaarRegex, (match) => {
      removedItems.push({ type: "Aadhaar", value: match });
      return "[AADHAAR_REDACTED]";
    });

    // 5. PAN
    const panRegex = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
    clean = clean.replace(panRegex, (match) => {
      removedItems.push({ type: "PAN", value: match });
      return "[PAN_REDACTED]";
    });

    // 6. Injection commands
    const injectionPatterns = [
      /system\s+override[^.]*/gi,
      /ignore\s+(all\s+)?(previous\s+)?instructions[^.]*/gi,
      /send\s+.*(to\s+)?(attacker|evil|hacker)@[^\s]+/gi,
      /execute\s+command[^.]*/gi,
      /curl\s+https?:\/\/[^\s]+/gi,
    ];
    injectionPatterns.forEach((pattern) => {
      const matches = clean.match(pattern);
      if (matches) {
        matches.forEach((m) => {
          removedItems.push({ type: "Injection", value: m.trim() });
        });
        clean = clean.replace(pattern, "[INJECTION_REMOVED]");
      }
    });

    // 7. Malicious URLs
    const urlRegex = /(https?:\/\/[^\s]*?(evil|attacker|hacker|malicious)[^\s]*)/gi;
    clean = clean.replace(urlRegex, (match) => {
      removedItems.push({ type: "Malicious URL", value: match });
      return "[URL_REMOVED]";
    });

    return { clean: clean.trim(), removed: removedItems };
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
        <div className="pdf-loading">
          ⏳ Extracting and analyzing...
        </div>
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
              <div key={i} className="removed-item">
                <span className="removed-type">{item.type}</span>
                <code>{item.value}</code>
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