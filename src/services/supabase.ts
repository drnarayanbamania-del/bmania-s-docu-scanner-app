import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../utils/storage';
import { localFiles } from '../utils/localFiles';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Maps Postgres rows (snake_case) onto the app's Project shape (camelCase).
const toProject = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  metadata: row.metadata || {},
  pageCount: row.page_count ?? 0,
  thumbnailUrl: row.thumbnail_url ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Maps Postgres rows onto the app's ScannedPage shape.
const toScannedPage = (row: any) => ({
  id: row.id,
  projectId: row.project_id,
  imageUri: row.image_uri,
  originalUri: row.original_uri ?? row.image_uri,
  processedUri: row.processed_uri ?? undefined,
  order: row.order ?? 0,
  cropPoints: row.crop_points ?? undefined,
  filters: row.filters,
  createdAt: row.created_at,
});

// App field names (camelCase) mapped to their Postgres column names.
const PROJECT_COLUMNS: Record<string, string> = {
  title: 'title',
  metadata: 'metadata',
  thumbnailUrl: 'thumbnail_url',
  pageCount: 'page_count',
};

const PAGE_COLUMNS: Record<string, string> = {
  imageUri: 'image_uri',
  originalUri: 'original_uri',
  processedUri: 'processed_uri',
  cropPoints: 'crop_points',
  filters: 'filters',
  order: 'order',
};

// Web pickers hand back short-lived blob: URLs. They die on reload, so convert
// them into self-contained data URLs before they are persisted.
const toPersistentUri = async (uri?: string): Promise<string | undefined> => {
  if (!uri || Platform.OS !== 'web' || !uri.startsWith('blob:')) return uri;
  try {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return uri;
  }
};

const toColumnPayload = (
  updates: Record<string, any>,
  columns: Record<string, string>
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  Object.entries(updates).forEach(([key, value]) => {
    const column = columns[key];
    if (column && value !== undefined) {
      payload[column] = value;
    }
  });
  return payload;
};

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
          // Let supabase-js own its session key (sb-<ref>-auth-token); a custom
          // adapter that only recognised 'sb-auth-token' dropped the session on reload.
          storage: AsyncStorage,
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
    return {
      project: data ? toProject(data) : null,
      error: error ? new Error(error.message) : null,
    };
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
    const projects = data ? data.map(toProject) : null;
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
    const project = data ? toProject(data) : null;
    return { project, error: error ? new Error(error.message) : null };
  }

  async updateProject(projectId: string, updates: Record<string, unknown>): Promise<Error | null> {
    if (this.isMock) {
      await storage.updateProject(projectId, updates);
      return null;
    }
    const client = this.getClient();
    const payload = {
      ...toColumnPayload(updates, PROJECT_COLUMNS),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('projects').update(payload).eq('id', projectId);
    return error ? new Error(error.message) : null;
  }

  async deleteProject(projectId: string): Promise<Error | null> {
    if (this.isMock) {
      await storage.deleteProject(projectId);
      // Delete page metadata
      await localFiles.deleteProjectPages(projectId);
      // Delete all image files for this project
      await localFiles.deleteProjectFiles(projectId);
      return null;
    }
    const client = this.getClient();
    const { error } = await client.from('projects').delete().eq('id', projectId);
    return error ? new Error(error.message) : null;
  }

  // Scanned Pages
  async createScannedPage(projectId: string, pageData: any): Promise<{ page: unknown | null; error: Error | null }> {
    if (this.isMock) {
      const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // ── Persist images to permanent local storage ──
      const originalSrc = pageData.originalUri || pageData.imageUri;
      const processedSrc = pageData.processedUri || pageData.imageUri;

      const [permanentImageUri, permanentOriginalUri] = await Promise.all([
        localFiles.saveScannedImage(projectId, pageId, processedSrc, 'page'),
        localFiles.saveScannedImage(projectId, pageId, originalSrc, 'original'),
      ]);

      const newPage = {
        id: pageId,
        projectId,
        originalUri: permanentOriginalUri,
        imageUri: permanentImageUri,
        processedUri: permanentImageUri,
        order: pageData.order || 0,
        cropPoints: pageData.cropPoints || null,
        filters: pageData.filters || null,
        createdAt: new Date().toISOString(),
      };

      // Save metadata via LocalFileService (AsyncStorage)
      await localFiles.savePage(newPage);

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
    const [imageUri, originalUri, processedUri] = await Promise.all([
      toPersistentUri(pageData.imageUri),
      toPersistentUri(pageData.originalUri),
      toPersistentUri(pageData.processedUri),
    ]);
    const { data, error } = await client
      .from('scanned_pages')
      .insert({
        project_id: projectId,
        image_uri: imageUri ?? '',
        original_uri: originalUri,
        processed_uri: processedUri,
        order: pageData.order ?? 0,
        crop_points: pageData.cropPoints,
        filters: pageData.filters,
      })
      .select()
      .single();
    const page = data ? toScannedPage(data) : null;
    if (page) {
      await this.syncPageCount(client, projectId);
    }
    return { page, error: error ? new Error(error.message) : null };
  }

  async getScannedPages(projectId: string): Promise<{ pages: unknown[] | null; error: Error | null }> {
    if (this.isMock) {
      const pages = await localFiles.getPages(projectId);
      return { pages, error: null };
    }
    const client = this.getClient();
    const { data, error } = await client
      .from('scanned_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    const pages = data ? data.map(toScannedPage) : null;
    return { pages, error: error ? new Error(error.message) : null };
  }

  async updateScannedPage(pageId: string, updates: any): Promise<Error | null> {
    if (this.isMock) {
      await localFiles.updatePage(pageId, updates);
      return null;
    }
    const client = this.getClient();
    const payload = toColumnPayload(updates, PAGE_COLUMNS);
    if (Object.keys(payload).length === 0) return null;
    for (const column of ['image_uri', 'original_uri', 'processed_uri']) {
      if (typeof payload[column] === 'string') {
        payload[column] = await toPersistentUri(payload[column] as string);
      }
    }
    const { error } = await client.from('scanned_pages').update(payload).eq('id', pageId);
    return error ? new Error(error.message) : null;
  }

  async deleteScannedPage(pageId: string): Promise<Error | null> {
    if (this.isMock) {
      const pages = await localFiles.getPages();
      const page = pages.find((p: any) => p.id === pageId);
      if (page) {
        // Delete physical image files
        await localFiles.deletePageFiles(page.projectId, pageId);
        // Delete metadata
        await localFiles.deletePage(pageId);
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
    const { data } = await client
      .from('scanned_pages')
      .select('project_id')
      .eq('id', pageId)
      .single();
    const { error } = await client.from('scanned_pages').delete().eq('id', pageId);
    if (!error && data?.project_id) {
      await this.syncPageCount(client, data.project_id);
    }
    return error ? new Error(error.message) : null;
  }

  // Keeps projects.page_count in sync with the pages actually stored in Postgres.
  private async syncPageCount(client: SupabaseClient, projectId: string): Promise<void> {
    const { count } = await client
      .from('scanned_pages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    await client
      .from('projects')
      .update({ page_count: count ?? 0, updated_at: new Date().toISOString() })
      .eq('id', projectId);
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;