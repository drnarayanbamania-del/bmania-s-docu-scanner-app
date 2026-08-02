import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

export const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootStackNavigator: React.FC = () => {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
      <RootStack.Screen name="Auth" component={AuthScreen} />
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Register" component={RegisterScreen} />
      <RootStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <RootStack.Screen name="Main" component={MainNavigator} />
    </RootStack.Navigator>
  );
};

// Lazy load screens to avoid circular dependencies
const OnboardingScreen = React.lazy(() => import('../screens/OnboardingScreen').then(m => ({ default: m.OnboardingScreen })));
const AuthScreen = React.lazy(() => import('../screens/auth/AuthScreen').then(m => ({ default: m.AuthScreen })));
const LoginScreen = React.lazy(() => import('../screens/auth/LoginScreen').then(m => ({ default: m.LoginScreen })));
const RegisterScreen = React.lazy(() => import('../screens/auth/RegisterScreen').then(m => ({ default: m.RegisterScreen })));
const ForgotPasswordScreen = React.lazy(() => import('../screens/auth/ForgotPasswordScreen').then(m => ({ default: m.ForgotPasswordScreen })));
const MainNavigator = React.lazy(() => import('./MainNavigator').then(m => ({ default: m.MainNavigator })));