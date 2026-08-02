import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, FlatList, TextInput, TouchableOpacity, Platform, useWindowDimensions, Image } from 'react-native';
const LOGO = require('../../../assets/logo.png');
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { Project, ScannedPage } from '../../types';

export const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { projects, scannedPages, createProject, setCurrentProject, addScannedPages, deleteProject } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  // PDF Tool Modal States
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [selectedMergeProjIds, setSelectedMergeProjIds] = useState<string[]>([]);
  const [mergedDocTitle, setMergedDocTitle] = useState('');

  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [selectedSplitProj, setSelectedSplitProj] = useState<Project | null>(null);
  const [selectedSplitPageIds, setSelectedSplitPageIds] = useState<string[]>([]);

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateProject = async () => {
    const title = `Scan ${new Date().toLocaleDateString()}`;
    const newProj = await createProject(title);
    if (newProj) {
      setCurrentProject(newProj);
      navigation.navigate('Scan', { screen: 'Camera' });
    }
  };

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  // Merge Documents logic
  const handleMergeDocuments = async () => {
    if (selectedMergeProjIds.length < 2) {
      showToast('Select at least 2 documents to merge', 'error');
      return;
    }

    const title = mergedDocTitle.trim() || `Merged Doc ${new Date().toLocaleDateString()}`;
    const mergedProj = await createProject(title);
    if (!mergedProj) {
      showToast('Failed to create merged document', 'error');
      return;
    }

    // Accumulate all pages in selected order
    const pagesToMerge: Omit<ScannedPage, 'id' | 'projectId' | 'createdAt'>[] = [];
    selectedMergeProjIds.forEach(projId => {
      const projPages = scannedPages
        .filter(p => p.projectId === projId)
        .sort((a, b) => a.order - b.order);
      
      projPages.forEach(p => {
        pagesToMerge.push({
          originalUri: p.originalUri,
          imageUri: p.imageUri,
          processedUri: p.processedUri,
          order: pagesToMerge.length,
        });
      });
    });

    if (pagesToMerge.length === 0) {
      showToast('Selected documents have no scanned pages', 'error');
      // Cleanup empty project
      await deleteProject(mergedProj.id);
      return;
    }

    await addScannedPages(mergedProj.id, pagesToMerge);
    showToast(`Merged ${selectedMergeProjIds.length} documents successfully!`, 'success');
    setMergeModalVisible(false);
    setSelectedMergeProjIds([]);
    setMergedDocTitle('');
    
    // Open the new project
    handleSelectProject(mergedProj);
  };

  const toggleMergeSelect = (id: string) => {
    setSelectedMergeProjIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Split Document logic
  const handleSplitDocument = async () => {
    if (!selectedSplitProj) return;
    if (selectedSplitPageIds.length === 0) {
      showToast('Select at least 1 page to extract', 'error');
      return;
    }

    const title = `Split from ${selectedSplitProj.title}`;
    const splitProj = await createProject(title);
    if (!splitProj) {
      showToast('Failed to create split document', 'error');
      return;
    }

    const pagesToSplit = scannedPages
      .filter(p => selectedSplitPageIds.includes(p.id))
      .map((p, idx) => ({
        originalUri: p.originalUri,
        imageUri: p.imageUri,
        processedUri: p.processedUri,
        order: idx,
      }));

    await addScannedPages(splitProj.id, pagesToSplit);
    showToast(`Extracted ${selectedSplitPageIds.length} pages into new document!`, 'success');
    setSplitModalVisible(false);
    setSelectedSplitProj(null);
    setSelectedSplitPageIds([]);

    handleSelectProject(splitProj);
  };

  const toggleSplitPageSelect = (pageId: string) => {
    setSelectedSplitPageIds(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  const renderProjectItem = ({ item }: { item: Project }) => (
    <Card
      onPress={() => handleSelectProject(item)}
      style={styles.projectCard}
      padding="md"
    >
      <View style={styles.projectCardHeader}>
        <Ionicons name="folder" size={36} color={Theme.colors.ocean[500]} />
        <Text style={styles.pageCount}>{item.pageCount} pages</Text>
      </View>
      <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.projectDate}>
        {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLargeScreen && styles.largeHeader]}>
        {/* Brand Logo + Name */}
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.brandName}>Bamania's Scanner</Text>
            <Text style={styles.welcomeText}>Hello, {user?.name || 'Guest'}!</Text>
          </View>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.profileBtn}>
          <Ionicons name="log-out-outline" size={26} color={Theme.colors.status.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeScrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Scan Call to Action */}
        <Card style={styles.statsCard} padding="lg">
          <Text style={styles.statsTitle}>Ready to scan?</Text>
          <Text style={styles.statsSubtitle}>Scan bills, notes, documents or books instantly.</Text>
          <Button
            size="md"
            onPress={handleCreateProject}
            style={styles.scanBtn}
            leftIcon={<Ionicons name="camera" size={20} color={Theme.colors.text.inverse} />}
          >
            Start New Scan
          </Button>
        </Card>

        {/* PDF Utility Tools Section */}
        <Text style={styles.sectionTitle}>PDF Utility Tools</Text>
        <View style={styles.utilityGrid}>
          <Card style={styles.utilityCard} padding="md" onPress={() => setMergeModalVisible(true)}>
            <View style={[styles.utilityIconBg, { backgroundColor: `${Theme.colors.ocean[500]}15` }]}>
              <Ionicons name="git-merge" size={24} color={Theme.colors.ocean[500]} />
            </View>
            <Text style={styles.utilityTitle}>Merge Documents</Text>
            <Text style={styles.utilityDesc}>Combine scanned files into one PDF.</Text>
          </Card>

          <Card style={styles.utilityCard} padding="md" onPress={() => setSplitModalVisible(true)}>
            <View style={[styles.utilityIconBg, { backgroundColor: `${Theme.colors.accent.teal}15` }]}>
              <Ionicons name="git-branch" size={24} color={Theme.colors.accent.teal} />
            </View>
            <Text style={styles.utilityTitle}>Split Document</Text>
            <Text style={styles.utilityDesc}>Extract pages to separate documents.</Text>
          </Card>
        </View>

        {/* Search and Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Documents</Text>
          {projects.length > 0 && (
            <Text style={styles.viewAllText} onPress={() => navigation.navigate('Projects')}>
              View All
            </Text>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Theme.colors.text.muted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search documents..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={Theme.colors.text.muted}
          />
        </View>

        {filteredProjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={Theme.colors.text.muted} />
            <Text style={styles.emptyTitle}>No documents found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try adjusting your search query' : 'Create your first document scan now'}
            </Text>
            {!search && (
              <Button size="md" onPress={handleCreateProject} style={{ marginTop: Theme.spacing.md }}>
                Create Scan
              </Button>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredProjects.slice(0, 6)}
            renderItem={renderProjectItem}
            keyExtractor={item => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridWrapper}
          />
        )}
      </ScrollView>

      {/* MERGE MODAL */}
      <Modal
        visible={mergeModalVisible}
        onClose={() => setMergeModalVisible(false)}
        title="Merge Documents"
      >
        <TextInput
          placeholder="New Document Title (Optional)"
          value={mergedDocTitle}
          onChangeText={setMergedDocTitle}
          style={styles.modalInput}
          placeholderTextColor={Theme.colors.text.muted}
        />

        <Text style={styles.modalInstruction}>Select documents to merge in order:</Text>
        <ScrollView style={styles.modalScroll}>
          {projects.map(proj => (
            <TouchableOpacity
              key={proj.id}
              style={[
                styles.modalListItem,
                selectedMergeProjIds.includes(proj.id) && styles.modalListItemActive,
              ]}
              onPress={() => toggleMergeSelect(proj.id)}
            >
              <Ionicons
                name={selectedMergeProjIds.includes(proj.id) ? "checkbox" : "square-outline"}
                size={22}
                color={selectedMergeProjIds.includes(proj.id) ? Theme.colors.ocean[500] : Theme.colors.text.muted}
              />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.modalItemTitle}>{proj.title}</Text>
                <Text style={styles.modalItemSub}>{proj.pageCount} pages</Text>
              </View>
              {selectedMergeProjIds.includes(proj.id) && (
                <View style={styles.mergeIndexBadge}>
                  <Text style={styles.mergeIndexText}>
                    {selectedMergeProjIds.indexOf(proj.id) + 1}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Button
          size="md"
          fullWidth
          style={{ marginTop: Theme.spacing.md }}
          onPress={handleMergeDocuments}
          disabled={selectedMergeProjIds.length < 2}
        >
          Merge Files
        </Button>
      </Modal>

      {/* SPLIT MODAL */}
      <Modal
        visible={splitModalVisible}
        onClose={() => { setSplitModalVisible(false); setSelectedSplitProj(null); }}
        title="Split Document"
      >
        {!selectedSplitProj ? (
          <>
            <Text style={styles.modalInstruction}>Choose document to split:</Text>
            <ScrollView style={styles.modalScroll}>
              {projects.filter(p => p.pageCount > 1).map(proj => (
                <TouchableOpacity
                  key={proj.id}
                  style={styles.modalListItem}
                  onPress={() => {
                    setSelectedSplitProj(proj);
                    setSelectedSplitPageIds([]);
                  }}
                >
                  <Ionicons name="folder-open-outline" size={22} color={Theme.colors.ocean[500]} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{proj.title}</Text>
                    <Text style={styles.modalItemSub}>{proj.pageCount} pages</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Theme.colors.text.muted} />
                </TouchableOpacity>
              ))}
              {projects.filter(p => p.pageCount > 1).length === 0 && (
                <Text style={styles.emptyModalText}>No documents with multiple pages available.</Text>
              )}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.modalInstruction}>
              Selected: <Text style={{ fontWeight: 'bold' }}>{selectedSplitProj.title}</Text>
            </Text>
            <Text style={styles.modalItemSub}>Check the pages you want to extract into a new document:</Text>

            <ScrollView style={styles.modalScroll}>
              {scannedPages
                .filter(p => p.projectId === selectedSplitProj.id)
                .sort((a, b) => a.order - b.order)
                .map((page, index) => (
                  <TouchableOpacity
                    key={page.id}
                    style={[
                      styles.modalListItem,
                      selectedSplitPageIds.includes(page.id) && styles.modalListItemActive,
                    ]}
                    onPress={() => toggleSplitPageSelect(page.id)}
                  >
                    <Ionicons
                      name={selectedSplitPageIds.includes(page.id) ? "checkbox" : "square-outline"}
                      size={22}
                      color={selectedSplitPageIds.includes(page.id) ? Theme.colors.ocean[500] : Theme.colors.text.muted}
                    />
                    <Image source={{ uri: page.processedUri || page.imageUri }} style={styles.splitPageThumb} />
                    <Text style={styles.modalItemTitle}>Page {index + 1}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <Button
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                onPress={() => setSelectedSplitProj(null)}
              >
                Back
              </Button>
              <Button
                size="md"
                style={{ flex: 1 }}
                onPress={handleSplitDocument}
                disabled={selectedSplitPageIds.length === 0}
              >
                Extract Pages
              </Button>
            </View>
          </>
        )}
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
    paddingBottom: Theme.spacing.md,
  },
  largeHeader: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  brandName: {
    fontSize: 16,
    fontFamily: Theme.typography.fontFamilies.bold,
    color: '#7B2FBE',
  },
  welcomeText: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.secondary,
  },
  userName: {
    ...Theme.textStyles.h2,
    color: Theme.colors.text.primary,
  },
  profileBtn: {
    padding: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface.secondary,
    borderRadius: Theme.borderRadius.full,
  },
  scrollContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  largeScrollContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  statsCard: {
    backgroundColor: Theme.colors.ocean[50],
    borderColor: Theme.colors.ocean[100],
    marginBottom: Theme.spacing.xl,
  },
  statsTitle: {
    ...Theme.textStyles.h2,
    color: Theme.colors.ocean[700],
  },
  statsSubtitle: {
    ...Theme.textStyles.body,
    color: Theme.colors.ocean[600],
    marginVertical: Theme.spacing.xs,
  },
  scanBtn: {
    alignSelf: 'flex-start',
    marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.ocean[500],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  sectionTitle: {
    ...Theme.textStyles.h3,
    marginBottom: Theme.spacing.md,
  },
  viewAllText: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
    marginBottom: Theme.spacing.lg,
  },
  searchIcon: {
    marginRight: Theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Theme.textStyles.body,
    color: Theme.colors.text.primary,
    paddingVertical: 0,
  },
  gridWrapper: {
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  projectCard: {
    width: '48%',
    marginBottom: Theme.spacing.xs,
  },
  projectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  pageCount: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
    backgroundColor: Theme.colors.surface.secondary,
    paddingHorizontal: Theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.sm,
  },
  projectTitle: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.semiBold,
  },
  projectDate: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.muted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xxl,
  },
  emptyTitle: {
    ...Theme.textStyles.h3,
    marginTop: Theme.spacing.md,
  },
  emptySubtitle: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  // PDF tools specific layout
  utilityGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  utilityCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Theme.colors.border.light,
    backgroundColor: Theme.colors.surface.primary,
    textAlign: 'center',
  },
  utilityIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  utilityTitle: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.bold,
    textAlign: 'center',
  },
  utilityDesc: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: Theme.colors.surface.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  modalTitle: {
    ...Theme.textStyles.h2,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    ...Theme.textStyles.body,
    color: Theme.colors.text.primary,
  },
  modalInstruction: {
    ...Theme.textStyles.bodySmall,
    fontFamily: Theme.typography.fontFamilies.bold,
    marginBottom: Theme.spacing.xs,
  },
  modalScroll: {
    maxHeight: 280,
    marginVertical: Theme.spacing.sm,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  modalListItemActive: {
    backgroundColor: Theme.colors.ocean[50],
  },
  modalItemTitle: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.medium,
  },
  modalItemSub: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
  },
  mergeIndexBadge: {
    backgroundColor: Theme.colors.ocean[500],
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeIndexText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyModalText: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },
  splitPageThumb: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.xs,
    marginLeft: Theme.spacing.md,
    marginRight: Theme.spacing.md,
    backgroundColor: '#DDD',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
});
