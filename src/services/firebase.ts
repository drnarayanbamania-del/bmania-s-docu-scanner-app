import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail, updateProfile, User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, Firestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Platform } from 'react-native';
import { storage } from '../utils/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

class FirebaseService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private storage: FirebaseStorage | null = null;
  private initialized = false;

  private initialize(): void {
    if (this.initialized) return;
    
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
    this.initialized = true;
  }

  getAuth(): Auth {
    this.initialize();
    return this.auth!;
  }

  getDb(): Firestore {
    this.initialize();
    return this.db!;
  }

  getStorage(): FirebaseStorage {
    this.initialize();
    return this.storage!;
  }

  async signUp(email: string, password: string, name: string): Promise<{ user: FirebaseUser | null; error: Error | null }> {
    try {
      const { user } = await createUserWithEmailAndPassword(this.getAuth(), email, password);
      await updateProfile(user, { displayName: name });
      const userData = { id: user.uid, email, name, createdAt: new Date().toISOString() };
      await storage.setUser(userData);
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: FirebaseUser | null; error: Error | null }> {
    try {
      const { user } = await signInWithEmailAndPassword(this.getAuth(), email, password);
      const userData = { id: user.uid, email, name: user.displayName, createdAt: new Date().toISOString() };
      await storage.setUser(userData);
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error as Error };
    }
  }

  async signOut(): Promise<Error | null> {
    try {
      await firebaseSignOut(this.getAuth());
      await storage.removeUser();
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  async resetPassword(email: string): Promise<Error | null> {
    try {
      await sendPasswordResetEmail(this.getAuth(), email);
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  async updateProfile(data: { name?: string; avatarUrl?: string }): Promise<Error | null> {
    try {
      const user = this.getAuth().currentUser;
      if (user) {
        await updateProfile(user, { displayName: data.name, photoURL: data.avatarUrl });
        const userData = await storage.getUser();
        if (userData) {
          await storage.setUser({ ...userData, ...data });
        }
      }
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(this.getAuth(), callback);
  }

  // Projects
  async createProject(userId: string, title: string, metadata: Record<string, unknown> = {}): Promise<{ project: unknown | null; error: Error | null }> {
    try {
      const docRef = await addDoc(collection(this.getDb(), 'projects'), {
        userId,
        title,
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageCount: 0,
      });
      return { project: { id: docRef.id, userId, title, metadata }, error: null };
    } catch (error) {
      return { project: null, error: error as Error };
    }
  }

  async getProjects(userId: string): Promise<{ projects: unknown[] | null; error: Error | null }> {
    try {
      const q = query(
        collection(this.getDb(), 'projects'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { projects, error: null };
    } catch (error) {
      return { projects: null, error: error as Error };
    }
  }

  async getProject(projectId: string): Promise<{ project: unknown | null; error: Error | null }> {
    try {
      const docSnap = await getDoc(doc(this.getDb(), 'projects', projectId));
      if (docSnap.exists()) {
        return { project: { id: docSnap.id, ...docSnap.data() }, error: null };
      }
      return { project: null, error: new Error('Project not found') };
    } catch (error) {
      return { project: null, error: error as Error };
    }
  }

  async updateProject(projectId: string, updates: Record<string, unknown>): Promise<Error | null> {
    try {
      await updateDoc(doc(this.getDb(), 'projects', projectId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  async deleteProject(projectId: string): Promise<Error | null> {
    try {
      await deleteDoc(doc(this.getDb(), 'projects', projectId));
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  // Scanned Pages
  async createScannedPage(projectId: string, pageData: unknown): Promise<{ page: unknown | null; error: Error | null }> {
    try {
      const docRef = await addDoc(collection(this.getDb(), 'scanned_pages'), {
        projectId,
        ...pageData,
        createdAt: new Date().toISOString(),
      });
      return { page: { id: docRef.id, projectId, ...pageData }, error: null };
    } catch (error) {
      return { page: null, error: error as Error };
    }
  }

  async getScannedPages(projectId: string): Promise<{ pages: unknown[] | null; error: Error | null }> {
    try {
      const q = query(
        collection(this.getDb(), 'scanned_pages'),
        where('projectId', '==', projectId),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      const pages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { pages, error: null };
    } catch (error) {
      return { pages: null, error: error as Error };
    }
  }

  async updateScannedPage(pageId: string, updates: unknown): Promise<Error | null> {
    try {
      await updateDoc(doc(this.getDb(), 'scanned_pages', pageId), updates);
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  async deleteScannedPage(pageId: string): Promise<Error | null> {
    try {
      await deleteDoc(doc(this.getDb(), 'scanned_pages', pageId));
      return null;
    } catch (error) {
      return error as Error;
    }
  }

  // Storage
  async uploadImage(uri: string, path: string): Promise<{ url: string | null; error: Error | null }> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(this.getStorage(), path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      return { url, error: null };
    } catch (error) {
      return { url: null, error: error as Error };
    }
  }

  async deleteImage(path: string): Promise<Error | null> {
    try {
      const storageRef = ref(this.getStorage(), path);
      await deleteObject(storageRef);
      return null;
    } catch (error) {
      return error as Error;
    }
  }
}

export const firebaseService = new FirebaseService();
export default firebaseService;