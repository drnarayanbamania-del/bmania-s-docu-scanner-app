import React, { forwardRef } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import { Theme } from '../../constants/theme';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  onToggleSecure?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      secureTextEntry = false,
      onToggleSecure,
      style,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const hasHelper = !!helperText && !hasError;

    return (
      <View style={[styles.container, style]}>
        {label && (
          <Text style={styles.label}>{label}</Text>
        )}
        <View style={[
          styles.inputWrapper,
          hasError && styles.inputWrapperError,
          leftIcon && styles.hasLeftIcon,
          rightIcon && styles.hasRightIcon,
        ]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              secureTextEntry && leftIcon && styles.inputWithIcon,
            ]}
            secureTextEntry={secureTextEntry}
            {...props}
          />
          {rightIcon && (
            <View style={styles.iconRight}>
              {typeof rightIcon === 'function' ? rightIcon({ secureTextEntry, onToggleSecure }) : rightIcon}
            </View>
          )}
          {secureTextEntry && onToggleSecure && (
            <View style={styles.iconRight}>
              <TouchableOpacity onPress={onToggleSecure} style={styles.eyeButton}>
                <Text style={styles.eyeText}>
                  {secureTextEntry ? '👁' : '🙈'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {(hasError || hasHelper) && (
          <Text style={[
            styles.helperText,
            hasError && styles.errorText,
          ]}>
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

import { TouchableOpacity } from 'react-native';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Theme.spacing.xs,
  },
  label: {
    ...Theme.textStyles.label,
    color: Theme.colors.text.secondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.light,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    minHeight: 48,
  },
  inputWrapperError: {
    borderColor: Theme.colors.status.error,
  },
  hasLeftIcon: {
    paddingLeft: 0,
  },
  hasRightIcon: {
    paddingRight: 0,
  },
  input: {
    flex: 1,
    ...Theme.textStyles.body,
    color: Theme.colors.text.primary,
    paddingVertical: 0,
  },
  inputWithIcon: {
    paddingLeft: Theme.spacing.sm,
  },
  iconLeft: {
    position: 'absolute',
    left: Theme.spacing.md,
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: Theme.spacing.md,
    zIndex: 1,
  },
  eyeButton: {
    padding: Theme.spacing.xs,
  },
  eyeText: {
    fontSize: Theme.typography.sizes.md,
  },
  helperText: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.muted,
  },
  errorText: {
    color: Theme.colors.status.error,
  },
});