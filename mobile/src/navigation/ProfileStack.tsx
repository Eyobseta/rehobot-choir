import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import ProfileScreen from '../features/profile/ProfileScreen';
import ChangePasswordScreen from '../features/profile/ChangePasswordScreen';
import DeleteAccountScreen from '../features/profile/DeleteAccountScreen';
import OwnProfileScreen from '../features/profile/OwnProfileScreen';
import EditProfileScreen from '../features/profile/EditProfileScreen';
import AppearanceScreen from '../features/profile/AppearanceScreen';
import LanguageScreen from '../features/profile/LanguageScreen';
import AboutScreen from '../features/profile/AboutScreen'; // <--- CHECK THIS
import MyAttendanceScreen from '../features/attendance/MyAttendanceScreen';
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import NotificationPreferencesScreen from '../features/notifications/NotificationPreferencesScreen';
import FundingScreen from '../features/funding/FundingScreen';
import CreateCampaignScreen from '../features/funding/CreateCampaignScreen';
import CampaignDetailScreen from '../features/funding/CampaignDetailScreen';
import AnnualDetailScreen from '../features/funding/AnnualDetailScreen';
import PayFlowScreen, { PayFlowParams } from '../features/funding/Payflowscreen';
import AdminFundingSetupScreen from '../features/funding/AdminFundingSetupScreen';
import ManageInstructionsScreen from '../features/funding/ManageInstructionsScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ChangePassword: undefined;
  DeleteAccount: undefined;
  OwnProfile: undefined;
  EditProfile: undefined;
  Appearance: undefined;
  Language: undefined;
  About: undefined; // <--- CHECK THIS
  MyAttendance: undefined;
  Notifications: undefined;
  NotificationPreferences: undefined;
  Funding: undefined;
  CreateCampaign: { id?: string } | undefined;
  CampaignDetail: { id: string };
  AnnualDetail: undefined;
  PayFlow: PayFlowParams;
  AdminFundingSetup: undefined;
  ManageInstructions: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="OwnProfile" component={OwnProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      
      {/* CHECK THIS LINE: */}
      <Stack.Screen name="About" component={AboutScreen} /> 

      <Stack.Screen name="MyAttendance" component={MyAttendanceScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />

      <Stack.Screen name="Funding" component={FundingScreen} />
      <Stack.Screen name="CreateCampaign" component={CreateCampaignScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AnnualDetail" component={AnnualDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="PayFlow" component={PayFlowScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AdminFundingSetup" component={AdminFundingSetupScreen} />
      <Stack.Screen name="ManageInstructions" component={ManageInstructionsScreen} />
    </Stack.Navigator>
  );
}