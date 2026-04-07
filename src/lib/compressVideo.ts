/**
 * Compresses a video file by re-encoding it at a lower resolution/bitrate
 * using the browser's MediaRecorder API + OffscreenCanvas.
 *
 * Falls back to returning the original file if the browser doesn't support
 * the necessary APIs or if the video is already small enough.
 */
export async function compressVideo(
  file: File,
  maxDimension = 720,
  maxDurationSec = 120,
  targetBitrate = 1_000_000, // 1 Mbps
): Promise<Blob> {
  // If file is already under 10 MB, skip compression
  if (file.size < 10 * 1024 * 1024) {
    return file;
  }

  // Check browser support
  if (!("MediaRecorder" in window)) {
    console.warn("Video compression APIs not supported, uploading original");
    return file;
  }

  return new Promise<Blob>((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      let { videoWidth: w, videoHeight: h } = video;
      if (w > maxDimension || h > maxDimension) {
        if (w > h) {
          h = Math.round((h * maxDimension) / w);
          w = maxDimension;
        } else {
          w = Math.round((w * maxDimension) / h);
          h = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(30);

      // Add audio track if present
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        // no audio track, that's fine
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
          ? "video/webm;codecs=vp8"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: targetBitrate,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        URL.revokeObjectURL(url);
        const blob = new Blob(chunks, { type: mimeType });
        // If compression made it bigger, return original
        resolve(blob.size < file.size ? blob : file);
      };

      recorder.start();

      const maxTime = Math.min(video.duration || maxDurationSec, maxDurationSec);

      const draw = () => {
        if (video.paused || video.ended || video.currentTime >= maxTime) {
          recorder.stop();
          video.pause();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        requestAnimationFrame(draw);
      };

      video.onplay = draw;
      video.play().catch(() => {
        // Can't autoplay, just return original
        URL.revokeObjectURL(url);
        resolve(file);
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
  });
}
