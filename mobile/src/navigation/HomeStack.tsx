import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

import HomeScreen from '../features/home/HomeScreen';
import DirectoryScreen from '../features/directory/DirectoryScreen';
import MemberProfileScreen from '../features/directory/MemberProfileScreen';
import EventsScreen from '../features/events/EventsScreen';
import EventDetailScreen from '../features/events/EventDetailScreen';
import AnnouncementsScreen from '../features/announcements/AnnouncementsScreen';
import AnnouncementDetailScreen from '../features/announcements/AnnouncementDetailScreen';
import DailyQuoteComposerScreen from '../features/quotes/DailyQuoteComposerScreen';
import DailyQuoteHistoryScreen from '../features/quotes/DailyQuoteHistoryScreen';
import BirthdayDetailScreen from '../features/birthdays/BirthdayDetailScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  Directory: undefined;
  MemberProfile: { id: string };
  EventsList: undefined;
  EventDetail: { id: string };
  AnnouncementsList: undefined;
  AnnouncementDetail: { id: string };
  DailyQuoteComposer: undefined;
  DailyQuoteHistory: undefined;
    BirthdayDetail: { postId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
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
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Directory"
        component={DirectoryScreen}
        options={{ title: t('directory.title') }}
      />
      <Stack.Screen
        name="MemberProfile"
        component={MemberProfileScreen}
        options={{ title: t('memberProfile.title') }}
      />
      <Stack.Screen
        name="EventsList"
        component={EventsScreen}
        options={{ title: t('events.title') }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="AnnouncementsList"
        component={AnnouncementsScreen}
        options={{ title: t('announcements.title') }}
      />
      <Stack.Screen
        name="AnnouncementDetail"
        component={AnnouncementDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="DailyQuoteComposer"
        component={DailyQuoteComposerScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="DailyQuoteHistory"
        component={DailyQuoteHistoryScreen}
        options={{ title: t('quote.title') }}
      />
            <Stack.Screen
        name="BirthdayDetail"
        component={BirthdayDetailScreen}
        options={{ title: t('birthdays.title') }}
      />
    </Stack.Navigator>
  );
}