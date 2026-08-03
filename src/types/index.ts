export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  pageCount: number;
}

export interface ScannedPage {
  id: string;
  projectId: string;
  imageUri: string;
  originalUri: string;
  processedUri?: string;
  order: number;
  cropPoints?: CropPoints;
  filters: FilterSettings;
  createdAt: string;
}

export interface CropPoints {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

export interface FilterSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  clarity: number;
  grayscale: boolean;
  autoEnhance: boolean;
  preset?: 'original' | 'color' | 'magic' | 'bw' | 'grayscale' | 'hd' | 'shadows' | 'noise' | 'clarity' | 'vivid';
}

export interface PDFExportOptions {
  pageSize: 'A4' | 'Letter' | 'Legal';
  margin: number;
  quality: 'low' | 'medium' | 'high';
  password?: string;
  includeMetadata: boolean;
}

export interface AuthState {
  user: User | null;
  session: unknown | null;
  loading: boolean;
  error: string | null;
}

export interface AppState {
  currentProject: Project | null;
  projects: Project[];
  scannedPages: ScannedPage[];
  isScanning: boolean;
  cameraPermission: boolean;
}

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  Dashboard: undefined;
  Scan: { projectId?: string };
  Camera: { projectId: string };
  Review: { projectId: string; pageId?: string };
  Edit: { projectId: string; pageId: string };
  Projects: undefined;
  ProjectDetail: { projectId: string };
  Settings: undefined;
  Export: { projectId: string };
};

export type BottomTabParamList = {
  Dashboard: undefined;
  Scan: undefined;
  Projects: undefined;
  Settings: undefined;
};