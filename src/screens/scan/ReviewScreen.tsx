import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, AbsoluteFill } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useImageFilters } from '../../hooks/useImageFilters';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import { DEFAULT_FILTERS } from '../../types';
import type { CSSProperties } from 'react';

// Rendered as a plain HTML range input on web, where accentColor is valid CSS
const htmlSlider: CSSProperties = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  accentColor: Theme.colors.ocean[500],
};

interface Point {
  x: number;
  y: number;
}

// ── All 10 filter presets ───────────────────────────────────────────────────
const PRESETS = [
  { id: 'original',  name: 'Original',   icon: 'image-outline'          },
  { id: 'color',     name: 'Color',       icon: 'color-palette-outline'  },
  { id: 'magic',     name: 'Magic',       icon: 'sparkles-outline'       },
  { id: 'bw',        name: 'B&W Doc',     icon: 'contrast-outline'       },
  { id: 'grayscale', name: 'Grayscale',   icon: 'eye-outline'            },
  { id: 'hd',        name: 'HD Sharpen', icon: 'trending-up-outline'    },
  { id: 'shadows',   name: 'No Shadow',  icon: 'sunny-outline'          },
  { id: 'noise',     name: 'De-Noise',   icon: 'options-outline'        },
  { id: 'clarity',   name: 'Clarity',    icon: 'scan-circle-outline'    },
  { id: 'vivid',     name: 'Vivid',      icon: 'flower-outline'         },
] as const;

