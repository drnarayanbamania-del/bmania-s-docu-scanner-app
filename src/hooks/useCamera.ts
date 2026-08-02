import { useState, useCallback, useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../context/AppContext';

export const useCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const { setCameraPermission, setScanning } = useApp();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('auto');
  const [zoom, setZoom] = useState(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (permission !== null) {
      setCameraPermission(permission.granted);
    }
  }, [permission, setCameraPermission]);

  const toggleFacing = useCallback(() => {
    setFacing(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const toggleFlash = useCallback(() => {
    setFlash(prev => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      return 'off';
    });
  }, []);

  const handleZoom = useCallback((value: number) => {
    setZoom(clamp(value, 0, 1));
  }, []);

  const handleFocus = useCallback((point: { x: number; y: number }) => {
    setFocusPoint(point);
  }, []);

  const takePicture = useCallback(async (camera: CameraView | null): Promise<string | null> => {
    if (!camera || isProcessing) return null;
    
    setIsProcessing(true);
    setScanning(true);
    
    try {
      const photo = await camera.takePictureAsync({
        quality: 1,
        base64: false,
        exif: true,
        onPictureSaved: () => {},
      });
      
      setScanning(false);
      setIsProcessing(false);
      return photo.uri;
    } catch (error) {
      console.error('Failed to take picture:', error);
      setScanning(false);
      setIsProcessing(false);
      return null;
    }
  }, [isProcessing, setScanning]);

  return {
    permission,
    requestPermission,
    facing,
    setFacing: toggleFacing,
    flash,
    setFlash: toggleFlash,
    zoom,
    setZoom: handleZoom,
    focusPoint,
    setFocusPoint: handleFocus,
    isProcessing,
    takePicture,
  };
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};