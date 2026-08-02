import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderRadius?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = true,
  padding = 'md',
  borderRadius = 'lg',
}) => {
  const Component = onPress ? TouchableOpacity : View;
  
  return (
    <Component
      style={[
        styles.base,
        styles[padding],
        styles[`radius_${borderRadius}` as keyof typeof styles],
        elevated && styles.elevated,
        onPress && styles.pressable,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {children}
    </Component>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Theme.colors.surface.primary,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
  },
  none: { padding: 0 },
  sm: { padding: Theme.spacing.sm },
  md: { padding: Theme.spacing.md },
  lg: { padding: Theme.spacing.lg },
  radius_sm: { borderRadius: Theme.borderRadius.sm },
  radius_md: { borderRadius: Theme.borderRadius.md },
  radius_lg: { borderRadius: Theme.borderRadius.lg },
  radius_xl: { borderRadius: Theme.borderRadius.xl },
  radius_full: { borderRadius: Theme.borderRadius.full },
  elevated: {
    ...Theme.shadows.md,
  },
  pressable: {
    // Pressable styles handled by TouchableOpacity
  },
});