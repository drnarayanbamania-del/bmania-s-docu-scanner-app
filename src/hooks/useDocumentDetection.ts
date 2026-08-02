import { useState, useCallback, useRef, useEffect } from 'react';
import { Image } from 'react-native';

export interface Quadrilateral {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export const useDocumentDetection = () => {
  const [detectedQuad, setDetectedQuad] = useState<Quadrilateral | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const detectDocument = useCallback(async (imageUri: string): Promise<Quadrilateral | null> => {
    setIsDetecting(true);
    
    try {
      // Load image
      const img = new Image();
      img.src = imageUri;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      imageRef.current = img;
      
      // Create canvas for processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // Get image data for edge detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const edges = detectEdges(imageData);
      const quad = findDocumentQuadrilateral(edges, canvas.width, canvas.height);
      
      if (quad) {
        setDetectedQuad(quad);
        setConfidence(calculateConfidence(quad, imageData));
      }
      
      setIsDetecting(false);
      return quad;
    } catch (error) {
      console.error('Document detection failed:', error);
      setIsDetecting(false);
      return null;
    }
  }, []);

  const detectEdges = (imageData: ImageData): Float32Array => {
    const { data, width, height } = imageData;
    const edges = new Float32Array(width * height);
    
    // Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Convert to grayscale
        const getGray = (px: number, py: number) => {
          const i = (py * width + px) * 4;
          return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        };
        
        const gx = 
          -getGray(x - 1, y - 1) + getGray(x + 1, y - 1)
          -2 * getGray(x - 1, y) + 2 * getGray(x + 1, y)
          -getGray(x - 1, y + 1) + getGray(x + 1, y + 1);
          
        const gy = 
          -getGray(x - 1, y - 1) - 2 * getGray(x, y - 1) - getGray(x + 1, y - 1)
          + getGray(x - 1, y + 1) + 2 * getGray(x, y + 1) + getGray(x + 1, y + 1);
        
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    
    return edges;
  };

  const findDocumentQuadrilateral = (edges: Float32Array, width: number, height: number): Quadrilateral | null => {
    // Simplified document detection - find largest rectangular contour
    // In production, use OpenCV or ML-based detection
    
    const threshold = 50;
    const points: { x: number; y: number }[] = [];
    
    // Find edge points
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        if (edges[y * width + x] > threshold) {
          points.push({ x, y });
        }
      }
    }
    
    if (points.length < 4) return null;
    
    // Find convex hull and approximate to quadrilateral
    const hull = convexHull(points);
    const quad = approximateQuadrilateral(hull);
    
    return quad;
  };

  const convexHull = (points: { x: number; y: number }[]): { x: number; y: number }[] => {
    // Graham scan algorithm
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => 
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    
    const lower: { x: number; y: number }[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    
    const upper: { x: number; y: number }[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
  };

  const approximateQuadrilateral = (hull: { x: number; y: number }[]): Quadrilateral | null => {
    if (hull.length < 4) return null;
    
    // Find the four corners using Ramer-Douglas-Peucker or simple bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (const p of hull) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    
    // Find closest points to corners
    const corners = [
      { target: { x: minX, y: minY }, name: 'topLeft' },
      { target: { x: maxX, y: minY }, name: 'topRight' },
      { target: { x: minX, y: maxY }, name: 'bottomLeft' },
      { target: { x: maxX, y: maxY }, name: 'bottomRight' },
    ];
    
    const result: Partial<Quadrilateral> = {};
    for (const corner of corners) {
      let closest = hull[0];
      let minDist = Infinity;
      for (const p of hull) {
        const dist = Math.hypot(p.x - corner.target.x, p.y - corner.target.y);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      }
      result[corner.name as keyof Quadrilateral] = closest;
    }
    
    return result as Quadrilateral;
  };

  const calculateConfidence = (quad: Quadrilateral, imageData: ImageData): number => {
    // Calculate confidence based on edge strength at corners
    const corners = [quad.topLeft, quad.topRight, quad.bottomLeft, quad.bottomRight];
    let totalStrength = 0;
    
    for (const corner of corners) {
      const idx = (Math.round(corner.y) * imageData.width + Math.round(corner.x)) * 4;
      if (idx < imageData.data.length) {
        const gray = 0.299 * imageData.data[idx] + 0.587 * imageData.data[idx + 1] + 0.114 * imageData.data[idx + 2];
        totalStrength += gray / 255;
      }
    }
    
    return Math.min(1, totalStrength / 4);
  };

  const correctPerspective = useCallback(async (
    imageUri: string,
    quad: Quadrilateral,
    outputWidth: number,
    outputHeight: number
  ): Promise<string | null> => {
    try {
      const img = new Image();
      img.src = imageUri;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      
      // Define destination points (rectangle)
      const dst = [
        { x: 0, y: 0 },
        { x: outputWidth, y: 0 },
        { x: 0, y: outputHeight },
        { x: outputWidth, y: outputHeight },
      ];
      
      const src = [
        quad.topLeft,
        quad.topRight,
        quad.bottomLeft,
        quad.bottomRight,
      ];
      
      // Calculate perspective transform matrix
      const matrix = getPerspectiveTransform(src, dst);
      
      // Apply transform
      ctx.save();
      ctx.transform(
        matrix[0], matrix[1],
        matrix[3], matrix[4],
        matrix[6], matrix[7]
      );
      ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
      ctx.restore();
      
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (error) {
      console.error('Perspective correction failed:', error);
      return null;
    }
  }, []);

  const getPerspectiveTransform = (
    src: { x: number; y: number }[],
    dst: { x: number; y: number }[]
  ): number[] => {
    // Solve for 3x3 homography matrix using DLT
    const A: number[][] = [];
    const b: number[] = [];
    
    for (let i = 0; i < 4; i++) {
      const [x, y] = [src[i].x, src[i].y];
      const [u, v] = [dst[i].x, dst[i].y];
      
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(u);
      b.push(v);
    }
    
    // Solve linear system A*h = b
    const h = solveLinearSystem(A, b);
    return [...h, 1]; // h8 = 1
  };

  const solveLinearSystem = (A: number[][], b: number[]): number[] => {
    const n = A[0].length;
    const m = A.length;
    
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);
    
    // Gaussian elimination
    for (let col = 0; col < n; col++) {
      // Find pivot
      let pivot = col;
      for (let row = col + 1; row < m; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) {
          pivot = row;
        }
      }
      
      // Swap rows
      [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
      
      // Normalize pivot row
      const pivotVal = aug[col][col];
      if (Math.abs(pivotVal) < 1e-10) continue;
      for (let j = col; j <= n; j++) {
        aug[col][j] /= pivotVal;
      }
      
      // Eliminate other rows
      for (let row = 0; row < m; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
    
    return aug.slice(0, n).map(row => row[n]);
  };

  const reset = useCallback(() => {
    setDetectedQuad(null);
    setConfidence(0);
  }, []);

  return {
    detectedQuad,
    confidence,
    isDetecting,
    detectDocument,
    correctPerspective,
    reset,
  };
};