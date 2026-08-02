import React from 'react';
import { View, StyleSheet, Text, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';

export const AuthScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="scan" size={60} color={Theme.colors.ocean[500]} />
          </View>
          <Text style={styles.appName}>DocScanner</Text>
          <Text style={styles.tagline}>Scan. Edit. Share.</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <Button size="lg" fullWidth onPress={() => navigation.navigate('Login')}>
            <Ionicons name="log-in" size={24} color={Theme.colors.text.inverse} style={{ marginRight: 12 }} />
            Sign In
          </Button>
          
          <Button variant="outline" size="lg" fullWidth style={{ marginTop: Theme.spacing.md }} onPress={() => navigation.navigate('Register')}>
            <Ionicons name="person-add" size={24} color={Theme.colors.ocean[500]} style={{ marginRight: 12 }} />
            Create Account
          </Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.link}>Terms of Service</Text>{' '}
            and{' '}
            <Text style={styles.link}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.ocean[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.lg,
  },
  appName: {
    ...Theme.textStyles.display,
    color: Theme.colors.ocean[500],
  },
  tagline: {
    ...Theme.textStyles.bodyLarge,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.sm,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  footer: {
    marginTop: Theme.spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...Theme.textStyles.bodySmall,
    textAlign: 'center',
    color: Theme.colors.text.muted,
  },
  link: {
    color: Theme.colors.ocean[500],
    fontFamily: Theme.typography.fontFamilies.semiBold,
  },
});