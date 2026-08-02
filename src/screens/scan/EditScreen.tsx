import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useImageFilters } from '../../hooks/useImageFilters';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';

export const EditScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { page } = route.params || {};
  const { updateScannedPage } = useApp();
  const { showToast } = useToast();

  const {
    filters,
    isProcessing,
    applyFilters,
    updateFilter,
    resetFilters,
  } = useImageFilters();

  const [previewUri, setPreviewUri] = useState<string>(page?.imageUri || '');

  useEffect(() => {
    let active = true;
    const runFilters = async () => {
      if (!page) return;
      const result = await applyFilters(page.originalUri);
      if (result && active) {
        setPreviewUri(result);
      }
    };
    runFilters();
    return () => {
      active = false;
    };
  }, [filters, page, applyFilters]);

  const handleSave = async () => {
    try {
      if (!page) return;
      await updateScannedPage(page.id, {
        imageUri: previewUri,
        processedUri: previewUri,
      });
      showToast('Page updated successfully!', 'success');
      navigation.goBack();
    } catch (e) {
      console.error(e);
      showToast('Failed to update page', 'error');
    }
  };

  const toggleGrayscale = () => {
    updateFilter('grayscale', !filters.grayscale);
  };

  const toggleEnhance = () => {
    updateFilter('autoEnhance', !filters.autoEnhance);
  };

  if (!page) {
    return (
      <View style={styles.errorContainer}>
        <Text>No page selected for editing</Text>
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
        <View style={{ width: 48 }} />
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

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarContent}>
          <TouchableOpacity
            style={[styles.toolBtn, filters.grayscale && styles.toolBtnActive]}
            onPress={toggleGrayscale}
          >
            <Ionicons name="color-palette-outline" size={24} color={filters.grayscale ? Theme.colors.ocean[500] : Theme.colors.text.primary} />
            <Text style={[styles.toolText, filters.grayscale && styles.toolTextActive]}>B&W Grayscale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, filters.autoEnhance && styles.toolBtnActive]}
            onPress={toggleEnhance}
          >
            <Ionicons name="sparkles-outline" size={24} color={filters.autoEnhance ? Theme.colors.ocean[500] : Theme.colors.text.primary} />
            <Text style={[styles.toolText, filters.autoEnhance && styles.toolTextActive]}>Auto Enhance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolBtn}
            onPress={resetFilters}
          >
            <Ionicons name="refresh-outline" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.toolText}>Reset</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button size="lg" fullWidth onPress={handleSave}>
          Save Changes
        </Button>
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
  backButton: {
    padding: Theme.spacing.xs,
  },
  headerTitle: {
    ...Theme.textStyles.h3,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  processingText: {
    color: '#FFF',
    ...Theme.textStyles.body,
    marginTop: Theme.spacing.sm,
  },
  toolbar: {
    height: 90,
    backgroundColor: Theme.colors.surface.secondary,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
  toolbarContent: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
    height: 70,
    borderRadius: Theme.borderRadius.md,
  },
  toolBtnActive: {
    backgroundColor: Theme.colors.ocean[50],
  },
  toolText: {
    ...Theme.textStyles.caption,
    marginTop: 4,
    color: Theme.colors.text.secondary,
  },
  toolTextActive: {
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  footer: {
    padding: Theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
    backgroundColor: Theme.colors.surface.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: '#FFF',
  },
});
