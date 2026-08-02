import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { isValidEmail } from '../../utils/helpers';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { resetPassword, loading } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const handleResetPassword = async () => {
    setEmailError('');

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    const { error } = await resetPassword(email);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Password reset link sent to your email!', 'success');
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
          </Button>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a password reset link</Text>
        </View>

        <Card style={styles.formCard} padding="lg">
          <Input
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            leftIcon={<Ionicons name="mail" size={22} color={Theme.colors.text.muted} />}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleResetPassword}
          />

          <Button
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleResetPassword}
            style={{ marginTop: Theme.spacing.xl }}
          >
            Send Reset Link
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surface.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
  },
  header: {
    marginBottom: Theme.spacing.sm,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  title: {
    ...Theme.textStyles.h1,
  },
  subtitle: {
    ...Theme.textStyles.bodyLarge,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
});
