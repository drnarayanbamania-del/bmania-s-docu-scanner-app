import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useCamera } from '../../hooks/useCamera';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';

export const CameraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);
  const { currentProject, addScannedPages, createProject, setCurrentProject } = useApp();
  const { showToast } = useToast();

  const {
    permission,
    requestPermission,
    facing,
    setFacing,
    flash,
    setFlash,
    takePicture,
    isProcessing,
  } = useCamera();

  // New Scanner States
  const [scanMode, setScanMode] = useState<'document' | 'barcode'>('document');
  const [captureMode, setCaptureMode] = useState<'manual' | 'auto'>('manual');
  const [scanningMode, setScanningMode] = useState<'single' | 'batch'>('single');
  
  // Temporary pages tray for batch scanning
  const [batchPages, setBatchPages] = useState<string[]>([]);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);

  // Auto-capture simulation logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (captureMode === 'auto' && !isProcessing) {
      setAutoCaptureCountdown(3);
      const countdownInterval = setInterval(() => {
        setAutoCaptureCountdown(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Trigger capture
            handleCapture();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(countdownInterval);
        setAutoCaptureCountdown(null);
      };
    } else {
      setAutoCaptureCountdown(null);
    }
  }, [captureMode, scanMode]);

  const handleCapture = async () => {
    if (scanMode === 'barcode') {
      // Simulate Barcode/QR code reader
      const codes = [
        'https://supabase.com/docs/guides/auth',
        'ISBN 978-0-13-235088-4 (Clean Code)',
        'UPC 019028308472',
        'QR: WiFi_Network;WPA;SecretPassphrase',
        'https://expo.dev',
      ];
      const randomCode = codes[Math.floor(Math.random() * codes.length)];
      if (Platform.OS === 'web') {
        window.alert(`Barcode / QR Code Detected!\n\nContent:\n"${randomCode}"\n\nCopied to Clipboard.`);
      } else {
        showToast(`Code Detected: ${randomCode}`, 'success');
      }
      return;
    }

    let uri = '';
    if (Platform.OS === 'web') {
      // Mock capture on Web with a set of high-quality sample document images
      const samples = [
        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80', // Document
        'https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=800&auto=format&fit=crop&q=80', // Invoice/List
        'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&auto=format&fit=crop&q=80', // Text letter
      ];
      uri = samples[batchPages.length % samples.length];
    } else {
      if (cameraRef.current) {
        const picUri = await takePicture(cameraRef.current);
        if (picUri) uri = picUri;
      }
    }

    if (!uri) return;

    if (scanningMode === 'batch') {
      setBatchPages(prev => [...prev, uri]);
      showToast(`Page ${batchPages.length + 1} captured in batch`, 'success');
      // If auto capture was on, restart countdown
      if (captureMode === 'auto') {
        setAutoCaptureCountdown(3);
      }
    } else {
      navigation.navigate('Review', { imageUri: uri });
    }
  };

  const handleSelectWebFile = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (scanningMode === 'batch') {
        setBatchPages(prev => [...prev, result.assets[0].uri]);
        showToast('Page added to batch', 'success');
      } else {
        navigation.navigate('Review', { imageUri: result.assets[0].uri });
      }
    }
  };

  const handleFinishBatch = async () => {
    if (batchPages.length === 0) return;

    try {
      let proj = currentProject;
      if (!proj) {
        const title = `Scan ${new Date().toLocaleDateString()}`;
        proj = await createProject(title);
        if (proj) {
          setCurrentProject(proj);
        }
      }

      if (!proj) {
        showToast('Failed to create document', 'error');
        return;
      }

      const newPages = batchPages.map((uri, idx) => ({
        originalUri: uri,
        imageUri: uri,
        processedUri: uri,
        order: (proj?.pageCount || 0) + idx,
      }));

      await addScannedPages(proj.id, newPages);
      showToast(`Batch added: ${batchPages.length} pages saved!`, 'success');
      
      navigation.replace('Main', {
        screen: 'Dashboard',
        params: {
          screen: 'ProjectDetail',
          params: { projectId: proj.id }
        }
      });
    } catch (e) {
      console.error(e);
      showToast('Failed to save batch pages', 'error');
    }
  };

  // Rendering for Web Simulation
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {/* Top Control Bar */}
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.webTitle}>
            {scanMode === 'document' ? 'Document Scan Viewfinder' : 'Barcode & QR Reader'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Viewfinder Target */}
        <View style={styles.viewfinderMock}>
          {scanMode === 'document' ? (
            <View style={styles.targetBox}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              <Text style={styles.positionText}>
                {autoCaptureCountdown !== null ? `Auto-capturing in ${autoCaptureCountdown}...` : 'Align Document inside corners'}
              </Text>
            </View>
          ) : (
            <View style={styles.barcodeTargetBox}>
              <View style={styles.barcodeLaser} />
              <Text style={styles.barcodePositionText}>Align Barcode / QR Code inside box</Text>
            </View>
          )}

          {/* Batch count overlay badge */}
          {scanningMode === 'batch' && batchPages.length > 0 && (
            <View style={styles.batchBadge}>
              <Text style={styles.batchBadgeText}>{batchPages.length} Scans in Tray</Text>
            </View>
          )}
        </View>

        {/* Feature Selectors panel */}
        <View style={styles.featuresPanel}>
          {/* Scan Type selection */}
          <View style={styles.featureGroup}>
            <Text style={styles.groupLabel}>Type:</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity style={[styles.pillBtn, scanMode === 'document' && styles.pillBtnActive]} onPress={() => setScanMode('document')}>
                <Text style={[styles.pillText, scanMode === 'document' && styles.pillTextActive]}>Doc</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, scanMode === 'barcode' && styles.pillBtnActive]} onPress={() => setScanMode('barcode')}>
                <Text style={[styles.pillText, scanMode === 'barcode' && styles.pillTextActive]}>QR/Barcode</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shutter Capture mode */}
          <View style={styles.featureGroup}>
            <Text style={styles.groupLabel}>Capture:</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity style={[styles.pillBtn, captureMode === 'manual' && styles.pillBtnActive]} onPress={() => setCaptureMode('manual')}>
                <Text style={[styles.pillText, captureMode === 'manual' && styles.pillTextActive]}>Manual</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, captureMode === 'auto' && styles.pillBtnActive]} onPress={() => setCaptureMode('auto')}>
                <Text style={[styles.pillText, captureMode === 'auto' && styles.pillTextActive]}>Auto</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Single vs Multi page scan */}
          <View style={styles.featureGroup}>
            <Text style={styles.groupLabel}>Mode:</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity style={[styles.pillBtn, scanningMode === 'single' && styles.pillBtnActive]} onPress={() => setScanningMode('single')}>
                <Text style={[styles.pillText, scanningMode === 'single' && styles.pillTextActive]}>Single</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pillBtn, scanningMode === 'batch' && styles.pillBtnActive]} onPress={() => setScanningMode('batch')}>
                <Text style={[styles.pillText, scanningMode === 'batch' && styles.pillTextActive]}>Batch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Shutter Controls */}
        <View style={styles.webControls}>
          <TouchableOpacity style={styles.webUploadBtn} onPress={handleSelectWebFile}>
            <Ionicons name="images-outline" size={26} color="#FFF" />
            <Text style={styles.webUploadText}>Upload</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <View style={[styles.captureInner, scanMode === 'barcode' && { backgroundColor: Theme.colors.status.error }]} />
          </TouchableOpacity>

          {scanningMode === 'batch' && batchPages.length > 0 ? (
            <TouchableOpacity style={styles.finishBatchBtn} onPress={handleFinishBatch}>
              <Ionicons name="checkmark-done" size={24} color="#FFF" />
              <Text style={styles.finishBatchText}>Finish</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
      </View>
    );
  }

  // Native iOS / Android rendering using expo-camera
  if (!permission) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission}>Grant Permission</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        ref={cameraRef}
        facing={facing}
        flash={flash === 'on' ? 'on' : flash === 'off' ? 'off' : 'auto'}
      >
        <View style={styles.cameraOverlay}>
          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            
            <View style={styles.rightTopControls}>
              <TouchableOpacity onPress={setFlash} style={styles.iconButton}>
                <Ionicons
                  name={flash === 'on' ? 'flash' : flash === 'off' ? 'flash-off' : 'flash-outline'}
                  size={24}
                  color="#FFF"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={setFacing} style={[styles.iconButton, { marginLeft: 16 }]}>
                <Ionicons name="camera-reverse" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Overlay targets */}
          {scanMode === 'document' ? (
            <View style={styles.detectArea}>
              <View style={styles.detectBox}>
                {autoCaptureCountdown !== null && (
                  <Text style={styles.countdownOverlayText}>Capturing in {autoCaptureCountdown}s...</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.detectArea}>
              <View style={styles.barcodeTargetBox}>
                <View style={styles.barcodeLaser} />
              </View>
            </View>
          )}

          {/* Custom controls tray */}
          <View style={styles.nativeTray}>
            <TouchableOpacity onPress={() => setScanMode(prev => prev === 'document' ? 'barcode' : 'document')} style={styles.trayButton}>
              <Ionicons name={scanMode === 'document' ? 'qr-code-outline' : 'document-text-outline'} size={24} color="#FFF" />
              <Text style={styles.trayBtnText}>{scanMode === 'document' ? 'QR Code' : 'Doc Scan'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCaptureMode(prev => prev === 'manual' ? 'auto' : 'manual')} style={styles.trayButton}>
              <Ionicons name={captureMode === 'manual' ? 'sparkles-outline' : 'hand-left-outline'} size={24} color="#FFF" />
              <Text style={styles.trayBtnText}>{captureMode === 'manual' ? 'Auto-Cap' : 'Manual'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setScanningMode(prev => prev === 'single' ? 'batch' : 'single')} style={styles.trayButton}>
              <Ionicons name={scanningMode === 'single' ? 'copy-outline' : 'document-outline'} size={24} color="#FFF" />
              <Text style={styles.trayBtnText}>{scanningMode === 'single' ? 'Batch' : 'Single'}</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Shutter row */}
          <View style={styles.bottomControls}>
            <View style={{ width: 64 }} />
            <TouchableOpacity
              style={[styles.captureButton, isProcessing && styles.captureDisabled]}
              onPress={handleCapture}
              disabled={isProcessing}
            >
              <View style={[styles.captureInner, scanMode === 'barcode' && { backgroundColor: Theme.colors.status.error }]} />
            </TouchableOpacity>

            {scanningMode === 'batch' && batchPages.length > 0 ? (
              <TouchableOpacity style={styles.nativeFinishBatch} onPress={handleFinishBatch}>
                <View style={styles.nativeBadge}>
                  <Text style={styles.nativeBadgeText}>{batchPages.length}</Text>
                </View>
                <Ionicons name="checkmark-done" size={26} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 64 }} />
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    ...Theme.textStyles.bodyLarge,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightTopControls: {
    flexDirection: 'row',
  },
  iconButton: {
    padding: Theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  detectArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detectBox: {
    width: '85%',
    height: '65%',
    borderWidth: 2,
    borderColor: Theme.colors.ocean[500],
    borderRadius: Theme.borderRadius.md,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownOverlayText: {
    color: '#FFF',
    ...Theme.textStyles.h2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.md,
  },
  nativeTray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Theme.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: Theme.borderRadius.md,
    marginVertical: Theme.spacing.sm,
  },
  trayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  trayBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  captureDisabled: {
    opacity: 0.5,
  },
  nativeFinishBatch: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Theme.colors.ocean[500],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nativeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Theme.colors.status.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Web specific simulation styles
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    height: 96,
    backgroundColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  webTitle: {
    color: '#FFF',
    ...Theme.textStyles.bodyLarge,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  viewfinderMock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    position: 'relative',
  },
  targetBox: {
    width: '80%',
    height: '65%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeTargetBox: {
    width: '75%',
    height: '35%',
    borderWidth: 2,
    borderColor: Theme.colors.status.error,
    borderRadius: Theme.borderRadius.md,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  barcodeLaser: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Theme.colors.status.error,
    top: '50%',
    shadowColor: Theme.colors.status.error,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Theme.colors.ocean[500],
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  positionText: {
    color: Theme.colors.ocean[500],
    fontSize: 14,
    fontFamily: Theme.typography.fontFamilies.bold,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.md,
  },
  barcodePositionText: {
    color: Theme.colors.status.error,
    fontSize: 12,
    fontFamily: Theme.typography.fontFamilies.medium,
    textAlign: 'center',
    position: 'absolute',
    bottom: Theme.spacing.sm,
  },
  batchBadge: {
    position: 'absolute',
    top: Theme.spacing.md,
    backgroundColor: Theme.colors.ocean[500],
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    ...Theme.shadows.md,
  },
  batchBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  featuresPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Theme.spacing.md,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  featureGroup: {
    alignItems: 'center',
  },
  groupLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontFamily: Theme.typography.fontFamilies.medium,
    marginBottom: 4,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: Theme.borderRadius.sm,
    padding: 2,
  },
  pillBtn: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.sm - 2,
  },
  pillBtnActive: {
    backgroundColor: '#FFF',
  },
  pillText: {
    color: '#8E8E93',
    fontSize: 11,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  pillTextActive: {
    color: '#000',
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  webControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 120,
    backgroundColor: '#151515',
    paddingHorizontal: 20,
  },
  webUploadBtn: {
    alignItems: 'center',
    width: 80,
  },
  webUploadText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: Theme.typography.fontFamilies.medium,
    marginTop: 4,
  },
  finishBatchBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.md,
    width: 76,
    height: 52,
    gap: 2,
    ...Theme.shadows.md,
  },
  finishBatchText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
});
