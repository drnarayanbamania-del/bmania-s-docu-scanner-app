import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, type TouchableOpacityProps } from 'react-native';
import { Theme } from '../../constants/theme';

interface ButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const textColorByVariant = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  outline: 'textOutline',
  ghost: 'textGhost',
  danger: 'textDanger',
} as const;

const textSizeBySize = {
  sm: 'textSm',
  md: 'textMd',
  lg: 'textLg',
  xl: 'textXl',
} as const;

export const Button = forwardRef<React.ElementRef<typeof TouchableOpacity>, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      onPress,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles = [
      styles.base,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      disabled && styles.disabled,
      style,
    ];

    return (
      <TouchableOpacity
        ref={ref}
        style={baseStyles}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' || variant === 'danger' ? Theme.colors.text.inverse : Theme.colors.ocean[500]}
          />
        ) : (
          <>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            <Text style={[
              styles.text,
              styles[textColorByVariant[variant]],
              styles[textSizeBySize[size]],
            ]}>
              {children}
            </Text>
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </>
        )}
      </TouchableOpacity>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: Theme.colors.ocean[500],
    borderWidth: 0,
  },
  secondary: {
    backgroundColor: Theme.colors.ocean[100],
    borderWidth: 0,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Theme.colors.ocean[500],
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  danger: {
    backgroundColor: Theme.colors.status.error,
    borderWidth: 0,
  },
  sm: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    minHeight: 36,
  },
  md: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    minHeight: 56,
  },
  xl: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingVertical: Theme.spacing.lg,
    minHeight: 64,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontFamily: Theme.typography.fontFamilies.semiBold,
    letterSpacing: Theme.typography.letterSpacing.wide,
  },
  textPrimary: {
    color: Theme.colors.text.inverse,
  },
  textSecondary: {
    color: Theme.colors.text.primary,
  },
  textOutline: {
    color: Theme.colors.ocean[500],
  },
  textGhost: {
    color: Theme.colors.ocean[500],
  },
  textDanger: {
    color: Theme.colors.text.inverse,
  },
  textSm: {
    fontSize: Theme.typography.sizes.sm,
  },
  textMd: {
    fontSize: Theme.typography.sizes.md,
  },
  textLg: {
    fontSize: Theme.typography.sizes.lg,
  },
  textXl: {
    fontSize: Theme.typography.sizes.xl,
  },
  iconLeft: {
    marginRight: Theme.spacing.sm,
  },
  iconRight: {
    marginLeft: Theme.spacing.sm,
  },
});