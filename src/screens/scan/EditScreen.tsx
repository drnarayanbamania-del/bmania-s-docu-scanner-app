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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, AbsoluteFill } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useImageFilters } from '../../hooks/useImageFilters';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import type { CSSProperties } from 'react';

// Rendered as a plain HTML range input on web, where accentColor is valid CSS
const htmlSlider: CSSProperties = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  accentColor: Theme.colors.ocean[500],
};

const PRESETS = [
  { id: 'original',  name: 'Original',  icon: 'image-outline'         },
  { id: 'color',     name: 'Color',      icon: 'color-palette-outline' },
  { id: 'magic',     name: 'Magic',      icon: 'sparkles-outline'      },
  { id: 'bw',        name: 'B&W Doc',    icon: 'contrast-outline'      },
  { id: 'grayscale', name: 'Grayscale',  icon: 'eye-outline'           },
  { id: 'hd',        name: 'HD Sharpen', icon: 'trending-up-outline'   },
  { id: 'shadows',   name: 'No Shadow',  icon: 'sunny-outline'         },
  { id: 'noise',     name: 'De-Noise',   icon: 'options-outline'       },
  { id: 'clarity',   name: 'Clarity',    icon: 'scan-circle-outline'   },
  { id: 'vivid',     name: 'Vivid',      icon: 'flower-outline'        },
] as const;

export const EditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { page } = route.params || {};
  const { updateScannedPage } = useApp();
  const { showToast } = useToast();

  const { filters, isProcessing, applyFilters, updateFilter, resetFilters } = useImageFilters();

  const [previewUri, setPreviewUri] = useState<string>(page?.imageUri || '');
  const [activeTab, setActiveTab] = useState<'filter' | 'adjust'>('filter');

  // Slider states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [clarity, setClarity] = useState(0);

  // Re-run filters on any state change
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!page) return;
      const result = await applyFilters(page.originalUri || page.imageUri, {
        brightness, contrast, saturation, exposure, clarity,
      });
      if (result && active) setPreviewUri(result);
    };
    run();
    return () => { active = false; };
  }, [filters.preset, brightness, contrast, saturation, exposure, clarity, page]);

  const handleSave = async () => {
    try {
      if (!page) return;
      await updateScannedPage(page.id, {
        imageUri: previewUri,
        processedUri: previewUri,
        filters: {
          ...filters,
          brightness,
          contrast,
          saturation,
          exposure,
          clarity,
        },
      });
      showToast('Page updated successfully!', 'success');
      navigation.goBack();
    } catch (e) {
      console.error(e);
      showToast('Failed to update page', 'error');
    }
  };

  const handleReset = () => {
    resetFilters();
    setBrightness(0); setContrast(0); setSaturation(1);
    setExposure(0); setClarity(0);
  };

  if (!page) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color={Theme.colors.text.muted} />
        <Text style={styles.errorText}>No page selected for editing</Text>
        <Button onPress={() => navigation.goBack()}>Go Back</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color={Theme.colors.text.secondary} />
        </Button>
        <Text style={styles.headerTitle}>Edit Page</Text>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={styles.previewContainer}>
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={Theme.colors.ocean[500]} />
            <Text style={styles.processingText}>Applying changes...</Text>
          </View>
        )}
        <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
      </View>

      {/* Tab Row */}
      <View style={styles.tabsRow}>
        {[
          { id: 'filter', label: 'Filters', icon: 'color-palette' },
          { id: 'adjust', label: 'Adjust',  icon: 'options'       },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id as any)}
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

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* ── Filter preset carousel ── */}
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
                onPress={() => updateFilter('preset', preset.id)}
              >
                <View
                  style={[
                    styles.filterIconBg,
                    filters.preset === preset.id && { backgroundColor: `${Theme.colors.ocean[500]}18` },
                  ]}
                >
                  <Ionicons
                    name={preset.icon as any}
                    size={22}
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
              {[
                { label: 'Exposure',   icon: 'sunny',               value: exposure,    min: -1, max: 1,  step: 0.05, display: `${exposure > 0 ? '+' : ''}${(exposure * 2).toFixed(1)}EV`, set: setExposure },
                { label: 'Brightness', icon: 'bulb-outline',         value: brightness,  min: -1, max: 1,  step: 0.05, display: `${Math.round(brightness * 100)}%`,                         set: setBrightness },
                { label: 'Contrast',   icon: 'contrast-outline',     value: contrast,    min: -1, max: 1,  step: 0.05, display: `${Math.round(contrast * 100)}%`,                            set: setContrast },
                { label: 'Clarity',    icon: 'scan-circle-outline',  value: clarity,     min: 0,  max: 1,  step: 0.05, display: `${Math.round(clarity * 100)}%`,                             set: setClarity },
                { label: 'Saturation', icon: 'color-fill-outline',   value: saturation,  min: 0,  max: 2,  step: 0.1,  display: `${Math.round(saturation * 100)}%`,                          set: setSaturation },
              ].map(slider => (
                <View key={slider.label} style={styles.sliderRow}>
                  <View style={styles.sliderLabelRow}>
                    <Ionicons name={slider.icon as any} size={14} color={Theme.colors.text.secondary} />
                    <Text style={styles.sliderLabel}>{slider.label}</Text>
                    <Text style={styles.sliderValue}>{slider.display}</Text>
                  </View>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={slider.value}
                    onChange={e => slider.set(parseFloat(e.target.value))}
                    style={htmlSlider}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Button size="lg" fullWidth onPress={handleSave}>
            <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
            Save Changes
          </Button>
        </View>
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
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  processingOverlay: {
    ...AbsoluteFill,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  processingText: { ...Theme.textStyles.body, color: '#FFF', marginTop: Theme.spacing.sm },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
    backgroundColor: Theme.colors.surface.primary,
    height: 52,
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
  bottomPanel: {
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
    width: 68,
    paddingHorizontal: 2,
  },
  filterCardActive: { transform: [{ scale: 1.08 }] },
  filterIconBg: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Theme.colors.surface.tertiary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
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
  slidersScroll: { maxHeight: 240 },
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
    marginBottom: 5,
  },
  sliderLabel: { ...Theme.textStyles.bodySmall, color: Theme.colors.text.primary, flex: 1 },
  sliderValue: {
    ...Theme.textStyles.caption,
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
    minWidth: 44,
    textAlign: 'right',
  },
  footer: {
    padding: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
    backgroundColor: Theme.colors.surface.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: Theme.colors.surface.primary,
  },
  errorText: { ...Theme.textStyles.body, color: Theme.colors.text.secondary },
});
