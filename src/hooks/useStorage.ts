import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';

export interface StoragePermissions {
  mediaLibrary: boolean;
  camera: boolean;
  imagePicker: boolean;
}

export const useStorage = () => {
  const [permissions, setPermissions] = useState<StoragePermissions>({
    mediaLibrary: false,
    camera: false,
    imagePicker: false,
  });
  const [loading, setLoading] = useState(false);

  // Check current permission status on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPermissions({ mediaLibrary: true, camera: true, imagePicker: true });
      return;
    }

    const [mediaStatus, cameraStatus, pickerStatus] = await Promise.all([
      MediaLibrary.getPermissionsAsync(),
      ImagePicker.getCameraPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ]);

    setPermissions({
      mediaLibrary: mediaStatus.granted,
      camera: cameraStatus.granted,
      imagePicker: pickerStatus.granted,
    });
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<StoragePermissions> => {
    if (Platform.OS === 'web') {
      const result = { mediaLibrary: true, camera: true, imagePicker: true };
      setPermissions(result);
      return result;
    }

    setLoading(true);
    try {
      const [mediaStatus, cameraStatus, pickerStatus] = await Promise.all([
        MediaLibrary.requestPermissionsAsync(),
        ImagePicker.requestCameraPermissionsAsync(),
        ImagePicker.requestMediaLibraryPermissionsAsync(),
      ]);

      const result: StoragePermissions = {
        mediaLibrary: mediaStatus.granted,
        camera: cameraStatus.granted,
        imagePicker: pickerStatus.granted,
      };

      setPermissions(result);

      // Warn if any permission was denied
      const denied: string[] = [];
      if (!result.mediaLibrary) denied.push('Photo Library');
      if (!result.camera) denied.push('Camera');
      if (!result.imagePicker) denied.push('Media Import');

      if (denied.length > 0) {
        Alert.alert(
          'Permissions Required',
          `The following permissions were denied: ${denied.join(', ')}.\n\nSome features may not work. Go to Settings → Bamania's Scanner to enable them.`,
          [{ text: 'OK' }]
        );
      }

      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { granted } = await MediaLibrary.requestPermissionsAsync();
    setPermissions(prev => ({ ...prev, mediaLibrary: granted }));
    return granted;
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    setPermissions(prev => ({ ...prev, camera: granted }));
    return granted;
  }, []);

  const requestImagePickerPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPermissions(prev => ({ ...prev, imagePicker: granted }));
    return granted;
  }, []);

  /**
   * Save an image URI to the device media library (Camera Roll / Gallery)
   */
  const saveImageToGallery = useCallback(async (uri: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // Web: trigger download
      const link = document.createElement('a');
      link.href = uri;
      link.download = `scan_${Date.now()}.jpg`;
      link.click();
      return true;
    }

    const hasPermission = permissions.mediaLibrary || await requestMediaLibraryPermission();
    if (!hasPermission) return false;

    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    } catch (err) {
      console.error('Failed to save image to gallery:', err);
      return false;
    }
  }, [permissions.mediaLibrary, requestMediaLibraryPermission]);

  /**
   * Pick images from the device library
   */
  const pickImagesFromLibrary = useCallback(async (allowMultiple = true): Promise<string[]> => {
    const hasPermission = permissions.imagePicker || await requestImagePickerPermission();
    if (!hasPermission) return [];

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: allowMultiple,
        quality: 1,
        selectionLimit: allowMultiple ? 20 : 1,
      });

      if (result.canceled) return [];
      return result.assets.map(a => a.uri);
    } catch (err) {
      console.error('Failed to pick images:', err);
      return [];
    }
  }, [permissions.imagePicker, requestImagePickerPermission]);

  return {
    permissions,
    loading,
    checkPermissions,
    requestAllPermissions,
    requestMediaLibraryPermission,
    requestCameraPermission,
    requestImagePickerPermission,
    saveImageToGallery,
    pickImagesFromLibrary,
  };
};
