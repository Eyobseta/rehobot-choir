import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { View, ActivityIndicator } from 'react-native';

import { subscribeRole, isLeader } from '../services/role';
import { me } from '../services/auth';
import { useTheme } from '../theme/ThemeContext';

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
import ChangePasswordScreen from '../features/profile/ChangePasswordScreen';

const Tab = createBottomTabNavigator();

export default function RootTabs() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [unread, setUnreadState] = useState(getUnread());
  const [leader, setLeader] = useState(isLeader());
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [ready, setReady] = useState(false);

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

  // ---- Force password change (SRS 6.7) ----
  useEffect(() => {
    me()
      .then((res) => setMustChangePassword(res.user.mustChangePassword))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (mustChangePassword) {
    return (
      <ChangePasswordScreen
        navigation={{
          goBack: () => {},
          navigate: () => {},
        }}
        route={{ params: { forced: true } }}
        forced
      />
    );
  }

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <>
          <NowPlayingBar />
          <AnimatedTabBar {...props} />
        </>
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Songs" component={SongsStack} options={{ tabBarLabel: t('tabs.songs') }} />
      <Tab.Screen name="Memories" component={MemoriesStack} options={{ tabBarLabel: t('tabs.memories') }} />
      <Tab.Screen
        name="Chat"
        component={ChatStack}
        options={{
          tabBarLabel: t('tabs.chat'),
          tabBarBadge: chatUnread > 0 ? chatUnread : undefined,
        }}
      />
      {leader && (
        <Tab.Screen name="Approvals" component={LeaderStack} options={{ tabBarLabel: t('leader.approvalsTab') }} />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Reset the ProfileStack to its first screen (ProfileHome) when the tab is tapped
            e.preventDefault();
            navigation.navigate('Profile', { screen: 'ProfileHome' });
          },
        })}
      />
    </Tab.Navigator>
  );
}