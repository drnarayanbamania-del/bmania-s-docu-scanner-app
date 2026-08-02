import { Colors } from './colors';

export const Typography = {
  fontFamilies: {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semiBold: 'Outfit_600SemiBold',
    bold: 'Outfit_700Bold',
    extraBold: 'Outfit_800ExtraBold',
    black: 'Outfit_900Black',
  },
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
    hero: 56,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

export const TextStyles = {
  display: {
    fontFamily: Typography.fontFamilies.extraBold,
    fontSize: Typography.sizes.display,
    lineHeight: Typography.sizes.display * Typography.lineHeights.tight,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.text.primary,
  },
  h1: {
    fontFamily: Typography.fontFamilies.bold,
    fontSize: Typography.sizes.xxxl,
    lineHeight: Typography.sizes.xxxl * Typography.lineHeights.tight,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.text.primary,
  },
  h2: {
    fontFamily: Typography.fontFamilies.bold,
    fontSize: Typography.sizes.xxl,
    lineHeight: Typography.sizes.xxl * Typography.lineHeights.tight,
    letterSpacing: Typography.letterSpacing.tight,
    color: Colors.text.primary,
  },
  h3: {
    fontFamily: Typography.fontFamilies.semiBold,
    fontSize: Typography.sizes.xl,
    lineHeight: Typography.sizes.xl * Typography.lineHeights.normal,
    color: Colors.text.primary,
  },
  h4: {
    fontFamily: Typography.fontFamilies.semiBold,
    fontSize: Typography.sizes.lg,
    lineHeight: Typography.sizes.lg * Typography.lineHeights.normal,
    color: Colors.text.primary,
  },
  bodyLarge: {
    fontFamily: Typography.fontFamilies.regular,
    fontSize: Typography.sizes.lg,
    lineHeight: Typography.sizes.lg * Typography.lineHeights.normal,
    color: Colors.text.primary,
  },
  body: {
    fontFamily: Typography.fontFamilies.regular,
    fontSize: Typography.sizes.md,
    lineHeight: Typography.sizes.md * Typography.lineHeights.normal,
    color: Colors.text.primary,
  },
  bodySmall: {
    fontFamily: Typography.fontFamilies.regular,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.normal,
    color: Colors.text.secondary,
  },
  caption: {
    fontFamily: Typography.fontFamilies.medium,
    fontSize: Typography.sizes.xs,
    lineHeight: Typography.sizes.xs * Typography.lineHeights.normal,
    letterSpacing: Typography.letterSpacing.wide,
    color: Colors.text.tertiary,
  },
  button: {
    fontFamily: Typography.fontFamilies.semiBold,
    fontSize: Typography.sizes.md,
    lineHeight: Typography.sizes.md * Typography.lineHeights.normal,
    letterSpacing: Typography.letterSpacing.wide,
  },
  label: {
    fontFamily: Typography.fontFamilies.medium,
    fontSize: Typography.sizes.sm,
    lineHeight: Typography.sizes.sm * Typography.lineHeights.normal,
    color: Colors.text.tertiary,
  },
};