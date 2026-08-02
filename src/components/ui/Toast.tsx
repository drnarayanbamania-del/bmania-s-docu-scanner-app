import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Animated, Platform, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number, action?: { label: string; onPress: () => void }) => void;
  hideToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastType,
    duration = 4000,
    action?: { label: string; onPress: () => void }
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, message, type, duration, action };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastContainer: React.FC<{ toasts: Toast[]; onHide: (id: string) => void }> = ({ toasts, onHide }) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onHide={onHide} />
      ))}
    </View>
  );
};

const ToastItem: React.FC<{ toast: Toast; onHide: (id: string) => void }> = ({ toast, onHide }) => {
  const [anim, setAnim] = useState(new Animated.Value(0));
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const hide = () => {
    setExiting(true);
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onHide(toast.id);
    });
  };

  const typeStyles = {
    success: { bg: Theme.colors.status.success, icon: '✓' },
    error: { bg: Theme.colors.status.error, icon: '✕' },
    warning: { bg: Theme.colors.status.warning, icon: '⚠' },
    info: { bg: Theme.colors.status.info, icon: 'ℹ' },
  };

  const style = typeStyles[toast.type];

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: style.bg, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="auto"
    >
      <View style={styles.toastContent}>
        <Text style={styles.toastIcon}>{style.icon}</Text>
        <Text style={styles.toastMessage} numberOfLines={3}>{toast.message}</Text>
        {toast.action && (
          <TouchableOpacity onPress={toast.action.onPress} style={styles.toastAction}>
            <Text style={styles.toastActionText}>{toast.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={hide} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.lg,
    marginBottom: Theme.spacing.sm,
    ...Theme.shadows.lg,
    minHeight: 56,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Theme.spacing.sm,
  },
  toastIcon: {
    fontSize: Theme.typography.sizes.xl,
    color: Theme.colors.text.inverse,
    fontWeight: 'bold',
  },
  toastMessage: {
    flex: 1,
    ...Theme.textStyles.body,
    color: Theme.colors.text.inverse,
  },
  toastAction: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Theme.borderRadius.sm,
  },
  toastActionText: {
    ...Theme.textStyles.button,
    color: Theme.colors.text.inverse,
    fontSize: Theme.typography.sizes.sm,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
  closeText: {
    fontSize: Theme.typography.sizes.lg,
    color: Theme.colors.text.inverse,
    opacity: 0.8,
  },
});