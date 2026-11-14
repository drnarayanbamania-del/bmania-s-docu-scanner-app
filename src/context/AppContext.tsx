import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Project, ScannedPage, AppState } from '../types';
import { supabaseService } from '../services/supabase';
import { firebaseService } from '../services/firebase';
import { useAuth } from './AuthContext';

type AuthProviderType = 'supabase' | 'firebase';
const AUTH_PROVIDER: AuthProviderType = 'supabase';

interface AppContextType extends AppState {
  setCurrentProject: (project: Project | null) => void;
  loadProjects: () => Promise<void>;
  loadScannedPages: (projectId: string) => Promise<ScannedPage[]>;
  createProject: (title: string, metadata?: Record<string, unknown>) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  addScannedPages: (projectId: string, pages: Omit<ScannedPage, 'id' | 'projectId' | 'createdAt'>[]) => Promise<void>;
  updateScannedPage: (pageId: string, updates: Partial<ScannedPage>) => Promise<void>;
  deleteScannedPage: (projectId: string, pageId: string) => Promise<void>;
  reorderPages: (projectId: string, pages: ScannedPage[]) => Promise<void>;
  setScanning: (isScanning: boolean) => void;
  setCameraPermission: (granted: boolean) => void;
  clearCurrentProject: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>({
    currentProject: null,
    projects: [],
    scannedPages: [],
    isScanning: false,
    cameraPermission: false,
  });

