import React, { useEffect, useState } from 'react';
import {
  createBottomTabNavigator,
  BottomTabBar,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme/ThemeContext';
import { subscribeRole, isLeader } from '../services/role';

import HomeStack from './HomeStack';
import SongsStack from './SongsStack';
import MemoriesScreen from '../features/memories/MemoriesScreen';
import ChatScreen from '../features/chat/ChatScreen';
import ProfileStack from './ProfileStack';
import LeaderStack from './LeaderStack';
import NowPlayingBar from '../features/songs/NowPlayingBar';
import MemoriesStack from './MemoriesStack';
import { getUnread, subscribeUnread } from '../services/unreadStore';


const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, typography } = theme;
   const [unread, setUnreadState] = useState(getUnread());

  const [leader, setLeader] = useState(isLeader());

  useEffect(() => {
    setLeader(isLeader());
    return subscribeRole(() => setLeader(isLeader()));
  }, []);
    useEffect(() => {
    setUnreadState(getUnread());
    return subscribeUnread(setUnreadState);
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <>
          <NowPlayingBar />
          <BottomTabBar {...props} />
        </>
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Songs':
              iconName = focused ? 'musical-notes' : 'musical-notes-outline';
              break;
            case 'Memories':
              iconName = focused ? 'images' : 'images-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            case 'Approvals':
              iconName = focused ? 'checkmark-done' : 'checkmark-done-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: t('tabs.home') }}
      />
      <Tab.Screen
        name="Songs"
        component={SongsStack}
        options={{ tabBarLabel: t('tabs.songs') }}
      />
            <Tab.Screen
        name="Memories"
        component={MemoriesStack}
        options={{ tabBarLabel: t('tabs.memories') }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: t('tabs.chat') }}
      />

      {leader && (
        <Tab.Screen
          name="Approvals"
          component={LeaderStack}
          options={{ tabBarLabel: t('leader.approvalsTab') }}
        />
      )}

            <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            color: '#FFFFFF',
            fontSize: 10,
          },
        }}
      />
    </Tab.Navigator>
  );
}