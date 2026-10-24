import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { subscribeRole, isLeader } from '../services/role';

import HomeStack from './HomeStack';
import SongsStack from './SongsStack';
import ChatStack from './ChatStack';
import ProfileStack from './ProfileStack';
import LeaderStack from './LeaderStack';
import NowPlayingBar from '../features/songs/NowPlayingBar';
import MemoriesStack from './MemoriesStack';
import { getUnread, subscribeUnread } from '../services/unreadStore';
import AnimatedTabBar from './AnimatedTabBar';
import { useChatBootstrap } from '../features/chat/useChatBootstrap';
import { useChatState } from '../features/chat/chatStore';

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const { t } = useTranslation();
  const [unread, setUnreadState] = useState(getUnread());

  const [leader, setLeader] = useState(isLeader());

  // Realtime chat connection + conversation list + unread counts (whole app).
  useChatBootstrap();
  const { unreadTotal: chatUnread } = useChatState();

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
      // Mini player stays above the tab bar, exactly as before.
      tabBar={(props) => (
        <>
          <NowPlayingBar />
          <AnimatedTabBar {...props} />
        </>
      )}
      screenOptions={{ headerShown: false }}
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
        component={ChatStack}
        options={{
          tabBarLabel: t('tabs.chat'),
          // Unread chat messages across all conversations.
          tabBarBadge: chatUnread > 0 ? chatUnread : undefined,
        }}
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
          // Shown as a pop-in badge by AnimatedTabBar.
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
    </Tab.Navigator>
  );
}
