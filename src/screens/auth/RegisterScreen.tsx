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

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { signUp, loading } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const handleRegister = async () => {
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');

    let valid = true;

    if (!name.trim()) {
      setNameError('Please enter your name');
      valid = false;
    }

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    }

    if (!valid) return;

    const { error } = await signUp(email, password, name);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Account created successfully!', 'success');
      navigation.replace('Main');
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to start scanning documents</Text>
        </View>

        <Card style={styles.formCard} padding="lg">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
            error={nameError}
            leftIcon={<Ionicons name="person" size={22} color={Theme.colors.text.muted} />}
            returnKeyType="next"
          />

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            leftIcon={<Ionicons name="mail" size={22} color={Theme.colors.text.muted} />}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            style={{ marginTop: Theme.spacing.md }}
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
            returnKeyType="next"
            style={{ marginTop: Theme.spacing.md }}
          />

          <Input
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={confirmPasswordError}
            secureTextEntry={secureText}
            onToggleSecure={() => setSecureText(!secureText)}
            leftIcon={<Ionicons name="lock-closed" size={22} color={Theme.colors.text.muted} />}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            style={{ marginTop: Theme.spacing.md }}
          />

          <Button
            size="lg"
            fullWidth
            loading={loading}
            onPress={handleRegister}
            style={{ marginTop: Theme.spacing.xl }}
          >
            Create Account
          </Button>
        </Card>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Button variant="ghost" size="sm" onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
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
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xl,
  },
  loginText: {
    ...Theme.textStyles.body,
    color: Theme.colors.text.secondary,
  },
  loginLink: {
    ...Theme.textStyles.button,
    color: Theme.colors.ocean[500],
  },
});
