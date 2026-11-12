import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  USER: '@docscanner:user',
  SESSION: '@docscanner:session',
  PROJECTS: '@docscanner:projects',
  SETTINGS: '@docscanner:settings',
  RECENT_PROJECTS: '@docscanner:recent_projects',
} as const;

export const storage = {
  async setUser(user: unknown): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<unknown | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  },

  async setSession(session: unknown): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  },

  async getSession(): Promise<unknown | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
    return data ? JSON.parse(data) : null;
  },

  async removeSession(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
  },

  async setProjects(projects: unknown[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  },

  async getProjects(): Promise<unknown[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  async addProject(project: unknown): Promise<void> {
    const projects = await this.getProjects();
    projects.unshift(project);
    await this.setProjects(projects);
  },

  async updateProject(projectId: string, updates: unknown): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex((p: unknown) => (p as { id: string }).id === projectId);
    if (index !== -1) {
      projects[index] = { ...(projects[index] as Record<string, unknown>), ...(updates as Record<string, unknown>) };
      await this.setProjects(projects);
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getProjects();
    const filtered = projects.filter((p: unknown) => (p as { id: string }).id !== projectId);
    await this.setProjects(filtered);
  },

  async setSettings(settings: unknown): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  async getSettings(): Promise<unknown | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  },

  async setRecentProjects(projectIds: string[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.RECENT_PROJECTS, JSON.stringify(projectIds));
  },

  async getRecentProjects(): Promise<string[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_PROJECTS);
    return data ? JSON.parse(data) : [];
  },

  async clearAll(): Promise<void> {
    // AsyncStorage v3 dropped multiRemove
    await Promise.all(Object.values(STORAGE_KEYS).map(key => AsyncStorage.removeItem(key)));
  },
};