import { Colors } from './colors';
import { Spacing, BorderRadius, Shadows } from './colors';
import { Typography, TextStyles } from './typography';

/**
 * Absolute-fill style, usable both as a `style` prop and as a spread inside StyleSheet.create.
 *
 * `StyleSheet.absoluteFillObject` was removed from React Native native in 0.86, while
 * react-native-web's `StyleSheet.absoluteFill` is a compiled class-name string rather than a
 * style object. Defining the object explicitly keeps overlays positioned on both platforms.
 */
export const AbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export const Theme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  typography: Typography,
  textStyles: TextStyles,
};

export type ThemeType = typeof Theme;