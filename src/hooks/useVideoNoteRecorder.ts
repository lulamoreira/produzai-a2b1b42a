import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderSource = "camera" | "screen";
export type RecorderStatus = "idle" | "recording" | "paused" | "stopped" | "error";

const MAX_DURATION_SEC = 180; // 3 minutes

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function useVideoNoteRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setStatus("idle");
    setDurationSec(0);
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  }, [cleanupStream, previewUrl]);

  useEffect(() => () => {
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [cleanupStream, previewUrl]);

  const start = useCallback(async (source: RecorderSource) => {
    try {
      setError(null);
      const stream = source === "screen"
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setStatus("stopped");
        cleanupStream();
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start(250);
      setStatus("recording");
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setDurationSec(s);
        if (s >= MAX_DURATION_SEC) rec.state !== "inactive" && rec.stop();
      }, 250);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao acessar câmera/tela");
      setStatus("error");
      cleanupStream();
    }
  }, [cleanupStream]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const stream = streamRef.current;
  return { status, durationSec, previewUrl, blob, error, stream, start, stop, reset, maxDurationSec: MAX_DURATION_SEC };
}
