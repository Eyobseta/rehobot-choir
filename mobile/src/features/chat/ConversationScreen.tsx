import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useMe, isLeaderRole } from './chatSession';
import { useTr } from './chatStrings';
import {
  fetchDetail,
  fetchMessages,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  reactApi,
  pinApi,
  unpinApi,
  reportApi,
  markReadApi,
  typingApi,
} from './chatApi';
import { onChatEvent, setOpenConversations } from './chatRealtime';
import {
  markLocalRead,
  clearUnreadForConversation,
  setActiveConversation,
  useChatState,
} from './chatStore';
import {
  dayLabel,
  lastSeenLabel,
  newClientId,
  sameDay,
} from './chatUtils';
import { upsertMessage, mergeMessages } from './conversationHelpers';
import {
  getCachedDetail,
  getCachedMessages,
  getMeta,
  getOlderCached,
  patchCachedMessage,
  saveMessages,
  setMeta,
} from './chatCache';
import { revalidateConversation } from './chatSync';
import type {
  ChatMessage,
  ConversationDetail,
  Draft,
  MediaItem,
  Reaction,
} from './chatTypes';
import { Avatar, ChatHeader, EmptyState, HeaderButton, useHideTabBar } from './components/ChatUI';
import { MessageBubble } from './components/MessageBubble';
import { MessageActions, ActionItem } from './components/MessageActions';
import { Composer } from './components/Composer';
import { PhotoViewer } from './components/PhotoViewer';

type Props = NativeStackScreenProps<ChatStackParamList, 'Conversation'>;

