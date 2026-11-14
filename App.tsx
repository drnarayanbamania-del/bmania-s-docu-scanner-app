import React, { useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/components/ui/Toast';
import { RootStackNavigator } from './src/navigation/RootNavigator';

const RootNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  // Only block on the very first auth check: re-showing the splash later would
  // unmount NavigationContainer and throw away the current navigation stack.
  const booted = useRef(false);
  if (!loading) booted.current = true;

  if (!booted.current) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStackNavigator initialRouteName={user ? 'Main' : 'Onboarding'} />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
