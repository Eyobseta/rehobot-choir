import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
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
import { Avatar, ChatHeader, EmptyState, HeaderButton } from './components/ChatUI';

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
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 11,
          backgroundColor: pressed ? withAlpha(BRAND.violet, 0.08) : 'transparent',
        })}
      >
        <Avatar size={54} kind={item.type} uri={item.photoUrl} name={item.title} online={online} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: unread > 0 ? '800' : '700' }}
            >
              {item.title}
            </Text>
            <Text style={{ color: unread > 0 ? BRAND.magenta : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {listTime(item.lastMessageAt, tr)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: unread > 0 ? colors.text : colors.textSecondary,
                fontSize: 14,
                fontStyle: last?.deleted ? 'italic' : 'normal',
              }}
            >
              {preview}
            </Text>
            {unread > 0 ? (
              <View
                style={{
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  borderRadius: 11,
                  backgroundColor: BRAND.magenta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
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
      />

      <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={tr('searchChats')}
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, color: colors.text, fontSize: 15 }}
          />
        </View>
      </View>

      {!loaded ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND.violet} size="large" />
        </View>
      ) : data.length === 0 ? (
        <EmptyState text={tr('emptyList')} actionLabel={tr('newChat')} onAction={() => navigation.navigate('NewChat')} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.violet} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}