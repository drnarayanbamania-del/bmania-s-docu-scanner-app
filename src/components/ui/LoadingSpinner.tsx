import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Theme } from '../../constants/theme';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = Theme.colors.ocean[500],
  label,
  fullScreen = false,
  overlay = false,
}) => {
  const sizes = {
    sm: { spinner: 'small', label: Theme.typography.sizes.xs, gap: Theme.spacing.xs },
    md: { spinner: 'large', label: Theme.typography.sizes.sm, gap: Theme.spacing.sm },
    lg: { spinner: 'large', label: Theme.typography.sizes.md, gap: Theme.spacing.md },
  };

  const config = sizes[size];

  return (
    <View style={[
      styles.container,
      fullScreen && styles.fullScreen,
      overlay && styles.overlay,
    ]}>
      <ActivityIndicator size={config.spinner as any} color={color} />
      {label && (
        <Text style={[
          styles.label,
          { fontSize: config.label, marginTop: config.gap, color: Theme.colors.text.secondary },
        ]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Theme.colors.surface.primary,
    zIndex: 1000,
  },
  overlay: {
    backgroundColor: Theme.colors.overlay.light,
    padding: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.lg,
    ...Theme.shadows.lg,
  },
  label: {
    ...Theme.textStyles.bodySmall,
    textAlign: 'center',
  },
});