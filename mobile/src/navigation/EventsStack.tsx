import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import EventsScreen from '../features/events/EventsScreen';
import EventDetailScreen from '../features/events/EventDetailScreen';

export type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { id: string };
};

const Stack = createNativeStackNavigator<EventsStackParamList>();

export default function EventsStack() {
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
        name="EventsList"
        component={EventsScreen}
        options={{ title: t('events.title') }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}