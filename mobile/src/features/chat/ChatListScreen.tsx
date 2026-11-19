import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useMe, isLeaderRole } from './chatSession';
import { useTr } from './chatStrings';
import {
  refreshConversations,
  restoreCachedConversations,
  useChatState,
} from './chatStore';
import { firstName, listTime, messagePreview } from './chatUtils';
import type { ConversationListItem } from './chatTypes';
import {
  Avatar,
  ChatHeader,
  ChatListSkeleton,
  EmptyState,
  HeaderButton,
  SearchField,
} from './components/ChatUI';

type Nav = NativeStackNavigationProp<ChatStackParamList, 'ChatList'>;

export default function ChatListScreen() {
  const tr = useTr();
  const navigation = useNavigation<Nav>();
  const { theme } = useTheme();
  const { colors } = theme;
  const me = useMe();
  const leader = isLeaderRole(me?.role);
  const { conversations, loaded, connected, presence } = useChatState();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // 1) Paint instantly from the on-device cache (no network wait).
      void restoreCachedConversations();
      // 2) Then refresh from the network (cachedFetch handles cache-first internally).
      void refreshConversations();
    }, []),
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
  }, [conversations, query]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  };

  const renderRow = ({ item }: { item: ConversationListItem }) => {
    const last = item.lastMessage;
    let preview = last ? messagePreview(last, tr) : '';
    if (last && !last.deleted) {
      if (last.senderId === me?.id) preview = `${tr('you')}: ${preview}`;
      else if (item.type !== 'DIRECT') preview = `${firstName(last.senderName)}: ${preview}`;
    }
    const online = item.otherUserId ? presence[item.otherUserId] ?? item.online : null;
    const unread = item.unreadCount;

    return (
      <Pressable
        onPress={() => navigation.navigate('Conversation', { conversationId: item.id, title: item.title })}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginHorizontal: 10,
          paddingHorizontal: 8,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: pressed
            ? withAlpha(colors.primary, 0.08)
            : unread > 0
            ? withAlpha(colors.primary, 0.05)
            : 'transparent',
        })}
      >
        <Avatar size={56} kind={item.type} uri={item.photoUrl} name={item.title} online={online} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: unread > 0 ? '800' : '700' }}
            >
              {item.title}
            </Text>
            <Text style={{ color: unread > 0 ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              {listTime(item.lastMessageAt, tr)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: unread > 0 ? colors.text : colors.textSecondary,
                fontSize: 14,
                fontWeight: unread > 0 ? '600' : '400',
                fontStyle: last?.deleted ? 'italic' : 'normal',
              }}
            >
              {preview}
            </Text>
            {unread > 0 ? (
              <View
                style={{
                  minWidth: 24,
                  height: 24,
                  paddingHorizontal: 7,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: '800' }}>
                  {unread > 99 ? '99+' : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        title={tr('title')}
        subtitle={connected ? undefined : tr('connecting')}
        right={
          <>
            {leader ? <HeaderButton icon="shield-checkmark-outline" onPress={() => navigation.navigate('ChatReports')} /> : null}
            <HeaderButton icon="add" onPress={() => navigation.navigate('NewChat')} />
          </>
        }
      >
        <SearchField value={query} onChangeText={setQuery} placeholder={tr('searchChats')} onDark />
      </ChatHeader>

      {!loaded ? (
        <ChatListSkeleton />
      ) : data.length === 0 ? (
        <EmptyState text={tr('emptyList')} actionLabel={tr('newChat')} onAction={() => navigation.navigate('NewChat')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        />
      )}
    </View>
  );
}