export default function ConversationScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  useHideTabBar();

  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const me = useMe();
  const meRef = useRef<string | null>(null);
  meRef.current = me?.id ?? null;
  const leader = isLeaderRole(me?.role);
  const { connected, presence } = useChatState();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [target, setTarget] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [typingMap, setTypingMap] = useState<Record<string, number>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pinIdx, setPinIdx] = useState(0);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const endReachedRef = useRef(false); // no older history anywhere (cache or server)
  const loadingMoreRef = useRef(false);
  const focusedRef = useRef(false);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  // ------------------------------------------------------------------
  // Loading
  // ------------------------------------------------------------------

  const markReadSoon = useCallback(() => {
    if (!focusedRef.current) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      markReadApi(conversationId).catch(() => undefined);
      markLocalRead(conversationId);
    }, 500);
  }, [conversationId]);

  const applyPinned = useCallback((pinned: ChatMessage[]) => {
    setDetail((d) => (d ? { ...d, pinned } : d));
    const ids = new Set(pinned.map((p) => p.id));
    setMessages((prev) =>
      prev.map((x) => (x.pinned === ids.has(x.id) ? x : { ...x, pinned: ids.has(x.id) })),
    );
  }, []);

  /** Download only what is new / changed, update the cache, merge into the screen. */
  const syncFromServer = useCallback(async () => {
    const r = await revalidateConversation(conversationId);
    setDetail(r.detail);
    setMessages((prev) =>
      mergeMessages(r.reset ? prev.filter((x) => x._status) : prev, r.items),
    );
    applyPinned(r.detail.pinned);
    if (r.reset) endReachedRef.current = false;
    markReadSoon();
  }, [conversationId, markReadSoon, applyPinned]);

  const load = useCallback(async () => {
    setError(false);
    endReachedRef.current = false;

    // 1) Instant paint from the on-device cache (no network wait).
    let painted = false;
    try {
      const [cd, cm] = await Promise.all([
        getCachedDetail(conversationId),
        getCachedMessages(conversationId, 40),
      ]);
      if (cm.length > 0) {
        if (cd) {
          setDetail(cd);
          applyPinned(cd.pinned);
        }
        setMessages((prev) => mergeMessages(prev.filter((x) => x._status), cm));
        setLoading(false);
        painted = true;
      }
    } catch {
      // fall through to the network
    }

    // 2) Fetch only what is new.
    try {
      await syncFromServer();
    } catch {
      if (!painted) setError(true);
    } finally {
      setLoading(false);
    }
  }, [conversationId, syncFromServer, applyPinned]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Older history: from the device first (instant), from the server only when the cache runs out. */
  const loadOlder = useCallback(async () => {
    if (loadingMoreRef.current || endReachedRef.current) return;
    const list = messagesRef.current;
    let oldest: ChatMessage | undefined;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m && !m._status) {
        oldest = m;
        break;
      }
    }
    if (!oldest) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const local = await getOlderCached(conversationId, oldest, 40);
      if (local.length > 0) {
        setMessages((prev) => mergeMessages(prev, local));
        return;
      }
      const meta = await getMeta(conversationId);
      if (meta.reachedStart) {
        endReachedRef.current = true;
        return;
      }
      const page = await fetchMessages(conversationId, { before: oldest.id });
      await saveMessages(page.items);
      if (!page.hasMore) {
        await setMeta(conversationId, { reachedStart: true });
        endReachedRef.current = true;
      }
      setMessages((prev) => mergeMessages(prev, page.items));
    } catch {
      // user can scroll again to retry
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [conversationId]);

  /** After an SSE reconnect: same cheap revalidation. */
  const resync = useCallback(async () => {
    try {
      await syncFromServer();
    } catch {
      // next reconnect retries
    }
  }, [syncFromServer]);

  // ------------------------------------------------------------------
  // Focus: tell the server this chat is open (no push) + mark as read
  // ------------------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setActiveConversation(conversationId);
      setOpenConversations([conversationId]);
      markReadSoon();
      clearUnreadForConversation(conversationId);
      return () => {
        focusedRef.current = false;
        setActiveConversation(null);
        setOpenConversations([]);
        if (readTimer.current) clearTimeout(readTimer.current);
      };
    }, [conversationId, markReadSoon]),
  );

  // ------------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------------

  useEffect(() => {
    const offs = [
      onChatEvent('message:new', (m: ChatMessage) => {
        if (m.conversationId !== conversationId) return;
        setMessages((prev) => upsertMessage(prev, m));
        void saveMessages([m]);
        if (m.sender.id !== meRef.current) markReadSoon();
      }),
      onChatEvent('message:edited', (m: ChatMessage) => {
        if (m.conversationId !== conversationId) return;
        setMessages((prev) => upsertMessage(prev, m));
        void saveMessages([m]);
      }),
      onChatEvent('message:deleted', (p: { conversationId: string; messageId: string }) => {
        if (p.conversationId !== conversationId) return;
        void patchCachedMessage(p.messageId, (x) => ({
          ...x,
          deleted: true,
          text: null,
          media: [],
          reactions: [],
          pinned: false,
        }));
        setMessages((prev) =>
          prev.map((x) =>
            x.id === p.messageId
              ? { ...x, deleted: true, text: null, media: [], reactions: [], pinned: false }
              : x,
          ),
        );
      }),
      onChatEvent(
        'reaction:updated',
        (p: { conversationId: string; messageId: string; reactions: Reaction[] }) => {
          if (p.conversationId !== conversationId) return;
          void patchCachedMessage(p.messageId, (x) => ({ ...x, reactions: p.reactions }));
          setMessages((prev) =>
            prev.map((x) => (x.id === p.messageId ? { ...x, reactions: p.reactions } : x)),
          );
        },
      ),
      onChatEvent('pin:updated', (p: { conversationId: string; pinned: ChatMessage[] }) => {
        if (p.conversationId === conversationId) applyPinned(p.pinned);
      }),
      onChatEvent(
        'read:updated',
        (p: { conversationId: string; userId: string; lastReadAt: string }) => {
          if (p.conversationId !== conversationId) return;
          setDetail((d) => {
            if (!d) return d;
            const others = d.readStates.filter((r) => r.userId !== p.userId);
            return { ...d, readStates: [...others, { userId: p.userId, lastReadAt: p.lastReadAt }] };
          });
        },
      ),
      onChatEvent('typing', (p: { conversationId: string; userId: string }) => {
        if (p.conversationId !== conversationId || p.userId === meRef.current) return;
        setTypingMap((t) => ({ ...t, [p.userId]: Date.now() }));
      }),
      onChatEvent('conversation:updated', (p: { conversationId: string }) => {
        if (p.conversationId === conversationId) {
          fetchDetail(conversationId).then(setDetail).catch(() => undefined);
        }
      }),
      onChatEvent('conversation:removed', (p: { conversationId: string }) => {
        if (p.conversationId === conversationId) navigation.goBack();
      }),
      onChatEvent('connected', () => {
        void resync();
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [conversationId, markReadSoon, applyPinned, resync, navigation]);

  // Expire "typing" entries
  useEffect(() => {
    const id = setInterval(() => {
      setTypingMap((t) => {
        const now = Date.now();
        const keys = Object.keys(t);
        if (!keys.some((k) => now - (t[k] ?? 0) > 4000)) return t;
        const next: Record<string, number> = {};
        for (const k of keys) if (now - (t[k] ?? 0) <= 4000) next[k] = t[k] ?? now;
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // ------------------------------------------------------------------
  // Jump to a message (search results, reply taps, pinned banner)
  // ------------------------------------------------------------------

  const jumpTo = useCallback(
    async (id: string) => {
      for (let guard = 0; guard < 15; guard++) {
        const idx = messagesRef.current.findIndex((x) => x.id === id);
        if (idx >= 0) {
          listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true });
          setHighlightId(id);
          setTimeout(() => setHighlightId(null), 1800);
          return;
        }
        if (endReachedRef.current) return;
        await loadOlder();
        await new Promise((r) => setTimeout(r, 60));
      }
    },
    [loadOlder],
  );

  useEffect(() => {
    const id = route.params.jumpToId;
    if (id && !loading) {
      void jumpTo(id);
      navigation.setParams({ jumpToId: undefined });
    }
  }, [route.params.jumpToId, loading, jumpTo, navigation]);

  // ------------------------------------------------------------------
  // Sending
  // ------------------------------------------------------------------

  const sendNow = useCallback(
    async (tmp: ChatMessage) => {
      const draft = tmp._draft;
      if (!draft || !tmp.clientId) return;
      setMessages((prev) => prev.map((x) => (x.id === tmp.id ? { ...x, _status: 'sending' } : x)));
      try {
        const real = await sendMessageApi(conversationId, tmp.clientId, draft);
        setMessages((prev) => upsertMessage(prev, real));
        void saveMessages([real]);
      } catch (e) {
        const err = e as { code?: string; message?: string };
        if (err.code === 'CONVERSATION_READ_ONLY') {
          setMessages((prev) => prev.filter((x) => x.id !== tmp.id));
          Alert.alert(err.message ?? tr('readOnly'));
          return;
        }
        if (err.code === 'FILE_TOO_LARGE') Alert.alert(tr('fileTooLarge'));
        setMessages((prev) => prev.map((x) => (x.id === tmp.id ? { ...x, _status: 'failed' } : x)));
      }
    },
    [conversationId, tr],
  );

  const handleSend = useCallback(
    (draft: Draft) => {
      const myId = meRef.current;
      if (!myId) return;
      const clientId = newClientId();
      const mem = detail?.members.find((m) => m.userId === myId);

      const media: MediaItem[] = [
        ...draft.photos.map((p, i) => ({
          id: `${clientId}_p${i}`,
          type: 'PHOTO' as const,
          storageUrl: p.uri,
          durationSeconds: null,
        })),
        ...(draft.voice
          ? [
              {
                id: `${clientId}_v`,
                type: 'VOICE' as const,
                storageUrl: draft.voice.uri,
                durationSeconds: draft.voice.durationSeconds,
              },
            ]
          : []),
      ];

      const tmp: ChatMessage = {
        id: `tmp_${clientId}`,
        conversationId,
        clientId,
        type: draft.voice ? 'VOICE' : draft.photos.length > 0 ? 'PHOTO' : 'TEXT',
        text: draft.text || null,
        deleted: false,
        createdAt: new Date().toISOString(),
        editedAt: null,
        sender: {
          id: myId,
          fullName: mem?.fullName ?? tr('you'),
          profilePhotoUrl: mem?.profilePhotoUrl ?? null,
        },
        media,
        mediaExpired: false,
        replyTo: replyTo
          ? {
              id: replyTo.id,
              type: replyTo.type,
              text: replyTo.text,
              deleted: false,
              sender: { id: replyTo.sender.id, fullName: replyTo.sender.fullName },
            }
          : null,
        reactions: [],
        pinned: false,
        _status: 'sending',
        _draft: draft,
      };

      setMessages((prev) => upsertMessage(prev, tmp));
      setReplyTo(null);
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      void sendNow(tmp);
    },
    [detail, conversationId, replyTo, sendNow, tr],
  );

  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    typingApi(conversationId).catch(() => undefined);
  }, [conversationId]);

  const submitEdit = useCallback(
    async (text: string) => {
      if (!editing) return;
      const id = editing.id;
      setEditing(null);
      try {
        const m = await editMessageApi(id, text);
        setMessages((prev) => upsertMessage(prev, m));
        void saveMessages([m]);
      } catch (e) {
        Alert.alert((e as { message?: string }).message ?? tr('uploadFailed'));
      }
    },
    [editing, tr],
  );

  // ------------------------------------------------------------------
  // Message actions
  // ------------------------------------------------------------------

  const toggleReaction = useCallback(async (m: ChatMessage, emoji: string) => {
    const myId = meRef.current;
    if (!myId || m._status) return;
    const has = m.reactions.some((r) => r.emoji === emoji && r.userId === myId);
    const apply = (list: Reaction[]) =>
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: list } : x)));
    apply(
      has
        ? m.reactions.filter((r) => !(r.emoji === emoji && r.userId === myId))
        : [...m.reactions, { emoji, userId: myId }],
    );
    try {
      apply(await reactApi(m.id, emoji));
    } catch {
      apply(m.reactions);
    }
  }, []);

  const actionsFor = useCallback(
    (m: ChatMessage): ActionItem[] => {
      const myId = meRef.current;
      const mine = m.sender.id === myId;

      if (m._status === 'failed') {
        return [
          { key: 'retry', label: tr('retry'), icon: 'refresh', onPress: () => void sendNow(m) },
          {
            key: 'remove',
            label: tr('delete'),
            icon: 'trash-outline',
            danger: true,
            onPress: () => setMessages((prev) => prev.filter((x) => x.id !== m.id)),
          },
        ];
      }
      if (m._status || m.deleted) return [];

      const items: ActionItem[] = [
        { key: 'reply', label: tr('reply'), icon: 'arrow-undo-outline', onPress: () => { setEditing(null); setReplyTo(m); } },
      ];
      if (mine && (m.type === 'TEXT' || m.text)) {
        items.push({ key: 'edit', label: tr('edit'), icon: 'pencil-outline', onPress: () => { setReplyTo(null); setEditing(m); } });
      }
      items.push({
        key: 'pin',
        label: m.pinned ? tr('unpin') : tr('pin'),
        icon: m.pinned ? 'pin-outline' : 'pin',
        onPress: async () => {
          try {
            applyPinned(m.pinned ? await unpinApi(m.id) : await pinApi(m.id));
          } catch (e) {
            Alert.alert((e as { message?: string }).message ?? tr('uploadFailed'));
          }
        },
      });
      if (!mine) {
        items.push({
          key: 'report',
          label: tr('report'),
          icon: 'flag-outline',
          onPress: () =>
            Alert.alert(tr('report'), tr('reportConfirm'), [
              { text: tr('cancel'), style: 'cancel' },
              {
                text: tr('report'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await reportApi(m.id);
                    Alert.alert(tr('reported'));
                  } catch (e) {
                    const err = e as { code?: string; message?: string };
                    Alert.alert(err.code === 'ALREADY_REPORTED' ? tr('alreadyReported') : err.message ?? '');
                  }
                },
              },
            ]),
        });
      }
      if (mine || leader) {
        items.push({
          key: 'delete',
          label: tr('delete'),
          icon: 'trash-outline',
          danger: true,
          onPress: () =>
            Alert.alert(tr('delete'), tr('deleteConfirm'), [
              { text: tr('cancel'), style: 'cancel' },
              {
                text: tr('delete'),
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteMessageApi(m.id);
                    void patchCachedMessage(m.id, (x) => ({
                      ...x,
                      deleted: true,
                      text: null,
                      media: [],
                      reactions: [],
                      pinned: false,
                    }));
                    setMessages((prev) =>
                      prev.map((x) =>
                        x.id === m.id
                          ? { ...x, deleted: true, text: null, media: [], reactions: [], pinned: false }
                          : x,
                      ),
                    );
                  } catch (e) {
                    Alert.alert((e as { message?: string }).message ?? '');
                  }
                },
              },
            ]),
        });
      }
      return items;
    },
    [tr, leader, sendNow, applyPinned],
  );

  // ------------------------------------------------------------------
  // Derived UI state
  // ------------------------------------------------------------------

  const isDirect = detail?.type === 'DIRECT';
  const other = useMemo(
    () => (isDirect ? detail?.members.find((m) => m.userId !== me?.id) ?? null : null),
    [detail, isDirect, me],
  );

  const maxOtherRead = useMemo(() => {
    let max = '';
    for (const r of detail?.readStates ?? []) {
      if (r.userId !== me?.id && r.lastReadAt > max) max = r.lastReadAt;
    }
    return max;
  }, [detail, me]);

  const title = detail?.title ?? route.params.title ?? '';

  const subtitle = useMemo(() => {
    const names = Object.keys(typingMap)
      .map((id) => detail?.members.find((m) => m.userId === id)?.fullName.split(' ')[0])
      .filter((n): n is string => !!n);
    if (names.length === 1) return tr('typingNamed', { name: names[0] });
    if (names.length > 1) return `${names.join(', ')} ${tr('typing')}`;
    if (!detail) return '';
    if (isDirect && other) {
      const online = presence[other.userId] ?? other.online;
      return online ? tr('online') : lastSeenLabel(other.lastActiveAt, tr);
    }
    return tr('membersCount', { count: detail.members.length });
  }, [typingMap, detail, isDirect, other, presence, tr]);

  const headerAvatar = detail ? (
    <Avatar
      size={38}
      kind={detail.type}
      uri={isDirect ? other?.profilePhotoUrl : detail.group?.photoUrl}
      name={title}
      online={isDirect && other ? presence[other.userId] ?? other.online : null}
    />
  ) : null;

  const openInfo = () => {
    if (detail && detail.type !== 'DIRECT') navigation.navigate('GroupInfo', { conversationId });
  };

  const showPinned = detail && detail.pinned.length > 0;

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
      const older = messages[index + 1];
      const showDate = !older || !sameDay(older.createdAt, item.createdAt);
      return (
        <View>
          {showDate ? (
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: withAlpha(BRAND.violet, 0.14),
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {dayLabel(item.createdAt, tr)}
                </Text>
              </View>
            </View>
          ) : null}
          <MessageBubble
            message={item}
            meId={me?.id ?? ''}
            showSender={!isDirect}
            seen={!!maxOtherRead && item.createdAt <= maxOtherRead}
            highlighted={highlightId === item.id}
            onLongPress={setTarget}
            onToggleReaction={toggleReaction}
            onOpenPhotos={(urls, i) => setViewer({ urls, index: i })}
            onRetry={(m) => void sendNow(m)}
            onPressReply={(id) => void jumpTo(id)}
          />
        </View>
      );
    },
    [messages, me, isDirect, maxOtherRead, highlightId, toggleReaction, sendNow, jumpTo, colors, tr],
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        title={title}
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
        avatar={headerAvatar}
        onPressTitle={detail && detail.type !== 'DIRECT' ? openInfo : undefined}
        right={
          <>
            <HeaderButton icon="search" onPress={() => navigation.navigate('ChatSearch', { conversationId })} />
            {detail && detail.type !== 'DIRECT' ? (
              <HeaderButton icon="information-circle-outline" onPress={openInfo} />
            ) : null}
          </>
        }
      />

      {!connected ? (
        <View style={{ backgroundColor: BRAND.gold, paddingVertical: 3, alignItems: 'center' }}>
          <Text style={{ color: BRAND.deep, fontSize: 12, fontWeight: '700' }}>{tr('connecting')}</Text>
        </View>
      ) : null}

      {showPinned ? (
        <Pressable
          onPress={() => {
            const p = detail.pinned[pinIdx % detail.pinned.length];
            if (p) {
              void jumpTo(p.id);
              setPinIdx((i) => i + 1);
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Ionicons name="pin" size={16} color={BRAND.magenta} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: BRAND.magenta, fontSize: 11, fontWeight: '800' }}>
              {tr('pinned')} {detail.pinned.length > 1 ? `(${(pinIdx % detail.pinned.length) + 1}/${detail.pinned.length})` : ''}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13 }}>
              {detail.pinned[pinIdx % detail.pinned.length]?.text ?? '📎'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={BRAND.violet} size="large" />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={() => { setLoading(true); void load(); }} />
        ) : messages.length === 0 ? (
          <EmptyState text={tr('sayHello')} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={11}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListFooterComponent={
              loadingMore ? <ActivityIndicator color={BRAND.violet} style={{ margin: 14 }} /> : null
            }
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true,
              });
              setTimeout(
                () => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }),
                350,
              );
            }}
          />
        )}

        {detail?.readOnly ? (
          <View style={{ padding: 16, alignItems: 'center', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textSecondary }}>{tr('readOnly')}</Text>
          </View>
        ) : (
          <Composer
            onSend={handleSend}
            onTyping={handleTyping}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSubmitEdit={submitEdit}
          />
        )}
      </KeyboardAvoidingView>

      <MessageActions
        visible={!!target}
        actions={target ? actionsFor(target) : []}
        myEmojis={target ? target.reactions.filter((r) => r.userId === me?.id).map((r) => r.emoji) : []}
        onReact={(emoji) => target && void toggleReaction(target, emoji)}
        onClose={() => setTarget(null)}
      />

      <PhotoViewer urls={viewer?.urls ?? null} startIndex={viewer?.index ?? 0} onClose={() => setViewer(null)} />
    </View>
  );
}