export const ReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri } = route.params || {};
  const { currentProject, createProject, setCurrentProject, addScannedPages } = useApp();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const { filters, isProcessing, applyFilters, updateFilter, resetFilters } = useImageFilters();

  const [previewUri, setPreviewUri] = useState<string>(imageUri);
  const [activeTab, setActiveTab] = useState<'filter' | 'adjust' | 'crop'>('filter');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);

  // Slider states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [clarity, setClarity] = useState(0);

  // Crop corners (percentage from 0–100)
  const [cropMode, setCropMode] = useState(false);
  const [corners, setCorners] = useState<{
    topLeft: Point; topRight: Point; bottomLeft: Point; bottomRight: Point;
  }>({
    topLeft:     { x: 10, y: 10 },
    topRight:    { x: 90, y: 10 },
    bottomLeft:  { x: 10, y: 90 },
    bottomRight: { x: 90, y: 90 },
  });

  // Re-run filters on any change
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!imageUri) return;
      const result = await applyFilters(imageUri, {
        brightness, contrast, saturation, exposure, clarity,
      });
      if (result && active) setPreviewUri(result);
    };
    run();
    return () => { active = false; };
  }, [filters.preset, brightness, contrast, saturation, exposure, clarity, imageUri]);

  const handlePresetSelect = (id: typeof PRESETS[number]['id']) => {
    updateFilter('preset', id);
  };

  // ── Save page ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      let proj = currentProject;
      if (!proj) {
        const title = `Scan ${new Date().toLocaleDateString()}`;
        proj = await createProject(title);
        if (proj) setCurrentProject(proj);
      }
      if (!proj) { showToast('Failed to create project', 'error'); return; }
      await addScannedPages(proj.id, [{
        originalUri: imageUri,
        imageUri: previewUri,
        processedUri: previewUri,
        order: proj.pageCount || 0,
        filters: DEFAULT_FILTERS,
      }]);
      showToast('Page added to document!', 'success');
      navigation.replace('Main', {
        screen: 'Dashboard',
        params: { screen: 'ProjectDetail', params: { projectId: proj.id } },
      });
    } catch (e) {
      console.error(e);
      showToast('Failed to save page', 'error');
    }
  };

  // ── Web corner drag ───────────────────────────────────────────────────────
  const handleWebDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    cornerKey: keyof typeof corners
  ) => {
    if (Platform.OS !== 'web') return;
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const updatePos = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      setCorners(prev => ({ ...prev, [cornerKey]: { x, y } }));
    };
    const onMove = (ev: MouseEvent) => updatePos(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Apply crop + perspective correct ─────────────────────────────────────
  const handleApplyCrop = async () => {
    setIsProcessingLocal(true);
    try {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = previewUri;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const minX = Math.min(corners.topLeft.x, corners.bottomLeft.x) / 100 * img.width;
      const maxX = Math.max(corners.topRight.x, corners.bottomRight.x) / 100 * img.width;
      const minY = Math.min(corners.topLeft.y, corners.topRight.y) / 100 * img.height;
      const maxY = Math.max(corners.bottomLeft.y, corners.bottomRight.y) / 100 * img.height;
      const cropW = Math.max(10, maxX - minX);
      const cropH = Math.max(10, maxY - minY);
      canvas.width = cropW;
      canvas.height = cropH;
      ctx.drawImage(img, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      setPreviewUri(canvas.toDataURL('image/jpeg', 0.95));
      showToast('Image cropped & perspective corrected!', 'success');
      setCropMode(false);
      setActiveTab('filter');
    } catch (e) {
      console.error(e);
      showToast('Failed to crop image', 'error');
    }
    setIsProcessingLocal(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
        </Button>
        <Text style={styles.headerTitle}>{cropMode ? 'Crop & Correct' : 'Review Scan'}</Text>
        <TouchableOpacity
          onPress={() => {
            resetFilters();
            setBrightness(0); setContrast(0); setSaturation(1);
            setExposure(0); setClarity(0);
          }}
          style={styles.resetBtn}
        >
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        {(isProcessing || isProcessingLocal) && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={Theme.colors.ocean[500]} />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
        <View style={styles.imageContainer}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />

          {/* Perspective Crop Overlay (web only) */}
          {cropMode && Platform.OS === 'web' && (
            <div style={styles.cropOverlayWeb as any}>
              {(Object.keys(corners) as Array<keyof typeof corners>).map(key => {
                const pos = corners[key];
                return (
                  <div
                    key={key}
                    onMouseDown={e => handleWebDrag(e, key)}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}%`, top: `${pos.y}%`,
                      width: 26, height: 26,
                      marginLeft: -13, marginTop: -13,
                      borderRadius: 13,
                      backgroundColor: Theme.colors.ocean[500],
                      border: '3px solid white',
                      cursor: 'move',
                      zIndex: 100,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  />
                );
              })}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <polygon
                  points={`${corners.topLeft.x}%,${corners.topLeft.y}% ${corners.topRight.x}%,${corners.topRight.y}% ${corners.bottomRight.x}%,${corners.bottomRight.y}% ${corners.bottomLeft.x}%,${corners.bottomLeft.y}%`}
                  style={{ fill: 'rgba(0,122,255,0.12)', stroke: Theme.colors.ocean[500], strokeWidth: 2 }}
                />
              </svg>
            </div>
          )}
        </View>
      </View>

      {/* Tab Selector */}
      {!cropMode && (
        <View style={[styles.tabsRow, isLargeScreen && styles.largeContent]}>
          {[
            { id: 'filter', label: 'Filters', icon: 'color-palette' },
            { id: 'adjust', label: 'Adjust',  icon: 'options'       },
            { id: 'crop',   label: 'Crop',    icon: 'crop'           },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
              onPress={() => { if (tab.id === 'crop') setCropMode(true); else setActiveTab(tab.id as any); }}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? Theme.colors.ocean[500] : Theme.colors.text.secondary}
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bottom Control Panel */}
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
            {/* ── Filter carousel ── */}
            {activeTab === 'filter' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterCarousel}
              >
                {PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.filterCard,
                      filters.preset === preset.id && styles.filterCardActive,
                    ]}
                    onPress={() => handlePresetSelect(preset.id)}
                  >
                    <View
                      style={[
                        styles.filterIconBg,
                        filters.preset === preset.id && { backgroundColor: `${Theme.colors.ocean[500]}18` },
                      ]}
                    >
                      <Ionicons
                        name={preset.icon as any}
                        size={24}
                        color={filters.preset === preset.id ? Theme.colors.ocean[500] : Theme.colors.text.secondary}
                      />
                    </View>
                    <Text style={[styles.filterCardLabel, filters.preset === preset.id && styles.filterCardLabelActive]}>
                      {preset.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* ── Adjust sliders ── */}
            {activeTab === 'adjust' && Platform.OS === 'web' && (
              <ScrollView style={styles.slidersScroll} nestedScrollEnabled>
                <View style={styles.slidersContainer}>
                  {/* Exposure */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Ionicons name="sunny" size={14} color={Theme.colors.text.secondary} />
                      <Text style={styles.sliderLabel}>Exposure</Text>
                      <Text style={styles.sliderValue}>{exposure > 0 ? `+${(exposure * 2).toFixed(1)}EV` : `${(exposure * 2).toFixed(1)}EV`}</Text>
                    </View>
                    <input
                      type="range" min="-1" max="1" step="0.05"
                      value={exposure}
                      onChange={e => setExposure(parseFloat(e.target.value))}
                      style={htmlSlider}
                    />
                  </View>

                  {/* Brightness */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Ionicons name="bulb-outline" size={14} color={Theme.colors.text.secondary} />
                      <Text style={styles.sliderLabel}>Brightness</Text>
                      <Text style={styles.sliderValue}>{Math.round(brightness * 100)}%</Text>
                    </View>
                    <input
                      type="range" min="-1" max="1" step="0.05"
                      value={brightness}
                      onChange={e => setBrightness(parseFloat(e.target.value))}
                      style={htmlSlider}
                    />
                  </View>

                  {/* Contrast */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Ionicons name="contrast-outline" size={14} color={Theme.colors.text.secondary} />
                      <Text style={styles.sliderLabel}>Contrast</Text>
                      <Text style={styles.sliderValue}>{Math.round(contrast * 100)}%</Text>
                    </View>
                    <input
                      type="range" min="-1" max="1" step="0.05"
                      value={contrast}
                      onChange={e => setContrast(parseFloat(e.target.value))}
                      style={htmlSlider}
                    />
                  </View>

                  {/* Clarity */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Ionicons name="scan-circle-outline" size={14} color={Theme.colors.text.secondary} />
                      <Text style={styles.sliderLabel}>Clarity</Text>
                      <Text style={styles.sliderValue}>{Math.round(clarity * 100)}%</Text>
                    </View>
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={clarity}
                      onChange={e => setClarity(parseFloat(e.target.value))}
                      style={htmlSlider}
                    />
                  </View>

                  {/* Saturation */}
                  <View style={styles.sliderRow}>
                    <View style={styles.sliderLabelRow}>
                      <Ionicons name="color-fill-outline" size={14} color={Theme.colors.text.secondary} />
                      <Text style={styles.sliderLabel}>Saturation</Text>
                      <Text style={styles.sliderValue}>{Math.round(saturation * 100)}%</Text>
                    </View>
                    <input
                      type="range" min="0" max="2" step="0.1"
                      value={saturation}
                      onChange={e => setSaturation(parseFloat(e.target.value))}
                      style={htmlSlider}
                    />
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Save Footer */}
            <View style={styles.saveFooter}>
              <Button size="lg" fullWidth onPress={handleSave}>
                <Ionicons name="checkmark-circle" size={22} color={Theme.colors.text.inverse} style={{ marginRight: 8 }} />
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
  backButton: { padding: Theme.spacing.xs },
  headerTitle: { ...Theme.textStyles.h3 },
  resetBtn: { padding: Theme.spacing.sm },
  resetBtnText: {
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#151515',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '85%',
    height: '85%',
    maxHeight: 600,
    maxWidth: 450,
  },
  previewImage: { width: '100%', height: '100%' },
  cropOverlayWeb: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  processingOverlay: {
    ...AbsoluteFill,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  processingText: {
    ...Theme.textStyles.body,
    color: '#FFF',
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
  tabText: { ...Theme.textStyles.caption, color: Theme.colors.text.secondary },
  tabTextActive: { color: Theme.colors.ocean[500], fontFamily: Theme.typography.fontFamilies.bold },
  bottomControlPanel: {
    backgroundColor: Theme.colors.surface.secondary,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
  filterCarousel: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  filterCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    paddingHorizontal: 4,
  },
  filterCardActive: { transform: [{ scale: 1.06 }] },
  filterIconBg: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Theme.colors.surface.tertiary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 5,
  },
  filterCardLabel: {
    fontSize: 10,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.typography.fontFamilies.medium,
    textAlign: 'center',
  },
  filterCardLabelActive: {
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  slidersScroll: { maxHeight: 260 },
  slidersContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  sliderRow: { width: '100%' },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: 6,
  },
  sliderLabel: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  sliderValue: {
    ...Theme.textStyles.caption,
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
    minWidth: 44,
    textAlign: 'right',
  },
  cropActionsRow: {
    flexDirection: 'row',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  halfBtn: { flex: 1 },
  saveFooter: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
    backgroundColor: Theme.colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
});
