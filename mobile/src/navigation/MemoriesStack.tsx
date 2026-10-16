import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import MemoriesScreen from '../features/memories/MemoriesScreen';
import MemoryDetailScreen from '../features/memories/MemoryDetailScreen';
import SubmitMemoryScreen from '../features/memories/SubmitMemoryScreen';
import MyMemoriesScreen from '../features/memories/MyMemoriesScreen';
import MemoryVideoScreen from '../features/memories/MemoryVideoScreen';
import MemoriesHeader from '../features/memories/MemoriesHeader';

export type MemoriesStackParamList = {
  MemoriesList: undefined;
  MemoryDetail: { id: string };
  SubmitMemory: undefined;
  MyMemories: undefined;
  MemoryVideo: { youtubeUrl: string; memoryTitle?: string };
};

const Stack = createNativeStackNavigator<MemoriesStackParamList>();

export default function MemoriesStack() {
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
        name="MemoriesList"
        component={MemoriesScreen}
        options={{ header: () => <MemoriesHeader /> }}
      />
      <Stack.Screen
        name="MemoryDetail"
        component={MemoryDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="SubmitMemory"
        component={SubmitMemoryScreen}
        options={{ title: t('memories.submit') }}
      />
      <Stack.Screen
        name="MyMemories"
        component={MyMemoriesScreen}
        options={{ title: t('memories.mine') }}
      />
      <Stack.Screen
        name="MemoryVideo"
        component={MemoryVideoScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}