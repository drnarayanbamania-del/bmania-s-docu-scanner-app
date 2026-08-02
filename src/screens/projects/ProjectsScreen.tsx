import React, { useState } from 'react';
import { View, StyleSheet, Text, FlatList, TextInput, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Card } from '../../components/ui/Card';
import { useApp } from '../../context/AppContext';
import { Project } from '../../types';

export const ProjectsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { projects, setCurrentProject } = useApp();
  const [search, setSearch] = useState('');
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const filteredProjects = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project);
    navigation.navigate('ProjectDetail', { projectId: project.id });
  };

  const renderProjectItem = ({ item }: { item: Project }) => (
    <Card
      onPress={() => handleSelectProject(item)}
      style={styles.projectCard}
      padding="md"
    >
      <View style={styles.projectCardHeader}>
        <Ionicons name="folder" size={32} color={Theme.colors.ocean[500]} />
        <Text style={styles.pageCount}>{item.pageCount} pages</Text>
      </View>
      <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.projectDate}>
        Last updated {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Text style={styles.headerTitle}>All Documents</Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, isLargeScreen && styles.largeContent]}>
        <Ionicons name="search" size={20} color={Theme.colors.text.muted} style={styles.searchIcon} />
        <TextInput
          placeholder="Search all documents..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={Theme.colors.text.muted}
        />
      </View>

      {filteredProjects.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={60} color={Theme.colors.text.muted} />
          <Text style={styles.emptyTitle}>No documents</Text>
          <Text style={styles.emptySubtitle}>No documents match your query or have been created.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderProjectItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, isLargeScreen && styles.largeContent]}
        />
      )}
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
  },
  headerTitle: {
    ...Theme.textStyles.h2,
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
    marginHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
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
  listContent: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
    gap: Theme.spacing.md,
  },
  largeContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
    marginHorizontal: 0,
  },
  projectCard: {
    width: '100%',
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
    ...Theme.textStyles.bodyLarge,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  projectDate: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.muted,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
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
});
