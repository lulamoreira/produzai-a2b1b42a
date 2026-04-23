/**
 * Detect device profile and recommend compression settings.
 * Goal: avoid OOM on Android when uploading multiple large photos.
 *
 * Tiers:
 *  - "low":    Android low-end / device-memory ≤ 2GB / cores ≤ 4   → 800px / 0.55
 *  - "mid":    Android typical / device-memory 3-6GB                → 1024px / 0.6
 *  - "high":   iOS / desktop / high-end Android (>6GB or unknown)   → 1280px / 0.7
 */

export type DeviceTier = "low" | "mid" | "high";

export interface CompressionProfile {
  tier: DeviceTier;
  maxDimension: number;
  quality: number;
  isAndroid: boolean;
  deviceMemoryGB: number | null;
}

function detectAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android/i.test(ua);
}

function getDeviceMemoryGB(): number | null {
  // navigator.deviceMemory is rounded down to {0.25, 0.5, 1, 2, 4, 8} on Chromium.
  // It's undefined on iOS Safari and Firefox — return null so we fall back to tier "high".
  const mem = (navigator as any).deviceMemory;
  if (typeof mem !== "number") return null;
  return mem;
}

function getHardwareConcurrency(): number {
  return typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
}

export function getCompressionProfile(): CompressionProfile {
  const isAndroid = detectAndroid();
  const memGB = getDeviceMemoryGB();
  const cores = getHardwareConcurrency();

  let tier: DeviceTier = "high";

  if (isAndroid) {
    if ((memGB !== null && memGB <= 2) || cores <= 4) {
      tier = "low";
    } else if (memGB === null || memGB <= 6) {
      // Treat unknown-memory Android as mid (safer than "high")
      tier = "mid";
    } else {
      tier = "high";
    }
  } else if (memGB !== null && memGB <= 2) {
    // Very low-end non-Android too — be safe
    tier = "low";
  }

  switch (tier) {
    case "low":
      return { tier, maxDimension: 800, quality: 0.55, isAndroid, deviceMemoryGB: memGB };
    case "mid":
      return { tier, maxDimension: 1024, quality: 0.6, isAndroid, deviceMemoryGB: memGB };
    default:
      return { tier, maxDimension: 1280, quality: 0.7, isAndroid, deviceMemoryGB: memGB };
  }
}

/**
 * For very large source files (>5MB), step the profile down one tier
 * to further reduce memory pressure during decode.
 */
export function getCompressionProfileForFile(fileSizeBytes: number): CompressionProfile {
  const base = getCompressionProfile();
  const FIVE_MB = 5 * 1024 * 1024;
  if (fileSizeBytes <= FIVE_MB) return base;

  if (base.tier === "high") {
    return { ...base, tier: "mid", maxDimension: 1024, quality: 0.6 };
  }
  if (base.tier === "mid") {
    return { ...base, tier: "low", maxDimension: 800, quality: 0.55 };
  }
  // Already low — push even further for huge files
  return { ...base, maxDimension: 720, quality: 0.5 };
}
