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
import { isValidEmail, validatePassword } from '../../utils/helpers';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { signIn, loading } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setPasswordError('Please enter your password');
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      showToast(error.message, 'error');
    } else {
      navigation.replace('Main');
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Button variant="ghost" size="sm" onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={Theme.colors.text.secondary} />
          </Button>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to access your documents</Text>
        </View>

        <Card style={styles.formCard} padding="lg">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            leftIcon={<Ionicons name="mail" size={22} color={Theme.colors.text.muted} />}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry={secureText}
            onToggleSecure={() => setSecureText(!secureText)}
            leftIcon={<Ionicons name="lock-closed" size={22} color={Theme.colors.text.muted} />}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
            style={{ marginTop: Theme.spacing.lg }}
          />

          <View style={styles.forgotPasswordContainer}>
            <Button variant="ghost" size="sm" onPress={handleForgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Button>
          </View>

          <Button
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleLogin}
            style={{ marginTop: Theme.spacing.xl }}
          >
            Sign In
          </Button>
        </Card>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>

        </View>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <Button variant="ghost" size="sm" onPress={() => navigation.navigate('Register')}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </Button>
        </View>
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
    marginBottom: Theme.spacing.lg,
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
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: Theme.spacing.sm,
  },
  forgotPasswordText: {
    ...Theme.textStyles.button,
    color: Theme.colors.ocean[500],
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Theme.colors.border.light,
  },
  dividerText: {
    ...Theme.textStyles.caption,
    color: Theme.colors.text.muted,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  signUpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
  },
  signUpText: {
    ...Theme.textStyles.body,
    color: Theme.colors.text.secondary,
  },
  signUpLink: {
    ...Theme.textStyles.button,
    color: Theme.colors.ocean[500],
  },
});