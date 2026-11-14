import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, Image, TouchableOpacity, Alert, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, AbsoluteFill } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import { ExportModal } from '../../components/modals/ExportModal';
import { ScannedPage } from '../../types';

export const ProjectDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const projectId: string | undefined = route.params?.projectId;
  const {
    currentProject, projects, scannedPages, deleteProject, deleteScannedPage,
    updateScannedPage, reorderPages, addScannedPages, clearCurrentProject,
    setCurrentProject, loadScannedPages,
  } = useApp();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [rotatingPageId, setRotatingPageId] = useState<string | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);

  // Pages live in the database, so always fetch the ones for this project when it opens.
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    if (currentProject?.id !== projectId) {
      const match = projects.find(p => p.id === projectId);
      if (match) setCurrentProject(match);
    }
    setLoadingPages(true);
    loadScannedPages(projectId).finally(() => {
      if (active) setLoadingPages(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const projectPages = scannedPages
    .filter(p => p.projectId === currentProject?.id)
    .sort((a, b) => a.order - b.order);

  const handleAddPage = () => {
    navigation.navigate('Scan', { screen: 'Camera' });
  };

  const handleExport = () => {
    setExportModalVisible(true);
  };

  const handleDeleteProject = () => {
    const performDelete = async () => {
      if (currentProject) {
        await deleteProject(currentProject.id);
        clearCurrentProject();
        navigation.goBack();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this document?')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Document',
        'Are you sure you want to delete this document and all its scanned pages?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const handleDeletePage = (pageId: string) => {
    const performDelete = async () => {
      if (currentProject) {
        await deleteScannedPage(currentProject.id, pageId);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this page?')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Page',
        'Are you sure you want to delete this page?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const handleRotatePage = async (page: ScannedPage) => {
    setRotatingPageId(page.id);
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.src = page.processedUri || page.imageUri || page.originalUri;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Swap dimensions for 90 degree rotation
      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedUri = canvas.toDataURL('image/jpeg', 0.95);
      await updateScannedPage(page.id, { processedUri: rotatedUri, imageUri: rotatedUri });
      showToast('Page rotated 90°', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to rotate page', 'error');
    }
    setRotatingPageId(null);
  };

  const handleDuplicatePage = async (page: ScannedPage) => {
    try {
      const duplicate = {
        originalUri: page.originalUri,
        imageUri: page.imageUri,
        processedUri: page.processedUri,
        order: projectPages.length,
        filters: page.filters,
      };
      if (currentProject) {
        await addScannedPages(currentProject.id, [duplicate]);
        showToast('Page duplicated!', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to duplicate page', 'error');
    }
  };

  const handleMovePage = async (currentIndex: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= projectPages.length) return;

    const newPages = [...projectPages];
    // Swap pages
    const temp = newPages[currentIndex];
    newPages[currentIndex] = newPages[targetIndex];
    newPages[targetIndex] = temp;

    if (currentProject) {
      // Re-assign order indices based on position in array
      const reordered = newPages.map((p, idx) => ({ ...p, order: idx }));
      await reorderPages(currentProject.id, reordered);
      showToast('Page order updated', 'success');
    }
  };

  const renderPageItem = ({ item, index }: { item: ScannedPage; index: number }) => (
    <Card style={styles.pageCard} padding="none">
      <View style={styles.imageWrapper}>
        <Image source={{ uri: item.processedUri || item.imageUri || item.originalUri }} style={styles.pageImage} resizeMode="cover" />
        
        {rotatingPageId === item.id && (
          <View style={styles.cardLoadingOverlay}>
            <ActivityIndicator size="small" color="#FFF" />
          </View>
        )}

        <View style={styles.pageNumberBadge}>
          <Text style={styles.pageNumberText}>{index + 1}</Text>
        </View>

        <TouchableOpacity
          style={styles.deletePageBtn}
          onPress={() => handleDeletePage(item.id)}
        >
          <Ionicons name="trash" size={16} color={Theme.colors.status.error} />
        </TouchableOpacity>
      </View>

      {/* Interactive Actions Grid */}
      <View style={styles.pageCardActions}>
        {/* Reordering */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.smallActionBtn, index === 0 && styles.disabledActionBtn]}
            onPress={() => handleMovePage(index, 'left')}
            disabled={index === 0}
          >
            <Ionicons name="arrow-back" size={16} color={index === 0 ? Theme.colors.text.muted : Theme.colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallActionBtn, index === projectPages.length - 1 && styles.disabledActionBtn]}
            onPress={() => handleMovePage(index, 'right')}
            disabled={index === projectPages.length - 1}
          >
            <Ionicons name="arrow-forward" size={16} color={index === projectPages.length - 1 ? Theme.colors.text.muted : Theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Rotate and Duplicate */}
        <View style={[styles.actionRow, styles.borderTop]}>
          <TouchableOpacity
            style={styles.smallActionBtn}
            onPress={() => handleRotatePage(item)}
            accessibilityLabel="Rotate 90"
          >
            <Ionicons name="refresh" size={16} color={Theme.colors.ocean[500]} />
            <Text style={styles.actionLabel}>Rotate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallActionBtn}
            onPress={() => handleDuplicatePage(item)}
            accessibilityLabel="Duplicate"
          >
            <Ionicons name="copy-outline" size={16} color={Theme.colors.accent.teal} />
            <Text style={styles.actionLabel}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  if (!currentProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Button size="md" onPress={() => navigation.goBack()} style={{ marginTop: Theme.spacing.md }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLargeScreen && styles.largeHeader]}>
        <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
        </Button>
        <Text style={styles.headerTitle} numberOfLines={1}>{currentProject.title}</Text>
        <TouchableOpacity onPress={handleDeleteProject} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={24} color={Theme.colors.status.error} />
        </TouchableOpacity>
      </View>

      {/* Pages list or Empty state */}
      {loadingPages && projectPages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Theme.colors.ocean[500]} />
        </View>
      ) : projectPages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color={Theme.colors.text.muted} />
          <Text style={styles.emptyTitle}>No pages scanned yet</Text>
          <Text style={styles.emptySubtitle}>Start scanning or import files to add pages to this document.</Text>
          <Button
            size="lg"
            onPress={handleAddPage}
            style={{ marginTop: Theme.spacing.lg }}
            leftIcon={<Ionicons name="camera" size={22} color={Theme.colors.text.inverse} />}
          >
            Scan First Page
          </Button>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={projectPages}
            renderItem={renderPageItem}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={[styles.gridContent, isLargeScreen && styles.largeGridContent]}
            columnWrapperStyle={styles.gridWrapper}
            ListFooterComponent={
              <View style={styles.footerActions}>
                <Button
                  variant="outline"
                  size="md"
                  onPress={handleAddPage}
                  style={styles.actionBtn}
                  leftIcon={<Ionicons name="add" size={20} color={Theme.colors.ocean[500]} />}
                >
                  Add Page
                </Button>
                <Button
                  size="md"
                  onPress={handleExport}
                  style={[styles.actionBtn, { marginLeft: Theme.spacing.md }]}
                  leftIcon={<Ionicons name="share-outline" size={20} color={Theme.colors.text.inverse} />}
                >
                  Export PDF
                </Button>
              </View>
            }
          />
        </View>
      )}
      
      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        projectPages={projectPages}
        projectTitle={currentProject.title}
      />
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
  largeHeader: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    padding: Theme.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    ...Theme.textStyles.h3,
    textAlign: 'center',
    marginHorizontal: Theme.spacing.md,
  },
  deleteBtn: {
    padding: Theme.spacing.sm,
  },
  gridContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  largeGridContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  gridWrapper: {
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  pageCard: {
    width: '48%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
  },
  imageWrapper: {
    position: 'relative',
    height: 200,
    backgroundColor: Theme.colors.surface.secondary,
  },
  pageImage: {
    width: '100%',
    height: '100%',
  },
  cardLoadingOverlay: {
    ...AbsoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberBadge: {
    position: 'absolute',
    top: Theme.spacing.xs,
    left: Theme.spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deletePageBtn: {
    position: 'absolute',
    top: Theme.spacing.xs,
    right: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadows.sm,
  },
  pageCardActions: {
    backgroundColor: Theme.colors.surface.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    height: 38,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
  smallActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    height: '100%',
  },
  disabledActionBtn: {
    opacity: 0.3,
  },
  actionLabel: {
    fontSize: 10,
    fontFamily: Theme.typography.fontFamilies.medium,
    color: Theme.colors.text.secondary,
  },
  footerActions: {
    flexDirection: 'row',
    marginTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  actionBtn: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyTitle: {
    ...Theme.textStyles.h2,
    marginTop: Theme.spacing.lg,
  },
  emptySubtitle: {
    ...Theme.textStyles.bodyLarge,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: Theme.spacing.md,
  },
});
