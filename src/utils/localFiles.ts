import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Directory structure ────────────────────────────────────────────────────
// <documentDirectory>/
//   docscanner/
//     projects/<projectId>/
//       pages/<pageId>.jpg        ← scanned + processed images
//       originals/<pageId>.jpg    ← original camera captures
//       exports/<filename>.pdf    ← generated PDFs
// ──────────────────────────────────────────────────────────────────────────────

const ROOT_DIR = `${FileSystem.documentDirectory}docscanner/`;

export class LocalFileService {
  private static instance: LocalFileService;

  static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  // ── Directory helpers ──────────────────────────────────────────────────────

  private async ensureDir(path: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(path, { intermediates: true });
    }
  }

  async getProjectDir(projectId: string): Promise<string> {
    const dir = `${ROOT_DIR}projects/${projectId}/`;
    await this.ensureDir(dir);
    return dir;
  }

  async getPagesDir(projectId: string): Promise<string> {
    const dir = `${ROOT_DIR}projects/${projectId}/pages/`;
    await this.ensureDir(dir);
    return dir;
  }

  async getOriginalsDir(projectId: string): Promise<string> {
    const dir = `${ROOT_DIR}projects/${projectId}/originals/`;
    await this.ensureDir(dir);
    return dir;
  }

  async getExportsDir(projectId: string): Promise<string> {
    const dir = `${ROOT_DIR}projects/${projectId}/exports/`;
    await this.ensureDir(dir);
    return dir;
  }

  // ── Image persistence ──────────────────────────────────────────────────────

  /**
   * Copies a scanned image from its temp/camera URI to a permanent local path.
   * Returns the new permanent URI.
   */
  async saveScannedImage(
    projectId: string,
    pageId: string,
    sourceUri: string,
    type: 'page' | 'original' = 'page'
  ): Promise<string> {
    if (Platform.OS === 'web') return sourceUri; // Web uses blob/http URLs

    const dir = type === 'original'
      ? await this.getOriginalsDir(projectId)
      : await this.getPagesDir(projectId);

    const destPath = `${dir}${pageId}.jpg`;

    // If already in our permanent storage, return as-is
    if (sourceUri.startsWith(ROOT_DIR)) return sourceUri;

    // If it's a base64 data URI, write directly
    if (sourceUri.startsWith('data:image')) {
      const base64 = sourceUri.split(',')[1];
      await FileSystem.writeAsStringAsync(destPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return destPath;
    }

    // Otherwise copy from temp/camera location
    await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    return destPath;
  }

  /**
   * Saves a PDF export to the project's exports directory.
   * Returns the permanent path.
   */
  async savePDFExport(
    projectId: string,
    fileName: string,
    sourceUri: string
  ): Promise<string> {
    if (Platform.OS === 'web') return sourceUri;

    const dir = await this.getExportsDir(projectId);
    const destPath = `${dir}${fileName}`;

    if (sourceUri.startsWith(ROOT_DIR)) return sourceUri;

    await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    return destPath;
  }

  // ── File info ──────────────────────────────────────────────────────────────

  async getFileSize(uri: string): Promise<number> {
    if (Platform.OS === 'web') return 0;
    try {
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      return info.exists && 'size' in info ? (info.size ?? 0) : 0;
    } catch {
      return 0;
    }
  }

  async fileExists(uri: string): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch {
      return false;
    }
  }

  // ── Deletion ───────────────────────────────────────────────────────────────

  async deletePageFiles(projectId: string, pageId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const paths = [
      `${ROOT_DIR}projects/${projectId}/pages/${pageId}.jpg`,
      `${ROOT_DIR}projects/${projectId}/originals/${pageId}.jpg`,
    ];
    await Promise.all(
      paths.map(async (p) => {
        try {
          const info = await FileSystem.getInfoAsync(p);
          if (info.exists) await FileSystem.deleteAsync(p, { idempotent: true });
        } catch {}
      })
    );
  }

  async deleteProjectFiles(projectId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      const dir = `${ROOT_DIR}projects/${projectId}/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
    } catch {}
  }

  // ── Storage stats ──────────────────────────────────────────────────────────

  async getStorageStats(): Promise<{ usedBytes: number; formattedSize: string }> {
    if (Platform.OS === 'web') return { usedBytes: 0, formattedSize: '0 B' };

    let totalBytes = 0;
    try {
      const info = await FileSystem.getInfoAsync(ROOT_DIR);
      if (!info.exists) return { usedBytes: 0, formattedSize: '0 B' };

      const walk = async (dir: string) => {
        const items = await FileSystem.readDirectoryAsync(dir);
        for (const item of items) {
          const fullPath = `${dir}${item}`;
          const itemInfo = await FileSystem.getInfoAsync(fullPath, { size: true });
          if (itemInfo.exists) {
            if ('size' in itemInfo && typeof itemInfo.size === 'number') {
              totalBytes += itemInfo.size;
            } else {
              // It's a directory — recurse
              try { await walk(`${fullPath}/`); } catch {}
            }
          }
        }
      };

      await walk(ROOT_DIR);
    } catch {}

    return {
      usedBytes: totalBytes,
      formattedSize: formatBytes(totalBytes),
    };
  }

  // ── AsyncStorage metadata ──────────────────────────────────────────────────

  private readonly PAGES_KEY = '@docscanner:scanned_pages';

  async getPages(projectId?: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(this.PAGES_KEY);
    const all: any[] = raw ? JSON.parse(raw) : [];
    if (!projectId) return all;
    return all
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => a.order - b.order);
  }

  async savePage(page: any): Promise<void> {
    const all = await this.getPages();
    const idx = all.findIndex((p) => p.id === page.id);
    if (idx !== -1) {
      all[idx] = page;
    } else {
      all.push(page);
    }
    await AsyncStorage.setItem(this.PAGES_KEY, JSON.stringify(all));
  }

  async updatePage(pageId: string, updates: any): Promise<void> {
    const all = await this.getPages();
    const idx = all.findIndex((p) => p.id === pageId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      await AsyncStorage.setItem(this.PAGES_KEY, JSON.stringify(all));
    }
  }

  async deletePage(pageId: string): Promise<void> {
    const all = await this.getPages();
    const filtered = all.filter((p) => p.id !== pageId);
    await AsyncStorage.setItem(this.PAGES_KEY, JSON.stringify(filtered));
  }

  async deleteProjectPages(projectId: string): Promise<void> {
    const all = await this.getPages();
    const filtered = all.filter((p) => p.projectId !== projectId);
    await AsyncStorage.setItem(this.PAGES_KEY, JSON.stringify(filtered));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const localFiles = LocalFileService.getInstance();
