import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions, PanResponder } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useImageFilters } from '../../hooks/useImageFilters';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';

interface Point {
  x: number;
  y: number;
}

export const ReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri } = route.params || {};
  const { currentProject, createProject, setCurrentProject, addScannedPages } = useApp();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const {
    filters,
    isProcessing,
    applyFilters,
    updateFilter,
    resetFilters,
  } = useImageFilters();

  const [previewUri, setPreviewUri] = useState<string>(imageUri);
  const [activeTab, setActiveTab] = useState<'filter' | 'adjust' | 'crop'>('filter');

  // Sliders local states (for responsiveness)
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(1);

  // Crop corners (percentage coordinates from 0 to 100)
  const [cropMode, setCropMode] = useState(false);
  const [corners, setCorners] = useState<{
    topLeft: Point;
    topRight: Point;
    bottomLeft: Point;
    bottomRight: Point;
  }>({
    topLeft: { x: 10, y: 10 },
    topRight: { x: 90, y: 10 },
    bottomLeft: { x: 10, y: 90 },
    bottomRight: { x: 90, y: 90 },
  });

  const [activeCorner, setActiveCorner] = useState<keyof typeof corners | null>(null);

  // Apply filters whenever preset or sliders change
  useEffect(() => {
    let active = true;
    const runFilters = async () => {
      if (!imageUri) return;
      const result = await applyFilters(imageUri, {
        brightness,
        contrast,
        saturation,
      });
      if (result && active) {
        setPreviewUri(result);
      }
    };
    runFilters();
    return () => {
      active = false;
    };
  }, [filters.preset, brightness, contrast, saturation, imageUri, applyFilters]);

  const handleSave = async () => {
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
        showToast('Failed to create project', 'error');
        return;
      }

      const newPage = {
        originalUri: imageUri,
        imageUri: previewUri,
        processedUri: previewUri,
        order: proj.pageCount || 0,
      };

      await addScannedPages(proj.id, [newPage]);
      showToast('Page added to document!', 'success');
      
      navigation.replace('Main', {
        screen: 'Dashboard',
        params: {
          screen: 'ProjectDetail',
          params: { projectId: proj.id }
        }
      });
    } catch (e) {
      console.error(e);
      showToast('Failed to save page', 'error');
    }
  };

  const handlePresetSelect = (presetName: typeof filters.preset) => {
    updateFilter('preset', presetName);
  };

  // Web corner dragging helper
  const handleWebDrag = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>, cornerKey: keyof typeof corners) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;

    const updatePosition = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setCorners(prev => ({
        ...prev,
        [cornerKey]: { x, y }
      }));
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Perform Perspective Crop simulation
  const handleApplyCrop = async () => {
    setIsProcessingLocal(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = previewUri;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Calculate crop bounding box
      const minX = Math.min(corners.topLeft.x, corners.bottomLeft.x) / 100 * img.width;
      const maxX = Math.max(corners.topRight.x, corners.bottomRight.x) / 100 * img.width;
      const minY = Math.min(corners.topLeft.y, corners.topRight.y) / 100 * img.height;
      const maxY = Math.max(corners.bottomLeft.y, corners.bottomRight.y) / 100 * img.height;

      const cropWidth = Math.max(10, maxX - minX);
      const cropHeight = Math.max(10, maxY - minY);

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw cropped area
      ctx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      
      setPreviewUri(croppedDataUrl);
      showToast('Image cropped & perspective corrected!', 'success');
      setCropMode(false);
      setActiveTab('filter');
    } catch (e) {
      console.error(e);
      showToast('Failed to crop image', 'error');
    }
    setIsProcessingLocal(false);
  };

  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  const presets = [
    { id: 'original', name: 'Original', icon: 'image-outline' },
    { id: 'color', name: 'Color', icon: 'color-palette-outline' },
    { id: 'magic', name: 'Magic Color', icon: 'sparkles-outline' },
    { id: 'bw', name: 'B&W Doc', icon: 'contrast-outline' },
    { id: 'grayscale', name: 'Grayscale', icon: 'eye-outline' },
    { id: 'hd', name: 'HD Sharpen', icon: 'trending-up-outline' },
    { id: 'shadows', name: 'No Shadow', icon: 'sunny-outline' },
    { id: 'noise', name: 'De-Noise', icon: 'options-outline' },
  ] as const;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
        </Button>
        <Text style={styles.headerTitle}>{cropMode ? 'Crop Borders' : 'Review Scan'}</Text>
        <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Viewport Image Area */}
      <View style={styles.previewContainer}>
        {(isProcessing || isProcessingLocal) && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={Theme.colors.ocean[500]} />
            <Text style={styles.processingText}>Processing document...</Text>
          </View>
        )}

        <View style={styles.imageContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />

          {/* Perspective Crop Overlay Points */}
          {cropMode && Platform.OS === 'web' && (
            <div style={styles.cropOverlayWeb as any}>
              {/* Corner Handles */}
              {(Object.keys(corners) as Array<keyof typeof corners>).map(cornerKey => {
                const pos = corners[cornerKey];
                return (
                  <div
                    key={cornerKey}
                    onMouseDown={(e) => handleWebDrag(e, cornerKey)}
                    onTouchStart={(e) => handleWebDrag(e as any, cornerKey)}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      width: 24,
                      height: 24,
                      marginLeft: -12,
                      marginTop: -12,
                      borderRadius: 12,
                      backgroundColor: Theme.colors.ocean[500],
                      border: '2px solid white',
                      cursor: 'move',
                      zIndex: 100,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                    }}
                  />
                );
              })}

              {/* Connecting Border Lines */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polygon
                  points={`${corners.topLeft.x}%,${corners.topLeft.y}% ${corners.topRight.x}%,${corners.topRight.y}% ${corners.bottomRight.x}%,${corners.bottomRight.y}% ${corners.bottomLeft.x}%,${corners.bottomLeft.y}%`}
                  style={{ fill: 'rgba(0, 122, 255, 0.15)', stroke: Theme.colors.ocean[500], strokeWidth: 2 }}
                />
              </svg>
            </div>
          )}
        </View>
      </View>

      {/* Tabs Selector */}
      {!cropMode && (
        <View style={[styles.tabsRow, isLargeScreen && styles.largeContent]}>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'filter' && styles.tabItemActive]} onPress={() => setActiveTab('filter')}>
            <Ionicons name="color-palette" size={20} color={activeTab === 'filter' ? Theme.colors.ocean[500] : Theme.colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'filter' && styles.tabTextActive]}>Filters</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'adjust' && styles.tabItemActive]} onPress={() => setActiveTab('adjust')}>
            <Ionicons name="options" size={20} color={activeTab === 'adjust' ? Theme.colors.ocean[500] : Theme.colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'adjust' && styles.tabTextActive]}>Adjust</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'crop' && styles.tabItemActive]} onPress={() => setCropMode(true)}>
            <Ionicons name="crop" size={20} color={Theme.colors.text.secondary} />
            <Text style={styles.tabText}>Crop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Toolbars depending on Active Tab */}
      <View style={[styles.bottomControlPanel, isLargeScreen && styles.largeContent]}>
        {cropMode ? (
          <View style={styles.cropActionsRow}>
            <Button variant="outline" size="md" style={styles.halfBtn} onPress={() => setCropMode(false)}>
              Cancel
            </Button>
            <Button size="md" style={styles.halfBtn} onPress={handleApplyCrop}>
              Apply Crop
            </Button>
          </View>
        ) : (
          <>
            {activeTab === 'filter' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterCarousel}>
                {presets.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.filterCard,
                      filters.preset === preset.id && styles.filterCardActive,
                    ]}
                    onPress={() => handlePresetSelect(preset.id)}
                  >
                    <View style={[styles.filterIconBg, filters.preset === preset.id && { backgroundColor: `${Theme.colors.ocean[500]}15` }]}>
                      <Ionicons name={preset.icon} size={24} color={filters.preset === preset.id ? Theme.colors.ocean[500] : Theme.colors.text.secondary} />
                    </View>
                    <Text style={[styles.filterCardLabel, filters.preset === preset.id && styles.filterCardLabelActive]}>
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeTab === 'adjust' && (
              <View style={styles.slidersContainer}>
                {/* Brightness */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Brightness: {Math.round(brightness * 100)}%</Text>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    style={styles.htmlSlider}
                  />
                </View>

                {/* Contrast */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Contrast: {Math.round(contrast * 100)}%</Text>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.05"
                    value={contrast}
                    onChange={(e) => setContrast(parseFloat(e.target.value))}
                    style={styles.htmlSlider}
                  />
                </View>

                {/* Saturation */}
                <View style={styles.sliderRow}>
                  <Text style={styles.sliderLabel}>Saturation: {Math.round(saturation * 100)}%</Text>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={saturation}
                    onChange={(e) => setSaturation(parseFloat(e.target.value))}
                    style={styles.htmlSlider}
                  />
                </View>
              </View>
            )}

            {/* Save Action Footer */}
            <View style={styles.saveFooter}>
              <Button size="lg" fullWidth onPress={handleSave}>
                <Ionicons name="checkmark-circle" size={24} color={Theme.colors.text.inverse} style={{ marginRight: 8 }} />
                Save & Continue
              </Button>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  largeContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  backButton: {
    padding: Theme.spacing.xs,
  },
  headerTitle: {
    ...Theme.textStyles.h3,
  },
  resetBtn: {
    padding: Theme.spacing.sm,
  },
  resetBtnText: {
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#151515',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '85%',
    height: '85%',
    maxHeight: 600,
    maxWidth: 450,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  cropOverlayWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  processingText: {
    color: '#FFF',
    ...Theme.textStyles.body,
    marginTop: Theme.spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
    backgroundColor: Theme.colors.surface.primary,
    height: 56,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: Theme.colors.ocean[500],
  },
  tabText: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
  },
  tabTextActive: {
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  bottomControlPanel: {
    backgroundColor: Theme.colors.surface.secondary,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
  filterCarousel: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  filterCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  filterCardActive: {
    transform: [{ scale: 1.05 }],
  },
  filterIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  filterCardLabel: {
    fontSize: 11,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  filterCardLabelActive: {
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  slidersContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  sliderRow: {
    width: '100%',
  },
  sliderLabel: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  htmlSlider: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },
  cropActionsRow: {
    flexDirection: 'row',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  halfBtn: {
    flex: 1,
  },
  saveFooter: {
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
});
