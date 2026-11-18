"use client";

import { Copy, Download, Share2 } from "lucide-react";
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

function canCopyImages() {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

async function loadPng(url: string) {
  const res = await fetch(url, { redirect: "error" });
  // Only a real picture is passed on: never a login page or an error page labelled as one.
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/png")) throw new Error(String(res.status));
  return new Blob([await res.blob()], { type: "image/png" });
}

/**
 * Sends the report picture. On a phone "Deel" hands the image straight to
 * WhatsApp or mail through the share sheet; on a computer you copy it and
 * paste it in the chat, or download it and attach it yourself.
 *
 * Both hand over the picture and nothing else. The message is not shared
 * along: a share sheet treats it as a second item, so "Copy" there put two
 * things on the clipboard and WhatsApp pasted two attachments.
 */
export function ShareReport({ imageUrl, fileName }: { imageUrl: string; fileName: string }) {
  const canShare = useSyncExternalStore(noSubscribe, canShareFiles, () => false);
  const canCopy = useSyncExternalStore(noSubscribe, canCopyImages, () => false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setError(null);
    try {
      await navigator.share({ files: [new File([await loadPng(imageUrl)], fileName, { type: "image/png" })] });
    } catch (err) {
      // Closing the share sheet is not an error worth showing.
      if (!(err instanceof DOMException && err.name === "AbortError")) setError("Delen lukte niet. Download de afbeelding en stuur hem zelf.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setError(null);
    try {
      // The picture goes in as a promise: Safari only allows the copy while the click is still being handled.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": loadPng(imageUrl) })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Kopiëren lukte niet. Download de afbeelding en stuur hem zelf.");
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
      {canCopy && (
        <button type="button" className={`btn btn-sm ${canShare ? "" : "btn-primary"}`} onClick={copy}>
          <Copy aria-hidden="true" />
          {copied ? "Gekopieerd ✓" : "Kopieer afbeelding"}
        </button>
      )}
      <a href={imageUrl} download={fileName} className={`btn btn-sm ${canShare || canCopy ? "" : "btn-primary"}`}>
        <Download aria-hidden="true" />
        Download afbeelding
      </a>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}
