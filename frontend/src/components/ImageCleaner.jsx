import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_CHAT_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:8000"
    : "https://promptshield-api.onrender.com");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ImageCleaner() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    setResult(null);
    setError("");
    if (!SUPPORTED_TYPES.includes(selectedFile.type)) {
      setFile(null);
      setPreviewUrl("");
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (selectedFile.size > MAX_IMAGE_SIZE) {
      setFile(null);
      setPreviewUrl("");
      setError("Image must be 5 MB or smaller.");
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const cleanImage = async () => {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the selected image."));
        reader.readAsDataURL(file);
      });
      const imageBase64 = dataUrl.split(",")[1];
      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/image/clean`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: imageBase64,
            mime_type: file.type,
          }),
        },
      );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The image service returned an unreadable response.");
      }
      if (!response.ok) {
        throw new Error(data.detail || "Image cleaning failed.");
      }
      setResult({
        ...data,
        dataUrl: `data:${data.mime_type};base64,${data.image_base64}`,
      });
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? `Cannot reach the image backend at ${API_BASE_URL}. Check that the backend is deployed and running.`
          : requestError.message || "Could not clean this image.",
      );
    } finally {
      setLoading(false);
    }
  };

  const outputExtension =
    result?.mime_type === "image/jpeg"
      ? "jpg"
      : result?.mime_type === "image/webp"
        ? "webp"
        : "png";
  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}-cleaned.${outputExtension}`
    : `cleaned-image.${outputExtension}`;

  return (
    <section className="image-cleaner">
      <header className="image-cleaner-header">
        <h2>Find and remove unwanted image additions</h2>
        <p>
          Gemini looks for clearly inserted prompt-like text or unrelated
          composited objects, explains its findings, and returns an edited image.
        </p>
      </header>

      <div className="image-cleaner-upload panel">
        <label className="pdf-upload-label" htmlFor="image-cleaner-file">
          <span className="upload-icon" aria-hidden="true">🖼️</span>
          Choose an image
          <input
            id="image-cleaner-file"
            className="image-cleaner-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={loading}
          />
        </label>
        <p>JPEG, PNG, or WebP · up to 5 MB and 20 megapixels</p>
        <p className="image-cleaner-privacy">
          The image is sent to the PromptShield backend and Gemini for analysis
          and editing. Do not upload images you do not have permission to use.
        </p>
        <p className="image-cleaner-privacy">
          This checks visible content, not invisible steganographic data. AI edits
          may alter nearby image details and can make mistakes.
        </p>
        {file && <p className="image-cleaner-filename">Selected: {file.name}</p>}
        {error && <p className="pdf-error" role="alert">{error}</p>}
        {file && (
          <button
            className="primary-button image-cleaner-submit"
            type="button"
            onClick={cleanImage}
            disabled={loading}
          >
            {loading ? "Analyzing and cleaning..." : "Analyze & Clean Image"}
          </button>
        )}
      </div>

      {previewUrl && !result && (
        <article className="panel image-cleaner-image-card">
          <h3>Image preview</h3>
          <img src={previewUrl} alt="Preview of the selected image" />
        </article>
      )}

      {loading && (
        <div className="pdf-loading" role="status">
          Gemini is checking the image and preparing the result. This may take a moment.
        </div>
      )}

      {result && (
        <section className="image-cleaner-result" aria-live="polite">
          <div className="pdf-report">
            <h4>Image check complete</h4>
            <p>{result.message}</p>
            {result.findings.length > 0 ? (
              <ul className="image-cleaner-findings">
                {result.findings.map((finding, index) => (
                  <li key={`${finding.item}-${index}`}>
                    <strong>{finding.item}</strong>
                    <span>{finding.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No clearly unwanted additions were identified. The original is unchanged.</p>
            )}
          </div>

          <div className="image-cleaner-comparison">
            <article className="panel image-cleaner-image-card">
              <h3>Original image</h3>
              {previewUrl && <img src={previewUrl} alt="Original uploaded image" />}
            </article>
            <article className="panel image-cleaner-image-card">
              <h3>Clean image</h3>
              <img src={result.dataUrl} alt="Image after removing detected additions" />
              <a className="primary-button" href={result.dataUrl} download={downloadName}>
                Download clean image
              </a>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}

export default ImageCleaner;
