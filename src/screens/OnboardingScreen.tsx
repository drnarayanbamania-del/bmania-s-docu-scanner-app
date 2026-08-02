import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, Animated, Platform, useWindowDimensions, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const LOGO = require('../../assets/logo.png');

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 600;
  const cardWidth = isLargeScreen ? 480 : windowWidth;
  const cardHeight = isLargeScreen ? 700 : '100%';

  const pages = [
    {
      icon: 'scan',
      title: 'Scan Documents',
      description: 'Capture crisp, high-quality scans with automatic edge detection and perspective correction.',
      color: '#7B2FBE',
    },
    {
      icon: 'color-wand',
      title: 'Enhance & Filter',
      description: 'Apply Magic Color, B&W, HD sharpening, shadow removal and more with one tap.',
      color: '#A855F7',
    },
    {
      icon: 'document-text',
      title: 'Export as PDF',
      description: 'Merge, split, watermark and export to PDF, JPG, PNG or DOCX with password protection.',
      color: '#EC4899',
    },
    {
      icon: 'logo-whatsapp',
      title: 'Share Anywhere',
      description: 'Send documents to WhatsApp, email, cloud storage or any app in seconds.',
      color: '#25D366',
    },
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
      Animated.timing(scrollX, {
        toValue: (currentPage + 1) * cardWidth,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      navigation.replace('Auth');
    }
  };

  const handleSkip = () => {
    navigation.replace('Auth');
  };

  return (
    <View style={[styles.container, isLargeScreen && styles.containerLarge]}>
      <Card style={[styles.mainCard, isLargeScreen && { width: cardWidth, height: cardHeight }]} padding="none">
        
        {/* Header Logo */}
        <View style={styles.logoHeader}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          <View style={styles.logoTextBlock}>
            <Text style={styles.appName}>Bamania's Scanner</Text>
            <Text style={styles.appTagline}>Powered by Bamania's Tech</Text>
          </View>
        </View>

        {/* Skip button */}
        <View style={styles.skipContainer}>
          <Button variant="ghost" size="sm" onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </Button>
        </View>

        {/* Slides */}
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          {pages.map((page, index) => (
            <View key={index} style={[styles.page, { width: cardWidth }]}>
              <View style={[styles.iconContainer, { backgroundColor: `${page.color}18` }]}>
                <Ionicons name={page.icon as any} size={72} color={page.color} />
              </View>
              <Text style={[styles.title, { color: page.color }]}>{page.title}</Text>
              <Text style={styles.description}>{page.description}</Text>
            </View>
          ))}
        </Animated.ScrollView>

        {/* Page Indicators */}
        <View style={styles.indicators}>
          {pages.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentPage && styles.indicatorActive,
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.buttonContainer}>
          <Button
            size="lg"
            fullWidth
            onPress={handleNext}
            style={{ backgroundColor: pages[currentPage].color }}
            leftIcon={currentPage === pages.length - 1 ? <Ionicons name="checkmark" size={24} color="#FFF" /> : null}
            rightIcon={currentPage < pages.length - 1 ? <Ionicons name="chevron-forward" size={24} color="#FFF" /> : null}
          >
            {currentPage === pages.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        </View>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
  },
  containerLarge: {
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  mainCard: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: Theme.colors.surface.primary,
    ...Platform.select({
      web: {
        borderRadius: 24,
        overflow: 'hidden',
      },
    }),
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 52,
    paddingBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.light,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  logoTextBlock: {
    flex: 1,
  },
  appName: {
    fontSize: 18,
    fontFamily: Theme.typography.fontFamilies.bold,
    color: '#7B2FBE',
    letterSpacing: 0.3,
  },
  appTagline: {
    fontSize: 11,
    color: Theme.colors.text.muted,
    fontFamily: Theme.typography.fontFamilies.regular,
  },
  skipContainer: {
    position: 'absolute',
    top: 50,
    right: Theme.spacing.lg,
    zIndex: 10,
  },
  skipText: {
    ...Theme.textStyles.button,
    color: Theme.colors.text.tertiary,
  },
  scrollView: {
    flex: 1,
    marginTop: 12,
  },
  scrollContent: {
    minHeight: '100%',
  },
  page: {
    paddingHorizontal: Theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
  },
  title: {
    ...Theme.textStyles.h1,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  description: {
    ...Theme.textStyles.bodyLarge,
    textAlign: 'center',
    color: Theme.colors.text.secondary,
    lineHeight: 28,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginVertical: Theme.spacing.lg,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.border.light,
  },
  indicatorActive: {
    width: 24,
    backgroundColor: '#7B2FBE',
  },
  buttonContainer: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: 50,
  },
});