import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabParamList, RootStackParamList } from '../types';
import { Theme } from '../constants/theme';

export const MainTab = createBottomTabNavigator<BottomTabParamList>();
export const ProjectStack = createNativeStackNavigator<RootStackParamList>();

export const MainNavigator: React.FC = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Theme.colors.ocean[500],
        tabBarInactiveTintColor: Theme.colors.text.muted,
        tabBarStyle: {
          backgroundColor: Theme.colors.surface.primary,
          borderTopWidth: 1,
          borderTopColor: Theme.colors.border.light,
          paddingBottom: 10,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: Theme.typography.sizes.xs,
          fontFamily: Theme.typography.fontFamilies.medium,
          marginTop: 4,
        },
        tabBarIconStyle: { marginBottom: 2 },
        headerShown: false,
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Scan"
        component={ScanStack}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Projects"
        component={ProjectsStack}
        options={{
          tabBarLabel: 'Projects',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'folder' : 'folder-outline'} size={size} color={color} />
          ),
        }}
      />
      <MainTab.Screen
        name="Settings"
        component={SettingsStack}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </MainTab.Navigator>
  );
};

const DashboardStack: React.FC = () => (
  <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
    <ProjectStack.Screen name="Dashboard" component={DashboardScreen} />
    <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
    <ProjectStack.Screen name="Export" component={ExportScreen} />
  </ProjectStack.Navigator>
);

const ScanStack: React.FC = () => (
  <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
    <ProjectStack.Screen name="Scan" component={ScanScreen} />
    <ProjectStack.Screen name="Camera" component={CameraScreen} />
    <ProjectStack.Screen name="Review" component={ReviewScreen} />
    <ProjectStack.Screen name="Edit" component={EditScreen} />
  </ProjectStack.Navigator>
);

const ProjectsStack: React.FC = () => (
  <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
    <ProjectStack.Screen name="Projects" component={ProjectsScreen} />
    <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
  </ProjectStack.Navigator>
);

const SettingsStack: React.FC = () => (
  <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
    <ProjectStack.Screen name="Settings" component={SettingsScreen} />
  </ProjectStack.Navigator>
);

// Screen components (lazy loaded)
const DashboardScreen = React.lazy(() => import('../screens/dashboard/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const ProjectDetailScreen = React.lazy(() => import('../screens/dashboard/ProjectDetailScreen').then(m => ({ default: m.ProjectDetailScreen })));
const ExportScreen = React.lazy(() => import('../screens/dashboard/ExportScreen').then(m => ({ default: m.ExportScreen })));
const ScanScreen = React.lazy(() => import('../screens/scan/ScanScreen').then(m => ({ default: m.ScanScreen })));
const CameraScreen = React.lazy(() => import('../screens/scan/CameraScreen').then(m => ({ default: m.CameraScreen })));
const ReviewScreen = React.lazy(() => import('../screens/scan/ReviewScreen').then(m => ({ default: m.ReviewScreen })));
const EditScreen = React.lazy(() => import('../screens/scan/EditScreen').then(m => ({ default: m.EditScreen })));
const ProjectsScreen = React.lazy(() => import('../screens/projects/ProjectsScreen').then(m => ({ default: m.ProjectsScreen })));
const SettingsScreen = React.lazy(() => import('../screens/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));