import React from 'react';
import { View, StyleSheet, Text, ScrollView, TouchableOpacity, Switch, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  const isLargeScreen = Platform.OS === 'web' && windowWidth > 768;

  const [darkMode, setDarkMode] = React.useState(false);
  const [cloudSync, setCloudSync] = React.useState(true);
  const [biometrics, setBiometrics] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      showToast('Signed out successfully', 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to sign out', 'error');
    }
  };

  const handleSupport = () => {
    showToast('Support page coming soon!', 'info');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isLargeScreen && styles.largeContent]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.largeContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Card style={styles.profileCard} padding="lg">
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View>
              <Text style={styles.profileName}>{user?.name || 'Guest User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'No email associated'}</Text>
            </View>
          </View>
        </Card>

        {/* General Settings */}
        <Text style={styles.sectionTitle}>App Settings</Text>
        <Card style={styles.settingsCard} padding="none">
          {/* Cloud Sync */}
          <View style={styles.settingItem}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="cloud-upload" size={24} color={Theme.colors.ocean[500]} />
              <View style={styles.settingTextWrapper}>
                <Text style={styles.settingLabel}>Cloud Sync</Text>
                <Text style={styles.settingDesc}>Sync scans to your Supabase/Firebase account.</Text>
              </View>
            </View>
            <Switch
              value={cloudSync}
              onValueChange={setCloudSync}
              trackColor={{ false: '#D1D1D6', true: Theme.colors.ocean[500] }}
            />
          </View>

          {/* Dark Mode */}
          <View style={[styles.settingItem, styles.borderTop]}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="moon" size={24} color={Theme.colors.accent.amber} />
              <View style={styles.settingTextWrapper}>
                <Text style={styles.settingLabel}>Dark Appearance</Text>
                <Text style={styles.settingDesc}>Toggle system dark theme styling.</Text>
              </View>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#D1D1D6', true: Theme.colors.ocean[500] }}
            />
          </View>

          {/* Biometrics */}
          <View style={[styles.settingItem, styles.borderTop]}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="finger-print" size={24} color={Theme.colors.accent.teal} />
              <View style={styles.settingTextWrapper}>
                <Text style={styles.settingLabel}>Biometric Lock</Text>
                <Text style={styles.settingDesc}>Secure scans using TouchID / FaceID.</Text>
              </View>
            </View>
            <Switch
              value={biometrics}
              onValueChange={setBiometrics}
              trackColor={{ false: '#D1D1D6', true: Theme.colors.ocean[500] }}
            />
          </View>
        </Card>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support & Information</Text>
        <Card style={styles.settingsCard} padding="none">
          {/* Help Center */}
          <TouchableOpacity style={styles.settingItemBtn} onPress={handleSupport}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="help-circle" size={24} color={Theme.colors.text.secondary} />
              <Text style={styles.settingLabelBtn}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.text.muted} />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity style={[styles.settingItemBtn, styles.borderTop]} onPress={handleSupport}>
            <View style={styles.settingLabelWrapper}>
              <Ionicons name="shield-checkmark" size={24} color={Theme.colors.text.secondary} />
              <Text style={styles.settingLabelBtn}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.text.muted} />
          </TouchableOpacity>
        </Card>

        <Button
          variant="outline"
          size="lg"
          fullWidth
          onPress={handleSignOut}
          style={styles.signOutBtn}
        >
          <Ionicons name="log-out" size={24} color={Theme.colors.status.error} style={{ marginRight: 8 }} />
          <Text style={{ color: Theme.colors.status.error }}>Sign Out</Text>
        </Button>

        <Text style={styles.versionText}>DocScanner v1.0.0 (Web Build)</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
    height: 56,
  },
  headerTitle: {
    ...Theme.textStyles.h2,
  },
  scrollContent: {
    padding: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxl,
  },
  largeContent: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  profileCard: {
    marginBottom: Theme.spacing.xl,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.ocean[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileName: {
    ...Theme.textStyles.bodyLarge,
    fontFamily: Theme.typography.fontFamilies.bold,
  },
  profileEmail: {
    ...Theme.textStyles.bodySmall,
    color: Theme.colors.text.secondary,
  },
  sectionTitle: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Theme.spacing.sm,
    paddingLeft: 4,
  },
  settingsCard: {
    marginBottom: Theme.spacing.xl,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  settingItemBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border.light,
  },
  settingLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  settingTextWrapper: {
    flex: 1,
  },
  settingLabel: {
    ...Theme.textStyles.body,
    fontFamily: Theme.typography.fontFamilies.semiBold,
  },
  settingLabelBtn: {
    ...Theme.textStyles.body,
    color: Theme.colors.text.primary,
  },
  settingDesc: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
  signOutBtn: {
    borderColor: Theme.colors.status.error,
    marginTop: Theme.spacing.md,
  },
  versionText: {
    ...Theme.textStyles.caption,
    textAlign: 'center',
    color: Theme.colors.text.muted,
    marginTop: Theme.spacing.xl,
  },
});
