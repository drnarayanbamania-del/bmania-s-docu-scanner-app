import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal as RNModal, Animated, TouchableOpacity, Platform, BackHandler, Text } from 'react-native';
import { Theme } from '../../constants/theme';

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

  useEffect(() => {
    if (visible) {
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
      }).start();
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

  if (!visible && anim._value === 0) return null;

  const sizes = {
    sm: '85%',
    md: '90%',
    lg: '95%',
    xl: '98%',
    full: '100%',
  };

  const overlayOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const slideTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 50 : '100%', 0],
  });

  const fadeOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const modalStyle = animationType === 'slide'
    ? { transform: [{ translateY: slideTranslate }], opacity: fadeOpacity }
    : { opacity: fadeOpacity };

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
          { opacity: overlayOpacity },
        ]}
        onStartShouldSetResponder={() => closeOnOverlayPress}
        onResponderGrant={closeOnOverlayPress ? onClose : undefined}
      >
        <Animated.View style={[styles.container, modalStyle, { width: sizes[size] }]}>
          {showHandle && (
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
          )}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.content}>
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
  },
  container: {
    backgroundColor: Theme.colors.surface.primary,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    maxHeight: '90%',
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
});