import { Colors } from './colors';
import { Spacing, BorderRadius, Shadows } from './colors';
import { Typography, TextStyles } from './typography';

export const Theme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  shadows: Shadows,
  typography: Typography,
  textStyles: TextStyles,
};

export type ThemeType = typeof Theme;