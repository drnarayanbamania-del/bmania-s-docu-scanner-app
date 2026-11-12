import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabaseService } from '../services/supabase';
import { firebaseService } from '../services/firebase';
import { User, AuthState } from '../types';

type AuthProviderType = 'supabase' | 'firebase';
const AUTH_PROVIDER: AuthProviderType = 'supabase';

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  const refreshSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      let session = null;
      let user = null;

      if (AUTH_PROVIDER === 'supabase') {
        session = await supabaseService.getSession();
        user = await supabaseService.getUser();
      } else {
        // Firebase doesn't have a direct session concept
        // We'll check the current user
      }

      if (session && user) {
        const userData = await supabaseService.getUser();
        if (userData) {
          setState({
            user: {
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || '',
              createdAt: user.created_at,
              avatarUrl: user.user_metadata?.avatar_url,
            },
            session,
            loading: false,
            error: null,
          });
        }
      } else {
        const storedUser = await storage.getUser();
        if (storedUser) {
          setState({
            user: storedUser as User,
            session: await (AUTH_PROVIDER === 'supabase' ? supabaseService.getSession() : Promise.resolve(null)),
            loading: false,
            error: null,
          });
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      }
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: (error as Error).message }));
    }
  }, []);

  useEffect(() => {
    refreshSession();

    let unsubscribe: () => void;

    if (AUTH_PROVIDER === 'supabase') {
      const { data } = supabaseService.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          refreshSession();
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, session: null, loading: false, error: null });
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } else {
      unsubscribe = firebaseService.onAuthStateChange((user) => {
        if (user) {
          refreshSession();
        } else {
          setState({ user: null, session: null, loading: false, error: null });
        }
      });
    }

    return () => unsubscribe();
  }, [refreshSession]);

  const signUp = async (email: string, password: string, name: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let result;
      if (AUTH_PROVIDER === 'supabase') {
        result = await supabaseService.signUp(email, password, name);
      } else {
        result = await firebaseService.signUp(email, password, name);
      }
      if (result.error) throw result.error;
      await refreshSession();
      return { error: null };
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let result;
      if (AUTH_PROVIDER === 'supabase') {
        result = await supabaseService.signIn(email, password);
      } else {
        result = await firebaseService.signIn(email, password);
      }
      if (result.error) throw result.error;
      await refreshSession();
      return { error: null };
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return { error: err };
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.signOut();
      } else {
        error = await firebaseService.signOut();
      }
      if (error) throw error;
      setState({ user: null, session: null, loading: false, error: null });
      return { error: null };
    } catch (error) {
      const err = error as Error;
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      return { error: err };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.resetPassword(email);
      } else {
        error = await firebaseService.resetPassword(email);
      }
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateProfile = async (data: { name?: string; avatarUrl?: string }) => {
    try {
      let error: Error | null = null;
      if (AUTH_PROVIDER === 'supabase') {
        error = await supabaseService.updateProfile(data);
      } else {
        error = await firebaseService.updateProfile(data);
      }
      if (error) throw error;
      await refreshSession();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, resetPassword, updateProfile, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import { storage } from '../utils/storage';