/**
 * Dev-only counters for page image uploads.
 *
 * Every value lives in memory for the current app session: nothing is persisted,
 * because the goal is answering "did the retry fire during this run?" while you
 * are looking at it. Both the counters and the Settings view exist only when
 * `uploadDiagnosticsEnabled` is true.
 */

export interface UploadDiagnostics {
  /** Upload sequences started for a page image. */
  uploads: number;
  /** Uploads whose first attempt failed, i.e. where the retry ran. */
  retries: number;
  /** Retries where the second attempt succeeded. */
  recovered: number;
  /** Uploads that ended as an inline data URL after both attempts failed. */
  inlineFallbacks: number;
  /** Time and message of the most recent retried upload. */
  lastRetry: { at: number; message: string } | null;
}

const EMPTY: UploadDiagnostics = {
  uploads: 0,
  retries: 0,
  recovered: 0,
  inlineFallbacks: 0,
  lastRetry: null,
};

// Expo inlines EXPO_PUBLIC_* at build time; development builds are always on, and a
// production bundle can opt in with EXPO_PUBLIC_ENABLE_UPLOAD_DIAGNOSTICS=1.
export const uploadDiagnosticsEnabled =
  process.env.NODE_ENV !== 'production' ||
  process.env.EXPO_PUBLIC_ENABLE_UPLOAD_DIAGNOSTICS === '1';

// Replaced on every change so useSyncExternalStore sees a new snapshot.
let snapshot: UploadDiagnostics = EMPTY;
const listeners = new Set<() => void>();

const publish = (next: UploadDiagnostics) => {
  snapshot = next;
  listeners.forEach(listener => listener());
};

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown upload error';
  }
};

export const getUploadDiagnostics = (): UploadDiagnostics => snapshot;

export const subscribeUploadDiagnostics = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetUploadDiagnostics = (): void => {
  publish(EMPTY);
};

export const recordUploadStarted = (): void => {
  publish({ ...snapshot, uploads: snapshot.uploads + 1 });
};

export const recordUploadRetry = (error: unknown): void => {
  publish({
    ...snapshot,
    retries: snapshot.retries + 1,
    lastRetry: { at: Date.now(), message: messageOf(error) },
  });
};

export const recordUploadRecovered = (): void => {
  publish({ ...snapshot, recovered: snapshot.recovered + 1 });
};

export const recordUploadFallback = (): void => {
  publish({ ...snapshot, inlineFallbacks: snapshot.inlineFallbacks + 1 });
};

/** Retries per upload, as a percentage; 0 when nothing has been uploaded yet. */
export const retryRate = (diagnostics: UploadDiagnostics): number =>
  diagnostics.uploads === 0 ? 0 : (diagnostics.retries / diagnostics.uploads) * 100;
