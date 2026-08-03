import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../utils/storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

class SupabaseService {
  private client: SupabaseClient | null = null;
  private isMock = false;

  constructor() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || !SUPABASE_URL.startsWith('http')) {
      console.warn("Supabase credentials not configured. Using Mock Local Database.");
      this.isMock = true;
      return;
    }

    try {
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: {
            getItem: async (key: string) => {
              if (key === 'sb-auth-token') {
                const session = await storage.getSession();
                return session ? JSON.stringify(session) : null;
              }
              return null;
            },
            setItem: async (key: string, value: string) => {
              if (key === 'sb-auth-token') {
                await storage.setSession(JSON.parse(value));
              }
            },
            removeItem: async (key: string) => {
              if (key === 'sb-auth-token') {
                await storage.removeSession();
              }
            },
          },
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      });

      // Load session in background
      this.client.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          storage.setSession(session);
        }
      }).catch(e => console.error("Failed to load supabase session:", e));
    } catch (e) {
      console.error("Failed to initialize Supabase, falling back to Mock:", e);
      this.isMock = true;
    }
  }

  getClient(): SupabaseClient {
    return this.client!;
  }

  async getSession(): Promise<Session | null> {
    if (this.isMock) {
      const session = await storage.getSession();
      return session as any;
    }
    const client = this.getClient();
    const { data: { session } } = await client.auth.getSession();
    return session;
  }

  async getUser(): Promise<User | null> {
    if (this.isMock) {
      const user = await storage.getUser();
      return user as any;
    }
    const client = this.getClient();
    const { data: { user } } = await client.auth.getUser();
    return user;
  }

  async signUp(email: string, password: string, name: string): Promise<{ user: User | null; error: Error | null }> {
    if (this.isMock) {
      const user = { id: 'mock-user', email, name, createdAt: new Date().toISOString() };
      await storage.setUser(user);
      await storage.setSession({ access_token: 'mock-token', user } as any);
      return { user: user as any, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (data.user) {
      await storage.setUser({ id: data.user.id, email, name, createdAt: new Date().toISOString() });
    }
    return { user: data.user, error: error ? new Error(error.message) : null };
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
    if (this.isMock) {
      const storedUser = await storage.getUser() as any;
      const user = storedUser || { id: 'mock-user', email, name: 'Local User', createdAt: new Date().toISOString() };
      await storage.setUser(user);
      await storage.setSession({ access_token: 'mock-token', user } as any);
      return { user: user as any, session: { access_token: 'mock-token', user } as any, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (data.user && data.session) {
      await storage.setUser({ id: data.user.id, email, name: data.user.user_metadata.name, createdAt: new Date().toISOString() });
      await storage.setSession(data.session);
    }
    return { user: data.user, session: data.session, error: error ? new Error(error.message) : null };
  }

  async signOut(): Promise<Error | null> {
    if (this.isMock) {
      await storage.removeUser();
      await storage.removeSession();
      return null;
    }
    const client = this.getClient();
    const { error } = await client.auth.signOut();
    await storage.removeUser();
    await storage.removeSession();
    return error ? new Error(error.message) : null;
  }

  async resetPassword(email: string): Promise<Error | null> {
    if (this.isMock) return null;
    const client = this.getClient();
    const { error } = await client.auth.resetPasswordForEmail(email);
    return error ? new Error(error.message) : null;
  }

  async updateProfile(data: { name?: string; avatarUrl?: string }): Promise<Error | null> {
    if (this.isMock) {
      const user = await storage.getUser() as any;
      if (user) {
        const updated = { ...user, ...data };
        await storage.setUser(updated);
      }
      return null;
    }
    const client = this.getClient();
    const { error } = await client.auth.updateUser({ data });
    return error ? new Error(error.message) : null;
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (this.isMock) {
      // Mock triggers signed-in initially if there is a local user
      storage.getUser().then((user) => {
        if (user) {
          callback('SIGNED_IN', { user } as any);
        } else {
          callback('SIGNED_OUT', null);
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => {}
          }
        }
      };
    }
    const client = this.getClient();
    return client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
      if (session) {
        storage.setSession(session);
      } else {
        storage.removeSession();
      }
    });
  }

  // Projects
  async createProject(userId: string, title: string, metadata: Record<string, unknown> = {}): Promise<{ project: unknown | null; error: Error | null }> {
    if (this.isMock) {
      const project = {
        id: `proj-${Date.now()}`,
        userId,
        title,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageCount: 0,
      };
      await storage.addProject(project);
      return { project, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('projects')
      .insert({ user_id: userId, title, metadata })
      .select()
      .single();
    return { project: data, error: error ? new Error(error.message) : null };
  }

  async getProjects(userId: string): Promise<{ projects: unknown[] | null; error: Error | null }> {
    if (this.isMock) {
      const projects = await storage.getProjects();
      return { projects, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    const projects = data ? data.map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      title: p.title,
      metadata: p.metadata || {},
      pageCount: p.page_count ?? 0,
      thumbnailUrl: p.thumbnail_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })) : null;
    return { projects, error: error ? new Error(error.message) : null };
  }

  async getProject(projectId: string): Promise<{ project: unknown | null; error: Error | null }> {
    if (this.isMock) {
      const projects = await storage.getProjects();
      const project = projects.find((p: any) => p.id === projectId);
      return { project: project || null, error: project ? null : new Error('Project not found') };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    const project = data ? {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      metadata: data.metadata || {},
      pageCount: data.page_count ?? 0,
      thumbnailUrl: data.thumbnail_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } : null;
    return { project, error: error ? new Error(error.message) : null };
  }

  async updateProject(projectId: string, updates: Record<string, unknown>): Promise<Error | null> {
    if (this.isMock) {
      await storage.updateProject(projectId, updates);
      return null;
    }
    const client = this.getClient();
    const { error } = await client
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    return error ? new Error(error.message) : null;
  }

  async deleteProject(projectId: string): Promise<Error | null> {
    if (this.isMock) {
      await storage.deleteProject(projectId);
      const pagesStr = await AsyncStorage.getItem('@docscanner:scanned_pages');
      if (pagesStr) {
        const pages = JSON.parse(pagesStr);
        const filtered = pages.filter((p: any) => p.projectId !== projectId);
        await AsyncStorage.setItem('@docscanner:scanned_pages', JSON.stringify(filtered));
      }
      return null;
    }
    const client = this.getClient();
    const { error } = await client.from('projects').delete().eq('id', projectId);
    return error ? new Error(error.message) : null;
  }

  // Scanned Pages
  async createScannedPage(projectId: string, pageData: any): Promise<{ page: unknown | null; error: Error | null }> {
    if (this.isMock) {
      const pagesStr = await AsyncStorage.getItem('@docscanner:scanned_pages');
      const pages = pagesStr ? JSON.parse(pagesStr) : [];
      const newPage = {
        id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        originalUri: pageData.originalUri || pageData.imageUri,
        imageUri: pageData.imageUri,
        processedUri: pageData.processedUri || pageData.imageUri,
        order: pageData.order || 0,
        createdAt: new Date().toISOString(),
      };
      pages.push(newPage);
      await AsyncStorage.setItem('@docscanner:scanned_pages', JSON.stringify(pages));

      // Increase page count in project
      const projects = await storage.getProjects();
      const idx = projects.findIndex((p: any) => p.id === projectId);
      if (idx !== -1) {
        (projects[idx] as any).pageCount = ((projects[idx] as any).pageCount || 0) + 1;
        (projects[idx] as any).updatedAt = new Date().toISOString();
        await storage.setProjects(projects);
      }

      return { page: newPage, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('scanned_pages')
      .insert({
        project_id: projectId,
        image_uri: pageData.imageUri,
        original_uri: pageData.originalUri,
        processed_uri: pageData.processedUri,
        order: pageData.order ?? 0,
        crop_points: pageData.cropPoints,
        filters: pageData.filters,
      })
      .select()
      .single();
    const page = data ? {
      id: data.id,
      projectId: data.project_id,
      imageUri: data.image_uri,
      originalUri: data.original_uri,
      processedUri: data.processed_uri,
      order: data.order,
      cropPoints: data.crop_points,
      filters: data.filters,
      createdAt: data.created_at,
    } : null;
    return { page, error: error ? new Error(error.message) : null };
  }

  async getScannedPages(projectId: string): Promise<{ pages: unknown[] | null; error: Error | null }> {
    if (this.isMock) {
      const pagesStr = await AsyncStorage.getItem('@docscanner:scanned_pages');
      const pages = pagesStr ? JSON.parse(pagesStr) : [];
      const projectPages = pages.filter((p: any) => p.projectId === projectId).sort((a: any, b: any) => a.order - b.order);
      return { pages: projectPages, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('scanned_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    const pages = data ? data.map((p: any) => ({
      id: p.id,
      projectId: p.project_id,
      imageUri: p.image_uri,
      originalUri: p.original_uri,
      processedUri: p.processed_uri,
      order: p.order,
      cropPoints: p.crop_points,
      filters: p.filters,
      createdAt: p.created_at,
    })) : null;
    return { pages, error: error ? new Error(error.message) : null };
  }

  async updateScannedPage(pageId: string, updates: any): Promise<Error | null> {
    if (this.isMock) {
      const pagesStr = await AsyncStorage.getItem('@docscanner:scanned_pages');
      const pages = pagesStr ? JSON.parse(pagesStr) : [];
      const idx = pages.findIndex((p: any) => p.id === pageId);
      if (idx !== -1) {
        pages[idx] = { ...pages[idx], ...updates };
        await AsyncStorage.setItem('@docscanner:scanned_pages', JSON.stringify(pages));
      }
      return null;
    }
    const client = this.getClient();
    const { error } = await client.from('scanned_pages').update(updates).eq('id', pageId);
    return error ? new Error(error.message) : null;
  }

  async deleteScannedPage(pageId: string): Promise<Error | null> {
    if (this.isMock) {
      const pagesStr = await AsyncStorage.getItem('@docscanner:scanned_pages');
      const pages = pagesStr ? JSON.parse(pagesStr) : [];
      const page = pages.find((p: any) => p.id === pageId);
      if (page) {
        const filtered = pages.filter((p: any) => p.id !== pageId);
        await AsyncStorage.setItem('@docscanner:scanned_pages', JSON.stringify(filtered));

        // Decrease page count in project
        const projects = await storage.getProjects();
        const idx = projects.findIndex((p: any) => p.id === page.projectId);
        if (idx !== -1) {
          (projects[idx] as any).pageCount = Math.max(0, ((projects[idx] as any).pageCount || 0) - 1);
          (projects[idx] as any).updatedAt = new Date().toISOString();
          await storage.setProjects(projects);
        }
      }
      return null;
    }
    const client = this.getClient();
    const { error } = await client.from('scanned_pages').delete().eq('id', pageId);
    return error ? new Error(error.message) : null;
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;