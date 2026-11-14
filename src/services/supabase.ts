import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
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

// ─── Object storage ──────────────────────────────────────────────────────────
// Page images live in the private `scanned-pages` bucket and the database only
// keeps the object path, so the same scan opens on any device.

const BUCKET = 'scanned-pages';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SIGNED_URL_REFRESH_MS = (SIGNED_URL_TTL_SECONDS - 60 * 60) * 1000;

const isInlineOrLocalUri = (value: string) => /^(data:|blob:|file:|content:|https?:)/i.test(value);

// Pulls the object path out of a signed/public storage URL.
const storagePathFromUri = (value: string): string | null => {
  const markers = [
    `/storage/v1/object/sign/${BUCKET}/`,
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/authenticated/${BUCKET}/`,
  ];
  for (const marker of markers) {
    const index = value.indexOf(marker);
    if (index !== -1) {
      const rest = value.slice(index + marker.length).split('?')[0];
      try {
        return decodeURIComponent(rest);
      } catch {
        return rest;
      }
    }
  }
  return null;
};

// Returns the bucket path when the value already points at storage.
const existingStoragePath = (value?: string | null): string | null => {
  if (!value) return null;
  const fromUrl = storagePathFromUri(value);
  if (fromUrl) return fromUrl;
  return isInlineOrLocalUri(value) ? null : value;
};

const contentTypeFor = (uri: string): { extension: string; contentType: string } => {
  const match = /^data:(image\/[a-z0-9.+-]+);/i.exec(uri);
  const mime = match?.[1]?.toLowerCase() ?? '';
  if (mime.includes('png') || /\.png(\?|$)/i.test(uri)) return { extension: 'png', contentType: 'image/png' };
  if (mime.includes('webp') || /\.webp(\?|$)/i.test(uri)) return { extension: 'webp', contentType: 'image/webp' };
  return { extension: 'jpg', contentType: 'image/jpeg' };
};

// Legacy fallback: keep an inline copy when storage is unreachable, so a scan is
// never lost. Web pickers also hand back short-lived blob: URLs, which die on
// reload and are safer stored as data URLs.
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
  private signedUrls = new Map<string, { url: string; expiresAt: number }>();

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
    const { data: rows } = await client
      .from('scanned_pages')
      .select('image_uri, original_uri, processed_uri')
      .eq('project_id', projectId);
    const { error } = await client.from('projects').delete().eq('id', projectId);
    if (!error && rows) {
      await this.removeStoredObjects(
        client,
        rows.flatMap((row: any) => [row.image_uri, row.original_uri, row.processed_uri])
      );
    }
    return error ? new Error(error.message) : null;
  }

  // ─── Storage helpers ───────────────────────────────────────────────────────

  private async currentUserId(): Promise<string> {
    const { data } = await this.client!.auth.getSession();
    return data.session?.user.id ?? '';
  }

  private objectPath(userId: string, projectId: string, extension: string): string {
    return `${userId || 'anonymous'}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  }

  // expo-file-system can only upload real files, so data: URLs are written to
  // the cache directory first.
  private async ensureLocalFile(uri: string, extension: string): Promise<string> {
    if (!uri.startsWith('data:')) return uri;
    const base64 = uri.split(',')[1] ?? '';
    const target = `${FileSystem.cacheDirectory}upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
    return target;
  }

  private async uploadImage(
    client: SupabaseClient,
    uri: string,
    userId: string,
    projectId: string
  ): Promise<string> {
    const { extension, contentType } = contentTypeFor(uri);
    const path = this.objectPath(userId, projectId, extension);

    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      const { error } = await client.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type || contentType,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      return path;
    }

    const { data: { session } } = await client.auth.getSession();
    const localUri = await this.ensureLocalFile(uri, extension);
    const response = await FileSystem.uploadAsync(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      localUri,
      {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          'content-type': contentType,
          'cache-control': 'max-age=31536000',
        },
      }
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Storage upload failed (${response.status})`);
    }
    return path;
  }

  // A duplicated page gets its own object so deleting one page cannot break another.
  private async copyImage(
    client: SupabaseClient,
    sourcePath: string,
    userId: string,
    projectId: string
  ): Promise<string> {
    const { extension } = contentTypeFor(sourcePath);
    const target = this.objectPath(userId, projectId, extension);
    const { error } = await client.storage.from(BUCKET).copy(sourcePath, target);
    if (error) throw error;
    return target;
  }

  // Turns whatever the app holds into a bucket path, uploading when needed.
  private async storeImage(
    client: SupabaseClient,
    uri: string | undefined,
    userId: string,
    projectId: string,
    mode: 'new' | 'existing'
  ): Promise<string | undefined> {
    if (!uri) return uri;
    const stored = existingStoragePath(uri);
    if (stored) {
      if (mode === 'existing') return stored;
      try {
        return await this.copyImage(client, stored, userId, projectId);
      } catch {
        return stored;
      }
    }
    try {
      return await this.uploadImage(client, uri, userId, projectId);
    } catch (e) {
      console.warn('Could not upload page image to storage, keeping it inline:', e);
      return await toPersistentUri(uri);
    }
  }

  // Signed URLs are short-lived, so they are cached per object path.
  private async resolveImageUrl(client: SupabaseClient, value?: string): Promise<string | undefined> {
    const path = existingStoragePath(value);
    if (!path) return value;
    const cached = this.signedUrls.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data } = await client.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (!data?.signedUrl) return value;
    this.signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_REFRESH_MS });
    return data.signedUrl;
  }

  private async hydratePage(client: SupabaseClient, page: any): Promise<any> {
    const [imageUri, originalUri, processedUri] = await Promise.all([
      this.resolveImageUrl(client, page.imageUri),
      this.resolveImageUrl(client, page.originalUri),
      this.resolveImageUrl(client, page.processedUri),
    ]);
    return {
      ...page,
      imageUri: imageUri ?? page.imageUri,
      originalUri: originalUri ?? page.originalUri,
      processedUri: processedUri,
    };
  }

  private async removeStoredObjects(
    client: SupabaseClient,
    values: Array<string | undefined | null>
  ): Promise<void> {
    const paths = Array.from(new Set(values.map(existingStoragePath).filter((p): p is string => !!p)));
    if (paths.length === 0) return;
    paths.forEach(p => this.signedUrls.delete(p));
    const { error } = await client.storage.from(BUCKET).remove(paths);
    if (error) console.warn('Could not remove page images from storage:', error.message);
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
    const userId = await this.currentUserId();
    const [imageUri, originalUri, processedUri] = await Promise.all([
      this.storeImage(client, pageData.imageUri, userId, projectId, 'new'),
      this.storeImage(client, pageData.originalUri, userId, projectId, 'new'),
      this.storeImage(client, pageData.processedUri, userId, projectId, 'new'),
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
    const page = data ? await this.hydratePage(client, toScannedPage(data)) : null;
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
    const pages = data
      ? await Promise.all(data.map(row => this.hydratePage(client, toScannedPage(row))))
      : null;
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
    const imageColumns = ['image_uri', 'original_uri', 'processed_uri'];
    let previous: Record<string, any> | null = null;
    if (imageColumns.some(column => typeof payload[column] === 'string')) {
      const userId = await this.currentUserId();
      const { data: row } = await client
        .from('scanned_pages')
        .select('project_id, image_uri, original_uri, processed_uri')
        .eq('id', pageId)
        .single();
      previous = row ?? null;
      for (const column of imageColumns) {
        if (typeof payload[column] === 'string') {
          payload[column] = await this.storeImage(
            client,
            payload[column] as string,
            userId,
            previous?.project_id ?? '',
            'existing'
          );
        }
      }
    }
    const { error } = await client.from('scanned_pages').update(payload).eq('id', pageId);
    if (!error && previous) {
      // Images replaced by this update (a rotation, for example) are dead weight.
      const replaced = imageColumns
        .filter(column => typeof payload[column] === 'string' && payload[column] !== previous![column])
        .map(column => previous![column] as string);
      if (replaced.length > 0) {
        await this.removeStoredObjects(client, replaced);
      }
    }
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
      .select('project_id, image_uri, original_uri, processed_uri')
      .eq('id', pageId)
      .single();
    const { error } = await client.from('scanned_pages').delete().eq('id', pageId);
    if (!error) {
      await this.removeStoredObjects(client, [data?.image_uri, data?.original_uri, data?.processed_uri]);
      if (data?.project_id) {
        await this.syncPageCount(client, data.project_id);
      }
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