"use client";

import { Download, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Feature check with a dummy file: desktop browsers often have share() but not for files. */
function canShareFiles() {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/**
 * Sends the report picture. On a phone "Deel" hands the image (and the short
 * message) straight to WhatsApp or mail through the share sheet; elsewhere,
 * or when sharing files isn't supported, you download it and attach it yourself.
 */
export function ShareReport({ imageUrl, fileName, message }: { imageUrl: string; fileName: string; message: string }) {
  const canShare = useSyncExternalStore(noSubscribe, canShareFiles, () => false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], fileName, { type: "image/png" });
      await navigator.share({ files: [file], text: message });
    } catch (err) {
      // Closing the share sheet is not an error worth showing.
      if (!(err instanceof DOMException && err.name === "AbortError")) setError("Delen lukte niet. Download de afbeelding en stuur hem zelf.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canShare && (
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={share}>
          <Share2 aria-hidden="true" />
          {busy ? "Bezig…" : "Deel afbeelding"}
        </button>
      )}
      <a href={imageUrl} download={fileName} className={`btn btn-sm ${canShare ? "" : "btn-primary"}`}>
        <Download aria-hidden="true" />
        Download afbeelding
      </a>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}
