import { useState, useCallback } from 'react';
import { FilterSettings } from '../types';

export const useImageFilters = () => {
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 1,
    exposure: 0,
    clarity: 0,
    grayscale: false,
    autoEnhance: false,
    preset: 'original',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // ─── Private image-processing helpers ────────────────────────────────────

  /** Downsample + interpolate to estimate background illumination (for shadow removal) */
  const getBackgroundIllumination = (
    img: HTMLImageElement,
    width: number,
    height: number
  ): Uint8ClampedArray => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    const scale = 16;
    tempCanvas.width = Math.max(1, Math.round(width / scale));
    tempCanvas.height = Math.max(1, Math.round(height / scale));
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
    const lowResData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
    const illum = new Uint8ClampedArray(width * height);
    const lw = tempCanvas.width;
    const lh = tempCanvas.height;
    for (let y = 0; y < height; y++) {
      const ly = Math.min(lh - 1, Math.floor(y / scale));
      for (let x = 0; x < width; x++) {
        const lx = Math.min(lw - 1, Math.floor(x / scale));
        const idx = (ly * lw + lx) * 4;
        illum[y * width + x] =
          0.299 * lowResData[idx] + 0.587 * lowResData[idx + 1] + 0.114 * lowResData[idx + 2];
      }
    }
    return illum;
  };

  /** 3×3 convolution — returns a new ImageData */
  const convolve = (imageData: ImageData, weights: number[]): ImageData => {
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data;
    const half = 1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        for (let cy = 0; cy < 3; cy++) {
          for (let cx = 0; cx < 3; cx++) {
            const scy = Math.min(sh - 1, Math.max(0, y + cy - half));
            const scx = Math.min(sw - 1, Math.max(0, x + cx - half));
            const srcOff = (scy * sw + scx) * 4;
            const wt = weights[cy * 3 + cx];
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
        dst[dstOff] = Math.max(0, Math.min(255, r));
        dst[dstOff + 1] = Math.max(0, Math.min(255, g));
        dst[dstOff + 2] = Math.max(0, Math.min(255, b));
        dst[dstOff + 3] = src[dstOff + 3];
      }
    }
    return output;
  };

  // ─── Pixel-level adjustments ──────────────────────────────────────────────

  /** Standard grayscale (luminance) */
  const applyGrayscale = (data: Uint8ClampedArray): void => {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  };

  /** Adaptive threshold for clean B&W document scans */
  const applyAdaptiveThreshold = (data: Uint8ClampedArray, w: number, h: number): void => {
    applyGrayscale(data);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total += data[i];
    const avg = total / (w * h);
    for (let i = 0; i < data.length; i += 4) {
      const val = data[i] > avg - 10 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
  };

  /** Flat-field correction to remove background shadows */
  const applyIlluminationCorrection = (
    data: Uint8ClampedArray,
    background: Uint8ClampedArray
  ): void => {
    for (let i = 0; i < data.length; i += 4) {
      const bg = background[i / 4] || 255;
      data[i] = Math.max(0, Math.min(255, (data[i] / (bg || 1)) * 240));
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] / (bg || 1)) * 240));
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] / (bg || 1)) * 240));
    }
  };

  /** Additive brightness  (value: -1 → +1) */
  const applyBrightness = (data: Uint8ClampedArray, value: number): void => {
    const factor = value * 255;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + factor));
    }
  };

  /** Multiplicative exposure (EV stops). value: -1 → +1 ≈ -2EV → +2EV */
  const applyExposure = (data: Uint8ClampedArray, value: number): void => {
    const factor = Math.pow(2, value * 2); // 0.25× to 4×
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
    }
  };

  /** S-curve contrast (value: -1 → +1) */
  const applyContrast = (data: Uint8ClampedArray, value: number): void => {
    const factor = (259 * (value * 255 + 255)) / (255 * (259 - value * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }
  };

  /** Saturation boost/reduce (value: 0 = grayscale, 1 = original, 2 = vivid) */
  const applySaturation = (data: Uint8ClampedArray, value: number): void => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = Math.max(0, Math.min(255, gray + value * (r - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + value * (g - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + value * (b - gray)));
    }
  };

  /** Warmth tint (value: -1 cool → +1 warm) */
  const applyWarmth = (data: Uint8ClampedArray, value: number): void => {
    const r = value * 30;  // +red for warmth
    const b = -value * 30; // -blue for warmth
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + r));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + b));
    }
  };

  /**
   * Unsharp mask — clarity / local contrast enhancement.
   * strength: 0 = no effect, 1 = strong clarity boost.
   * Mutates imageData.data in place using a box-blur for the "blurred" reference.
   */
  const applyUnsharpMask = (imageData: ImageData, strength: number): void => {
    const blurred = convolve(imageData, [
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
      1 / 9, 1 / 9, 1 / 9,
    ]);
    const amount = strength * 2.5; // 0 → 2.5 range
    const src = imageData.data;
    const ref = blurred.data;
    for (let i = 0; i < src.length; i += 4) {
      src[i] = Math.max(0, Math.min(255, src[i] + amount * (src[i] - ref[i])));
      src[i + 1] = Math.max(0, Math.min(255, src[i + 1] + amount * (src[i + 1] - ref[i + 1])));
      src[i + 2] = Math.max(0, Math.min(255, src[i + 2] + amount * (src[i + 2] - ref[i + 2])));
    }
  };

  /** Auto levels — stretch per-channel histogram to fill 0–255 */
  const applyAutoLevels = (data: Uint8ClampedArray): void => {
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < minR) minR = data[i];
      if (data[i] > maxR) maxR = data[i];
      if (data[i + 1] < minG) minG = data[i + 1];
      if (data[i + 1] > maxG) maxG = data[i + 1];
      if (data[i + 2] < minB) minB = data[i + 2];
      if (data[i + 2] > maxB) maxB = data[i + 2];
    }
    const rR = maxR - minR || 1, rG = maxG - minG || 1, rB = maxB - minB || 1;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(((data[i] - minR) / rR) * 255);
      data[i + 1] = Math.round(((data[i + 1] - minG) / rG) * 255);
      data[i + 2] = Math.round(((data[i + 2] - minB) / rB) * 255);
    }
  };

  // ─── Main filter pipeline ─────────────────────────────────────────────────

  const applyFilters = useCallback(
    async (
      imageUri: string,
      newFilters?: Partial<FilterSettings>
    ): Promise<string | null> => {
      setIsProcessing(true);
      const af = newFilters ? { ...filters, ...newFilters } : filters;

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUri;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not available');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // ── Apply preset base ─────────────────────────────────────────────
        switch (af.preset) {
          case 'grayscale':
            applyGrayscale(imageData.data);
            break;

          case 'bw':
            applyAdaptiveThreshold(imageData.data, canvas.width, canvas.height);
            break;

          case 'color':
            applySaturation(imageData.data, 1.6);
            applyContrast(imageData.data, 0.2);
            break;

          case 'magic':
            // Shadow removal + high contrast + soft sharpen
            applyIlluminationCorrection(
              imageData.data,
              getBackgroundIllumination(img, canvas.width, canvas.height)
            );
            applyContrast(imageData.data, 0.4);
            imageData = convolve(imageData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
            break;

          case 'hd':
            // Aggressive sharpen kernel
            imageData = convolve(imageData, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
            break;

          case 'shadows':
            applyIlluminationCorrection(
              imageData.data,
              getBackgroundIllumination(img, canvas.width, canvas.height)
            );
            break;

          case 'noise':
            // 3×3 average blur
            imageData = convolve(imageData, [
              1 / 9, 1 / 9, 1 / 9,
              1 / 9, 1 / 9, 1 / 9,
              1 / 9, 1 / 9, 1 / 9,
            ]);
            break;

          case 'clarity':
            // Clarity preset: strong unsharp mask (local contrast boost)
            applyUnsharpMask(imageData, 0.85);
            applyContrast(imageData.data, 0.1);
            break;

          case 'vivid':
            // Vivid: high saturation + punchy contrast
            applySaturation(imageData.data, 1.9);
            applyContrast(imageData.data, 0.3);
            applyBrightness(imageData.data, 0.04);
            break;
        }

        // ── Auto enhance (auto levels) ───────────────────────────────────
        if (af.autoEnhance) {
          applyAutoLevels(imageData.data);
        }

        // ── Slider adjustments (order matters) ───────────────────────────
        if (af.exposure !== 0) applyExposure(imageData.data, af.exposure);
        if (af.brightness !== 0) applyBrightness(imageData.data, af.brightness);
        if (af.contrast !== 0) applyContrast(imageData.data, af.contrast);
        if (af.saturation !== 1) applySaturation(imageData.data, af.saturation);
        if (af.clarity > 0) applyUnsharpMask(imageData, af.clarity);
        if (af.grayscale) applyGrayscale(imageData.data);

        ctx.putImageData(imageData, 0, 0);
        const result = canvas.toDataURL('image/jpeg', 0.92);
        setIsProcessing(false);
        return result;
      } catch (error) {
        console.error('Filter application failed:', error);
        setIsProcessing(false);
        return null;
      }
    },
    [filters]
  );

  const updateFilter = useCallback(
    <K extends keyof FilterSettings>(key: K, value: FilterSettings[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => {
    setFilters({
      brightness: 0,
      contrast: 0,
      saturation: 1,
      exposure: 0,
      clarity: 0,
      grayscale: false,
      autoEnhance: false,
      preset: 'original',
    });
  }, []);

  const applyAndSave = useCallback(
    async (
      imageUri: string,
      newFilters?: Partial<FilterSettings>
    ): Promise<{ uri: string; filters: FilterSettings } | null> => {
      const result = await applyFilters(imageUri, newFilters);
      if (!result) return null;
      const activeFilters = newFilters ? { ...filters, ...newFilters } : filters;
      return { uri: result, filters: activeFilters };
    },
    [applyFilters, filters]
  );

  return {
    filters,
    isProcessing,
    applyFilters,
    updateFilter,
    resetFilters,
    applyAndSave,
  };
};