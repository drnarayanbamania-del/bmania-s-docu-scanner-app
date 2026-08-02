import { useState, useCallback, useRef } from 'react';
import { FilterSettings } from '../types';

export const useImageFilters = () => {
  const [filters, setFilters] = useState<FilterSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 1,
    grayscale: false,
    autoEnhance: false,
    preset: 'original',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fast downsample blur to approximate background illumination (for shadow removal)
  const getBackgroundIllumination = (img: HTMLImageElement, width: number, height: number): Uint8ClampedArray => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Scale down significantly to blur high-frequency details, keeping only low-frequency illumination
    const scale = 16;
    tempCanvas.width = Math.max(1, Math.round(width / scale));
    tempCanvas.height = Math.max(1, Math.round(height / scale));
    
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
    const lowResData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
    
    // Create an interpolated grid
    const illum = new Uint8ClampedArray(width * height);
    const lw = tempCanvas.width;
    const lh = tempCanvas.height;
    
    for (let y = 0; y < height; y++) {
      const ly = Math.min(lh - 1, Math.floor(y / scale));
      for (let x = 0; x < width; x++) {
        const lx = Math.min(lw - 1, Math.floor(x / scale));
        const index = (ly * lw + lx) * 4;
        // Return average luminance of the low-res block
        illum[y * width + x] = 0.299 * lowResData[index] + 0.587 * lowResData[index + 1] + 0.114 * lowResData[index + 2];
      }
    }
    
    return illum;
  };

  // 3x3 Convolution filter
  const convolve = (imageData: ImageData, weights: number[]): ImageData => {
    const src = imageData.data;
    const sw = imageData.width;
    const sh = imageData.height;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const output = ctx.createImageData(sw, sh);
    const dst = output.data;

    // Sharpen / noise-removal kernel side size
    const side = 3;
    const halfSide = 1;

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const dstOff = (y * sw + x) * 4;
        let r = 0, g = 0, b = 0;
        
        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = Math.min(sh - 1, Math.max(0, y + cy - halfSide));
            const scx = Math.min(sw - 1, Math.max(0, x + cx - halfSide));
            const srcOff = (scy * sw + scx) * 4;
            const wt = weights[cy * side + cx];
            
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
        
        dst[dstOff] = Math.max(0, Math.min(255, r));
        dst[dstOff + 1] = Math.max(0, Math.min(255, g));
        dst[dstOff + 2] = Math.max(0, Math.min(255, b));
        dst[dstOff + 3] = src[dstOff + 3]; // Keep alpha
      }
    }
    
    return output;
  };

  const applyFilters = useCallback(async (
    imageUri: string,
    newFilters?: Partial<FilterSettings>
  ): Promise<string | null> => {
    setIsProcessing(true);
    const activeFilters = newFilters ? { ...filters, ...newFilters } : filters;
    
    try {
      // Load image
      const img = new Image();
      // Allow cross-origin requests for web simulation images
      img.crossOrigin = 'anonymous';
      img.src = imageUri;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original
      ctx.drawImage(img, 0, 0);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Apply preset base enhancement
      const preset = activeFilters.preset || 'original';
      
      if (preset === 'grayscale') {
        applyGrayscale(imageData.data);
      } else if (preset === 'bw') {
        applyAdaptiveThreshold(imageData.data, canvas.width, canvas.height);
      } else if (preset === 'color') {
        applySaturation(imageData.data, 1.6);
        applyContrast(imageData.data, 0.2);
      } else if (preset === 'magic') {
        // Magic Color combines illumination correction (shadow removal), high contrast, and sharpening
        applyIlluminationCorrection(imageData.data, getBackgroundIllumination(img, canvas.width, canvas.height));
        applyContrast(imageData.data, 0.4);
        imageData = convolve(imageData, [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0
        ]);
      } else if (preset === 'hd') {
        // High sharpening kernel convolve
        imageData = convolve(imageData, [
          -1, -1, -1,
          -1,  9, -1,
          -1, -1, -1
        ]);
      } else if (preset === 'shadows') {
        // Flat-field correction to remove background shadows
        applyIlluminationCorrection(imageData.data, getBackgroundIllumination(img, canvas.width, canvas.height));
      } else if (preset === 'noise') {
        // Average smoothing blur convolve
        imageData = convolve(imageData, [
          1/9, 1/9, 1/9,
          1/9, 1/9, 1/9,
          1/9, 1/9, 1/9
        ]);
      }
      
      // Apply Sliders (Brightness, Contrast, Saturation)
      if (activeFilters.brightness !== 0) {
        applyBrightness(imageData.data, activeFilters.brightness);
      }
      if (activeFilters.contrast !== 0) {
        applyContrast(imageData.data, activeFilters.contrast);
      }
      if (activeFilters.saturation !== 1) {
        applySaturation(imageData.data, activeFilters.saturation);
      }
      
      // Put processed data back
      ctx.putImageData(imageData, 0, 0);
      
      // Convert to data URL
      const result = canvas.toDataURL('image/jpeg', 0.9);
      setIsProcessing(false);
      return result;
    } catch (error) {
      console.error('Filter application failed:', error);
      setIsProcessing(false);
      return null;
    }
  }, [filters]);

  // Grayscale filter
  const applyGrayscale = (data: Uint8ClampedArray): void => {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  };

  // Adaptive thresholding for clean B&W document scans
  const applyAdaptiveThreshold = (data: Uint8ClampedArray, w: number, h: number): void => {
    // Convert to grayscale first
    applyGrayscale(data);
    
    // Average threshold
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += data[i];
    }
    const avg = total / (w * h);
    
    // Apply local thresholding
    for (let i = 0; i < data.length; i += 4) {
      const val = data[i] > avg - 10 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
  };

  // Shadow correction: divide original pixels by background illumination
  const applyIlluminationCorrection = (data: Uint8ClampedArray, background: Uint8ClampedArray): void => {
    for (let i = 0; i < data.length; i += 4) {
      const bg = background[i / 4] || 255;
      // division: target = (original / bg) * 240
      data[i] = Math.max(0, Math.min(255, (data[i] / (bg || 1)) * 240));
      data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] / (bg || 1)) * 240));
      data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] / (bg || 1)) * 240));
    }
  };

  // Sliders
  const applyBrightness = (data: Uint8ClampedArray, value: number): void => {
    const factor = value * 255; // -255 to 255
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + factor));
    }
  };

  const applyContrast = (data: Uint8ClampedArray, value: number): void => {
    // Contrast slider ranges from -1 to 1
    const factor = (259 * (value * 255 + 255)) / (255 * (259 - value * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }
  };

  const applySaturation = (data: Uint8ClampedArray, value: number): void => {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = Math.max(0, Math.min(255, gray + value * (r - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + value * (g - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + value * (b - gray)));
    }
  };

  const updateFilter = useCallback(<K extends keyof FilterSettings>(key: K, value: FilterSettings[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      brightness: 0,
      contrast: 0,
      saturation: 1,
      grayscale: false,
      autoEnhance: false,
      preset: 'original',
    });
  }, []);

  const applyAndSave = useCallback(async (
    imageUri: string,
    newFilters?: Partial<FilterSettings>
  ): Promise<{ uri: string; filters: FilterSettings } | null> => {
    const result = await applyFilters(imageUri, newFilters);
    if (!result) return null;
    const activeFilters = newFilters ? { ...filters, ...newFilters } : filters;
    return { uri: result, filters: activeFilters };
  }, [applyFilters, filters]);

  return {
    filters,
    isProcessing,
    applyFilters,
    updateFilter,
    resetFilters,
    applyAndSave,
  };
};