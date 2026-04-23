import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { compressImage } from "./compressImage";

/**
 * These tests focus on the safety net in compressImage:
 *   when canvas drawing / encoding fails (silently or loudly) on mobile,
 *   the function MUST fall back to returning the original File untouched.
 */

// ---------- helpers ----------

function makeFile(size = 1024, name = "photo.jpg"): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: "image/jpeg" });
}

interface MockCtxOptions {
  /** What every getImageData pixel sample should return [r,g,b,a] */
  sampledPixel?: [number, number, number, number];
  /** Throw on getImageData (simulates a tainted canvas) */
  throwOnGetImageData?: boolean;
}

function installCanvasMocks(opts: {
  ctx?: MockCtxOptions;
  /** What canvas.toBlob should resolve with. null = encode failure. */
  toBlobResult?: Blob | null;
} = {}) {
  const ctxOpts = opts.ctx ?? {};
  const sampled = ctxOpts.sampledPixel ?? [255, 0, 0, 255]; // default solid red

  const fakeCtx = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => {
      if (ctxOpts.throwOnGetImageData) throw new Error("tainted canvas");
      return { data: new Uint8ClampedArray(sampled) };
    }),
  };

  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);

  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
      cb(opts.toBlobResult === undefined
        ? new Blob([new Uint8Array(50_000)], { type: "image/jpeg" })
        : opts.toBlobResult);
    });

  return { fakeCtx, getContextSpy, toBlobSpy };
}

function installImageBitmap(width = 2000, height = 1500) {
  // jsdom doesn't ship createImageBitmap — install a working fake.
  (globalThis as any).createImageBitmap = vi.fn(async () => ({
    width,
    height,
    close: vi.fn(),
  }));
}

function removeImageBitmap() {
  delete (globalThis as any).createImageBitmap;
}

// ---------- tests ----------

describe("compressImage — fallback to original file on drawImage failure", () => {
  beforeEach(() => {
    installImageBitmap(2000, 1500);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    removeImageBitmap();
  });

  it("returns the original file when drawImage produces a solid-color canvas (silent failure)", async () => {
    // All sampled pixels identical -> the safety net should detect a silent
    // drawImage failure and return the original file.
    installCanvasMocks({
      ctx: { sampledPixel: [0, 255, 0, 255] }, // all green everywhere
      // Even if toBlob "succeeds" with a normal-sized blob, identical pixels
      // are the stronger signal.
      toBlobResult: new Blob([new Uint8Array(80_000)], { type: "image/jpeg" }),
    });

    const file = makeFile(2_000_000);
    const result = await compressImage(file, 1024, 0.7);

    expect(result).toBe(file);
  });

  it("returns the original file when toBlob returns null (encoder failure on Android)", async () => {
    installCanvasMocks({
      // Vary pixel samples so the solid-color check passes…
      ctx: { sampledPixel: [12, 34, 56, 255] },
      toBlobResult: null,
    });
    // Force at least one sample to differ so the solid-color guard doesn't trip first.
    // We do this by overriding getImageData to return different values per call.
    const calls = [
      [10, 10, 10, 255],
      [20, 20, 20, 255],
      [30, 30, 30, 255],
      [40, 40, 40, 255],
      [50, 50, 50, 255],
    ];
    let i = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(calls[i++ % calls.length]),
      })),
    } as unknown as CanvasRenderingContext2D);

    const file = makeFile(1_500_000);
    const result = await compressImage(file, 1024, 0.7);

    expect(result).toBe(file);
  });

  it("returns the original file when toBlob returns a suspiciously tiny blob (solid-color JPEG)", async () => {
    // Vary pixels so solid-color guard does NOT short-circuit; we want the
    // tiny-blob guard to kick in instead.
    const calls = [
      [10, 10, 10, 255],
      [20, 20, 20, 255],
      [30, 30, 30, 255],
      [40, 40, 40, 255],
      [50, 50, 50, 255],
    ];
    let i = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(calls[i++ % calls.length]),
      })),
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, cb: BlobCallback) {
        // Tiny ~2KB blob -> consistent with a solid-color JPEG from a failed draw
        cb(new Blob([new Uint8Array(2_000)], { type: "image/jpeg" }));
      }
    );

    const file = makeFile(1_500_000);
    const result = await compressImage(file, 1024, 0.7);

    expect(result).toBe(file);
  });

  it("returns the original file when getContext returns null (no 2d context)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null as any);

    const file = makeFile(1_000_000);
    const result = await compressImage(file, 1024, 0.7);

    expect(result).toBe(file);
  });

  it("returns the original file when image decoding fails entirely", async () => {
    // Force createImageBitmap to throw and ensure HTMLImageElement also fails.
    (globalThis as any).createImageBitmap = vi.fn(async () => {
      throw new Error("decode failed");
    });
    // Make new Image().decode reject as well
    const origDecode = (HTMLImageElement.prototype as any).decode;
    (HTMLImageElement.prototype as any).decode = vi.fn(() =>
      Promise.reject(new Error("decode failed"))
    );

    try {
      const file = makeFile(500_000);
      const result = await compressImage(file, 1024, 0.7);
      expect(result).toBe(file);
    } finally {
      (HTMLImageElement.prototype as any).decode = origDecode;
    }
  });

  it("returns a compressed Blob (not the original) when everything works correctly", async () => {
    // Vary pixel samples so the solid-color detector is NOT triggered.
    const calls = [
      [10, 20, 30, 255],
      [200, 100, 50, 255],
      [80, 80, 200, 255],
      [255, 255, 255, 255],
      [0, 0, 0, 255],
    ];
    let i = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(calls[i++ % calls.length]),
      })),
    } as unknown as CanvasRenderingContext2D);

    // Healthy-sized JPEG result
    const healthyBlob = new Blob([new Uint8Array(120_000)], { type: "image/jpeg" });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(healthyBlob);
      }
    );

    const file = makeFile(1_500_000);
    const result = await compressImage(file, 1024, 0.7);

    expect(result).toBe(healthyBlob);
    expect(result).not.toBe(file);
  });
});