  const loadProjects = useCallback(async () => {
    if (!user) return;
    try {
      let result;
      if (AUTH_PROVIDER === 'supabase') {
        result = await supabaseService.getProjects(user.id);
      } else {
        result = await firebaseService.getProjects(user.id);
      }
      if (result.error) throw result.error;
      setState(prev => ({ ...prev, projects: result.projects as Project[] }));
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }, [user]);

  const loadScannedPages = useCallback(async (projectId: string): Promise<ScannedPage[]> => {
    try {
      let result;
      if (AUTH_PROVIDER === 'supabase') {
        result = await supabaseService.getScannedPages(projectId);
      } else {
        result = await firebaseService.getScannedPages(projectId);
      }
      if (result.error) throw result.error;
      const pages = (result.pages || []) as ScannedPage[];
      // Merge into state so cached pages are available
      setState(prev => {
        const otherPages = prev.scannedPages.filter(p => p.projectId !== projectId);
        return { ...prev, scannedPages: [...otherPages, ...pages].sort((a, b) => a.order - b.order) };
      });
      return pages;
    } catch (error) {
      console.error('Failed to load scanned pages:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const setCurrentProject = useCallback((project: Project | null) => {
    setState(prev => ({ ...prev, currentProject: project }));
  }, []);

  const createProject = useCallback(async (title: string, metadata: Record<string, unknown> = {}) => {
    if (!user) return null;
    try {
      let result;
      if (AUTH_PROVIDER === 'supabase') {
        result = await supabaseService.createProject(user.id, title, metadata);
      } else {
        result = await firebaseService.createProject(user.id, title, metadata);
      }
      if (result.error) throw result.error;
      const newProject = result.project as Project;
      setState(prev => ({ ...prev, projects: [newProject, ...prev.projects] }));
      return newProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  }, [user]);

  const updateProject = useCallback(async (projectId: string, updates: Partial<Project>) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.updateProject(projectId, updates);
      } else {
        error = await firebaseService.updateProject(projectId, updates);
      }
      if (error) throw error;
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === projectId ? { ...p, ...updates } : p),
        currentProject: prev.currentProject?.id === projectId ? { ...prev.currentProject, ...updates } : prev.currentProject,
      }));
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.deleteProject(projectId);
      } else {
        error = await firebaseService.deleteProject(projectId);
      }
      if (error) throw error;
      setState(prev => ({
        ...prev,
        projects: prev.projects.filter(p => p.id !== projectId),
        currentProject: prev.currentProject?.id === projectId ? null : prev.currentProject,
      }));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, []);

  const addScannedPages = useCallback(async (projectId: string, pages: Omit<ScannedPage, 'id' | 'projectId' | 'createdAt'>[]) => {
    if (!user) return;
    try {
      const newPages: ScannedPage[] = [];
      for (let i = 0; i < pages.length; i++) {
        const pageData = { ...pages[i], projectId, order: pages[i].order };
        let result;
        if (AUTH_PROVIDER === 'supabase') {
          result = await supabaseService.createScannedPage(projectId, pageData);
        } else {
          result = await firebaseService.createScannedPage(projectId, pageData);
        }
        if (result.error) throw result.error;
        newPages.push({ ...pageData, id: (result.page as ScannedPage).id, createdAt: new Date().toISOString() });
      }
      setState(prev => ({
        ...prev,
        scannedPages: [...prev.scannedPages, ...newPages].sort((a, b) => a.order - b.order),
        projects: prev.projects.map(p => p.id === projectId
          ? { ...p, pageCount: (p.pageCount || 0) + newPages.length, updatedAt: new Date().toISOString() }
          : p),
        currentProject: prev.currentProject?.id === projectId
          ? { ...prev.currentProject, pageCount: prev.currentProject.pageCount + newPages.length }
          : prev.currentProject,
      }));
    } catch (error) {
      console.error('Failed to add scanned pages:', error);
    }
  }, [user]);

  const updateScannedPage = useCallback(async (pageId: string, updates: Partial<ScannedPage>) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.updateScannedPage(pageId, updates);
      } else {
        error = await firebaseService.updateScannedPage(pageId, updates);
      }
      if (error) throw error;
      setState(prev => ({
        ...prev,
        scannedPages: prev.scannedPages.map(p => p.id === pageId ? { ...p, ...updates } : p),
      }));
    } catch (error) {
      console.error('Failed to update scanned page:', error);
    }
  }, []);

  const deleteScannedPage = useCallback(async (projectId: string, pageId: string) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.deleteScannedPage(pageId);
      } else {
        error = await firebaseService.deleteScannedPage(pageId);
      }
      if (error) throw error;
      setState(prev => ({
        ...prev,
        scannedPages: prev.scannedPages.filter(p => p.id !== pageId),
        projects: prev.projects.map(p => p.id === projectId
          ? { ...p, pageCount: Math.max(0, (p.pageCount || 0) - 1) }
          : p),
        currentProject: prev.currentProject?.id === projectId
          ? { ...prev.currentProject, pageCount: Math.max(0, prev.currentProject.pageCount - 1) }
          : prev.currentProject,
      }));
    } catch (error) {
      console.error('Failed to delete scanned page:', error);
    }
  }, []);

  const reorderPages = useCallback(async (projectId: string, pages: ScannedPage[]) => {
    try {
      const updates = pages.map((page, index) => ({ id: page.id, order: index }));
      for (const update of updates) {
        let error: Error | null = null;
        if (AUTH_PROVIDER === 'supabase') {
          error = await supabaseService.updateScannedPage(update.id, { order: update.order });
        } else {
          error = await firebaseService.updateScannedPage(update.id, { order: update.order });
        }
        if (error) throw error;
      }
      setState(prev => ({
        ...prev,
        scannedPages: pages,
      }));
    } catch (error) {
      console.error('Failed to reorder pages:', error);
    }
  }, []);

  const setScanning = useCallback((isScanning: boolean) => {
    setState(prev => ({ ...prev, isScanning }));
  }, []);

  const setCameraPermission = useCallback((granted: boolean) => {
    setState(prev => ({ ...prev, cameraPermission: granted }));
  }, []);

  const clearCurrentProject = useCallback(() => {
    setState(prev => ({ ...prev, currentProject: null, scannedPages: [] }));
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      setCurrentProject,
      loadProjects,
      loadScannedPages,
      createProject,
      updateProject,
      deleteProject,
      addScannedPages,
      updateScannedPage,
      deleteScannedPage,
      reorderPages,
      setScanning,
      setCameraPermission,
      clearCurrentProject,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};