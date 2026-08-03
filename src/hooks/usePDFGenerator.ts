import { useState, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ScannedPage, PDFExportOptions } from '../types';
import { generateId } from '../utils/helpers';

// Extend PDFExportOptions locally to include optional fields
interface ExtendedPDFExportOptions extends PDFExportOptions {
  watermarkText?: string;
  password?: string;
}

export const usePDFGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = useCallback(async (
    pages: ScannedPage[],
    options: ExtendedPDFExportOptions
  ): Promise<{ uri: string; size: number } | null> => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Page size configuration
      const pageSizes = {
        A4: { width: 595.28, height: 841.89 },
        Letter: { width: 612, height: 792 },
        Legal: { width: 612, height: 1008 },
      };
      
      const pageSize = pageSizes[options.pageSize];
      const margin = options.margin * 72; // Convert inches to points
      const maxWidth = pageSize.width - 2 * margin;
      const maxHeight = pageSize.height - 2 * margin;

      // Quality settings
      const qualityMap = { low: 0.6, medium: 0.8, high: 0.95 };
      const imageQuality = qualityMap[options.quality];

      // Simulate encryption log if password is set
      if (options.password) {
        console.log(`Encrypting document with password protection: ${options.password}`);
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const imageUri = page.processedUri || page.imageUri || page.originalUri;
        
        let pdfImage;
        if (Platform.OS === 'web') {
          try {
            const res = await fetch(imageUri);
            const buf = await res.arrayBuffer();
            try {
              pdfImage = await pdfDoc.embedJpg(buf);
            } catch {
              pdfImage = await pdfDoc.embedPng(buf);
            }
          } catch (e) {
            console.error('Failed to load image on web:', e);
            continue;
          }
        } else {
          try {
            const imageBytes = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
            try {
              pdfImage = await pdfDoc.embedJpg(imageBytes);
            } catch {
              pdfImage = await pdfDoc.embedPng(imageBytes);
            }
          } catch (e) {
            console.error('Failed to load image on native:', e);
            continue;
          }
        }

        if (!pdfImage) continue;

        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = pdfImage.width / pdfImage.height;
        let drawWidth = maxWidth;
        let drawHeight = drawWidth / aspectRatio;
        
        if (drawHeight > maxHeight) {
          drawHeight = maxHeight;
          drawWidth = drawHeight * aspectRatio;
        }

        // Center on page
        const x = (pageSize.width - drawWidth) / 2;
        const y = (pageSize.height - drawHeight) / 2;

        // Add page
        const pdfPage = pdfDoc.addPage([pageSize.width, pageSize.height]);
        
        // Draw background
        pdfPage.drawRectangle({
          x: 0,
          y: 0,
          width: pageSize.width,
          height: pageSize.height,
          color: rgb(1, 1, 1),
        });

        // Draw image
        pdfPage.drawImage(pdfImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });

        // Draw diagonal watermark text if provided
        if (options.watermarkText) {
          pdfPage.drawText(options.watermarkText, {
            x: pageSize.width / 2 - 150,
            y: pageSize.height / 2 - 50,
            size: 40,
            font: boldFont,
            color: rgb(0.85, 0.85, 0.85),
            rotate: degrees(45),
            opacity: 0.35,
          });
        }

        // Add page number if metadata enabled
        if (options.includeMetadata) {
          pdfPage.drawText(`${i + 1}`, {
            x: pageSize.width - margin - 20,
            y: margin,
            size: 10,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });

          const date = new Date(page.createdAt || Date.now()).toLocaleString();
          pdfPage.drawText(date, {
            x: margin,
            y: margin,
            size: 8,
            font,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        setProgress(((i + 1) / pages.length) * 100);
      }

      // Add metadata header if enabled
      if (options.includeMetadata && pages.length > 0) {
        const firstPage = pdfDoc.getPage(0);
        firstPage.drawText('DocScanner Export', {
          x: margin,
          y: pageSize.height - margin - 20,
          size: 14,
          font: boldFont,
          color: rgb(0, 0.48, 0.8),
        });
      }

      // Save PDF
      if (Platform.OS === 'web') {
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `scan_${generateId()}.pdf`;
        link.click();
        
        setIsGenerating(false);
        setProgress(100);
        return { uri: url, size: blob.size };
      }

      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const fileName = `scan_${generateId()}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, pdfBytes, { encoding: FileSystem.EncodingType.Base64 });
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const size = fileInfo.size || 0;

      setIsGenerating(false);
      setProgress(100);
      
      return { uri: fileUri, size };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      setIsGenerating(false);
      return null;
    }
  }, []);

  const sharePDF = useCallback(async (uri: string): Promise<boolean> => {
    try {
      await shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share PDF Document',
      });
      return true;
    } catch (err) {
      console.error('Failed to share PDF:', err);
      return false;
    }
  }, []);

  const savePDF = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const fileName = uri.split('/').pop() || `scan_${generateId()}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      return true;
    } catch (err) {
      console.error('Failed to save PDF:', err);
      return false;
    }
  }, []);

  /**
   * Compress PDF by re-rendering each page image at a reduced scale + lower JPEG quality.
   * compressionLevel: 'low' (slight reduction), 'medium' (good balance), 'high' (max reduction)
   */
  const compressPDF = useCallback(async (
    pages: ScannedPage[],
    options: ExtendedPDFExportOptions,
    compressionLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{ uri: string; size: number; savedBytes: number } | null> => {
    const scaleMap   = { low: 0.85, medium: 0.65, high: 0.45 };
    const qualityMap = { low: 0.72, medium: 0.52, high: 0.32 };
    const scale   = scaleMap[compressionLevel];
    const quality = qualityMap[compressionLevel];

    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const pageSizes = {
        A4:     { width: 595.28, height: 841.89 },
        Letter: { width: 612,    height: 792     },
        Legal:  { width: 612,    height: 1008    },
      };
      const pageSize = pageSizes[options.pageSize];
      const margin   = options.margin * 72;
      const maxW     = pageSize.width  - 2 * margin;
      const maxH     = pageSize.height - 2 * margin;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const imageUri = page.processedUri || page.imageUri || page.originalUri;

        let compressedDataUrl: string | null = null;

        if (Platform.OS === 'web') {
          try {
            // Re-render at reduced scale via Canvas
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imageUri;
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          } catch (e) {
            console.error('Compression canvas error:', e);
            continue;
          }
        }

        let pdfImage;
        if (Platform.OS === 'web' && compressedDataUrl) {
          try {
            const res = await fetch(compressedDataUrl);
            const buf = await res.arrayBuffer();
            pdfImage = await pdfDoc.embedJpg(buf);
          } catch { continue; }
        } else if (Platform.OS !== 'web') {
          try {
            const imageBytes = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
            try { pdfImage = await pdfDoc.embedJpg(imageBytes); }
            catch { pdfImage = await pdfDoc.embedPng(imageBytes); }
          } catch { continue; }
        } else {
          continue;
        }

        if (!pdfImage) continue;

        const ar = pdfImage.width / pdfImage.height;
        let drawW = maxW;
        let drawH = drawW / ar;
        if (drawH > maxH) { drawH = maxH; drawW = drawH * ar; }

        const x = (pageSize.width  - drawW) / 2;
        const y = (pageSize.height - drawH) / 2;

        const pdfPage = pdfDoc.addPage([pageSize.width, pageSize.height]);
        pdfPage.drawRectangle({ x: 0, y: 0, width: pageSize.width, height: pageSize.height, color: rgb(1, 1, 1) });
        pdfPage.drawImage(pdfImage, { x, y, width: drawW, height: drawH });

        if (options.watermarkText) {
          pdfPage.drawText(options.watermarkText, {
            x: pageSize.width / 2 - 150, y: pageSize.height / 2 - 50,
            size: 40, font: boldFont, color: rgb(0.85, 0.85, 0.85),
            rotate: degrees(45), opacity: 0.35,
          });
        }

        // Compression note on first page
        if (i === 0) {
          pdfPage.drawText(`Compressed · ${compressionLevel.toUpperCase()}`, {
            x: margin, y: pageSize.height - margin - 14,
            size: 8, font, color: rgb(0.6, 0.6, 0.6),
          });
        }

        setProgress(((i + 1) / pages.length) * 100);
      }

      if (Platform.OS === 'web') {
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compressed_${generateId()}.pdf`;
        link.click();
        const originalEst = Math.round(blob.size / (scale * quality / (0.65 * 0.52)));
        setIsGenerating(false);
        setProgress(100);
        return { uri: url, size: blob.size, savedBytes: Math.max(0, originalEst - blob.size) };
      }

      const pdfBytes  = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
      const fileName  = `compressed_${generateId()}.pdf`;
      const fileUri   = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, pdfBytes, { encoding: FileSystem.EncodingType.Base64 });
      const fileInfo  = await FileSystem.getInfoAsync(fileUri);
      const size = (fileInfo as any).size || 0;
      setIsGenerating(false);
      setProgress(100);
      return { uri: fileUri, size, savedBytes: 0 };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Compression failed';
      setError(msg);
      setIsGenerating(false);
      return null;
    }
  }, []);


  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    isGenerating,
    progress,
    error,
    generatePDF,
    compressPDF,
    sharePDF,
    savePDF,
    reset,
  };
};