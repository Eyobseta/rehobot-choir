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
        options={{ title: t('myProfile.title') }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: t('profile.editProfile') }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: t('password.changeTitle') }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: t('deleteAccount.title') }}
      />
      <Stack.Screen
        name="Appearance"
        component={AppearanceScreen}
        options={{ title: t('settings.appearanceTitle') }}
      />
      <Stack.Screen
        name="Language"
        component={LanguageScreen}
        options={{ title: t('settings.languageTitle') }}
      />
            <Stack.Screen
        name="MyAttendance"
        component={MyAttendanceScreen}
        options={{ title: t('attendance.historyTitle') }}
      />
            <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('notifications.title') }}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: t('notifications.preferences') }}
      />
    </Stack.Navigator>
  );
}