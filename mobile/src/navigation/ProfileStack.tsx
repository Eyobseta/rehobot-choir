import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import ProfileScreen from '../features/profile/ProfileScreen';
import ChangePasswordScreen from '../features/profile/ChangePasswordScreen';
import DeleteAccountScreen from '../features/profile/DeleteAccountScreen';
import OwnProfileScreen from '../features/profile/OwnProfileScreen';
import EditProfileScreen from '../features/profile/EditProfileScreen';
import AppearanceScreen from '../features/profile/AppearanceScreen';
import LanguageScreen from '../features/profile/LanguageScreen';
import MyAttendanceScreen from '../features/attendance/MyAttendanceScreen';
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import NotificationPreferencesScreen from '../features/notifications/NotificationPreferencesScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
  OwnProfile: undefined;
  EditProfile: undefined;
  Appearance: undefined;
  Language: undefined;
  MyAttendance: undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
  name="OwnProfile"
  component={OwnProfileScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="EditProfile"
  component={EditProfileScreen}
  options={{ headerShown: false }}
/>

      {/* All gradient-hero screens: native header hidden */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeleteAccount"  component={DeleteAccountScreen}  options={{ headerShown: false }} />
      <Stack.Screen name="Appearance"     component={AppearanceScreen}     options={{ headerShown: false }} />
      <Stack.Screen name="Language"       component={LanguageScreen}       options={{ headerShown: false }} />
      <Stack.Screen name="MyAttendance"   component={MyAttendanceScreen}   options={{ headerShown: false }} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen}  options={{ headerShown: false }} />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}