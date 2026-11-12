import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal as RNModal, Animated, TouchableOpacity, Platform, BackHandler, Text, useWindowDimensions } from 'react-native';
import { Theme, AbsoluteFill } from '../../constants/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayPress?: boolean;
  showHandle?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  children,
  title,
  size = 'md',
  closeOnOverlayPress = true,
  showHandle = true,
  animationType = 'slide',
}) => {
  const [anim] = useState(() => new Animated.Value(0));
  const [rendered, setRendered] = useState(visible);
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: animationType === 'none' ? 0 : 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: animationType === 'none' ? 0 : 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Unmount only after the close animation, so it can play out
        if (finished) setRendered(false);
      });
    }
  }, [visible, anim, animationType]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!rendered) return null;

  const mobileSizes = {
    sm: '85%',
    md: '90%',
    lg: '95%',
    xl: '98%',
    full: '100%',
  } as const;

  const webSizes = {
    sm: 420,
    md: 560,
    lg: 720,
    xl: 900,
    full: '100%',
  } as const;

  const overlayOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  // Every entry in an interpolation's outputRange must share the same unit: mixing a
  // percentage with a plain number throws on react-native-web ("invalid pattern").
  const slideTranslate = anim.interpolate(
    Platform.OS === 'ios'
      ? { inputRange: [0, 1], outputRange: [50, 0] }
      : isLargeScreen
        ? { inputRange: [0, 1], outputRange: [20, 0] }
        : { inputRange: [0, 1], outputRange: ['100%', '0%'] }
  );

  const fadeOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const containerStyle = [
    isLargeScreen ? styles.containerWeb : styles.containerMobile,
    { width: isLargeScreen ? webSizes[size] : mobileSizes[size] },
    animationType === 'slide'
      ? { transform: [{ translateY: slideTranslate }], opacity: fadeOpacity }
      : { opacity: fadeOpacity },
  ];

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          isLargeScreen && styles.overlayWeb,
          { opacity: overlayOpacity },
        ]}
      >
        {/* Overlay background tap to close */}
        <TouchableOpacity
          style={AbsoluteFill}
          activeOpacity={1}
          onPress={closeOnOverlayPress ? onClose : undefined}
        />

        <Animated.View style={containerStyle}>
          {/* Handle — only on mobile bottom sheet */}
          {showHandle && !isLargeScreen && (
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          )}

          {/* Title header */}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.content, isLargeScreen && styles.contentWeb]}>
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.overlay.medium,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  overlayWeb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Mobile: slides up from bottom
  containerMobile: {
    backgroundColor: Theme.colors.surface.primary,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    maxHeight: '90%',
    overflow: 'hidden',
    ...Theme.shadows.xl,
  },
  // Web: centered dialog
  containerWeb: {
    backgroundColor: Theme.colors.surface.primary,
    borderRadius: Theme.borderRadius.xl,
    maxHeight: '85%',
    overflow: 'hidden',
    ...Theme.shadows.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Theme.colors.border.medium,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  title: {
    ...Theme.textStyles.h3,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
  closeText: {
    fontSize: Theme.typography.sizes.xl,
    color: Theme.colors.text.tertiary,
  },
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    maxHeight: '70%',
  },
  contentWeb: {
    maxHeight: '75%',
  },
});