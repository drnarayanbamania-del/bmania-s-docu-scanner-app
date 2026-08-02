import React from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/Toast';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export const ScanScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentProject, addScannedPages, createProject, setCurrentProject } = useApp();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const getOrCreateProject = async () => {
    if (currentProject) return currentProject;
    const title = `Scan ${new Date().toLocaleDateString()}`;
    const newProj = await createProject(title);
    if (newProj) {
      setCurrentProject(newProj);
    }
    return newProj;
  };

  const handleLaunchCamera = () => {
    navigation.navigate('Camera');
  };

  const handleImportGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('Permission to access library is required', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const proj = await getOrCreateProject();
        if (!proj) return;

        const pages = result.assets.map((asset, index) => ({
          originalUri: asset.uri,
          imageUri: asset.uri,
          order: index,
        }));

        await addScannedPages(proj.id, pages);
        showToast(`Imported ${pages.length} images!`, 'success');
        navigation.navigate('Dashboard');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to import images', 'error');
    }
  };

  const handleImportFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const proj = await getOrCreateProject();
        if (!proj) return;

        const pages = result.assets.map((asset, index) => ({
          originalUri: asset.uri,
          imageUri: asset.uri,
          order: index,
        }));

        await addScannedPages(proj.id, pages);
        showToast(`Imported ${pages.length} files!`, 'success');
        navigation.navigate('Dashboard');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to import files', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Text style={styles.headerTitle}>Scan Document</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeContent]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>Choose how you want to scan or add pages to your document</Text>

        <View style={styles.cardsContainer}>
          {/* Camera Card */}
          <Card onPress={handleLaunchCamera} style={styles.actionCard} padding="lg">
            <View style={[styles.iconContainer, { backgroundColor: `${Theme.colors.ocean[500]}15` }]}>
              <Ionicons name="camera" size={40} color={Theme.colors.ocean[500]} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Use Camera</Text>
              <Text style={styles.cardDesc}>Point camera at document to auto-detect and crop borders.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.text.muted} />
          </Card>

          {/* Import Gallery Card */}
          <Card onPress={handleImportGallery} style={styles.actionCard} padding="lg">
            <View style={[styles.iconContainer, { backgroundColor: `${Theme.colors.accent.teal}15` }]}>
              <Ionicons name="images" size={40} color={Theme.colors.accent.teal} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Import from Gallery</Text>
              <Text style={styles.cardDesc}>Select photos from your gallery roll to add directly.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.text.muted} />
          </Card>

          {/* Import Files Card */}
          <Card onPress={handleImportFiles} style={styles.actionCard} padding="lg">
            <View style={[styles.iconContainer, { backgroundColor: `${Theme.colors.accent.coral}15` }]}>
              <Ionicons name="document-attach" size={40} color={Theme.colors.accent.coral} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Import PDF or Files</Text>
              <Text style={styles.cardDesc}>Import image files or PDF documents directly from folder storage.</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Theme.colors.text.muted} />
          </Card>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  headerTitle: {
    ...Theme.textStyles.h3,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  largeContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  subtitle: {
    ...Theme.textStyles.bodyLarge,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  cardsContainer: {
    gap: Theme.spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: Theme.colors.border.light,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    ...Theme.textStyles.bodyLarge,
    fontFamily: Theme.typography.fontFamilies.bold,
    color: Theme.colors.text.primary,
  },
  cardDesc: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
});
