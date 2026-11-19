import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useMe, isLeaderRole } from './chatSession';
import { useTr } from './chatStrings';
import {
  addMembersApi,
  deleteGroupApi,
  fetchDetail,
  removeMemberApi,
  updateGroupApi,
} from './chatApi';
import { onChatEvent } from './chatRealtime';
import { loadAllMembers, refreshConversations, useChatState } from './chatStore';
import { pickSinglePhoto } from './pickPhoto';
import type { ConversationDetail, MemberInfo } from './chatTypes';
import {
  Avatar,
  ChatHeader,
  EmptyState,
  MemberList,
  PromptModal,
  RoleBadge,
  SearchField,
} from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'GroupInfo'>;

export default function GroupInfoScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;
  const me = useMe();
  const leader = isLeaderRole(me?.role);
  const { presence } = useChatState();

  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail(await fetchDetail(conversationId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    const offs = [
      onChatEvent('conversation:updated', (p: { conversationId: string }) => {
        if (p.conversationId === conversationId) void load();
      }),
      onChatEvent('conversation:removed', (p: { conversationId: string }) => {
        if (p.conversationId === conversationId) navigation.popToTop();
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [conversationId, load, navigation]);

  const isGroup = detail?.type === 'GROUP';
  const group = detail?.group ?? null;
  const managerId = group?.managerId ?? null;
  const isManager = !!me && managerId === me.id;
  const canManage = isGroup && (leader || isManager);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await load();
      void refreshConversations();
    } catch (e) {
      Alert.alert((e as { message?: string }).message ?? tr('uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = () => {
    if (!isGroup) return;
    const pick = async () => {
      const p = await pickSinglePhoto().catch(() => null);
      if (p) await run(() => updateGroupApi(conversationId, { photo: p }));
    };
    if (group?.photoUrl) {
      Alert.alert(tr('changePhoto'), undefined, [
        { text: tr('changePhoto'), onPress: () => void pick() },
        { text: tr('removePhoto'), style: 'destructive', onPress: () => void run(() => updateGroupApi(conversationId, { removePhoto: true })) },
        { text: tr('cancel'), style: 'cancel' },
      ]);
    } else {
      void pick();
    }
  };

  const confirm = (title: string, onYes: () => void, destructive = true) =>
    Alert.alert(title, undefined, [
      { text: tr('cancel'), style: 'cancel' },
      { text: tr('done'), style: destructive ? 'destructive' : 'default', onPress: onYes },
    ]);

  const leave = () => {
    if (!me) return;
    const mgrIsLeader = isManager && isLeaderRole(me.role);
    if (mgrIsLeader) {
      Alert.alert(tr('transferFirst'));
      return;
    }
    confirm(tr('leaveConfirm'), () =>
      void run(async () => {
        await removeMemberApi(conversationId, me.id);
        navigation.popToTop();
      }),
    );
  };

  const deleteGroup = () =>
    confirm(tr('deleteGroupConfirm'), () =>
      void run(async () => {
        await deleteGroupApi(conversationId);
        navigation.popToTop();
      }),
    );

  const members = useMemo(() => {
    const list = detail?.members ?? [];
    return [...list].sort((a, b) => {
      if (a.userId === managerId) return -1;
      if (b.userId === managerId) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [detail, managerId]);

  if (failed && !detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ChatHeader title="" onBack={() => navigation.goBack()} />
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ChatHeader title="" onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  const header = (
    <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 14, paddingHorizontal: 16, gap: 10 }}>
      <Pressable onPress={changePhoto} disabled={!isGroup} accessibilityRole="button" accessibilityLabel={tr('changePhoto')}>
        <View
          style={{
            padding: 4,
            borderRadius: 60,
            borderWidth: 2,
            borderColor: withAlpha(BRAND.lime, 0.8),
          }}
        >
          <Avatar size={104} kind={detail.type} uri={group?.photoUrl} name={detail.title} />
        </View>
        {isGroup ? (
          <View
            style={{
              position: 'absolute',
              right: 2,
              bottom: 2,
              width: 34,
              height: 34,
              borderRadius: 12,
              backgroundColor: BRAND.teal,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.background,
            }}
          >
            <Ionicons name="camera" size={16} color={BRAND.lime} />
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => isGroup && setRenameOpen(true)}
        accessibilityRole={isGroup ? 'button' : 'header'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{detail.title}</Text>
        {isGroup ? <Ionicons name="pencil" size={16} color={colors.accent} /> : null}
      </Pressable>

      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: withAlpha(colors.accent, 0.14),
        }}
      >
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>
          {tr('membersCount', { count: detail.members.length })}
        </Text>
      </View>

      {canManage ? (
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            paddingHorizontal: 20,
            minHeight: 46,
            borderRadius: 999,
            backgroundColor: BRAND.teal,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Ionicons name="person-add" size={18} color={BRAND.lime} />
          <Text style={{ color: BRAND.lime, fontWeight: '800' }}>{tr('addMembers')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const footer = isGroup ? (
    <View style={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}>
      <Pressable
        onPress={leave}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: withAlpha(colors.error, 0.14), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="exit-outline" size={20} color={colors.error} />
        </View>
        <Text style={{ color: colors.error, fontWeight: '800', fontSize: 16 }}>{tr('leaveGroup')}</Text>
      </Pressable>
      {canManage ? (
        <Pressable
          onPress={deleteGroup}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 20,
            backgroundColor: withAlpha(colors.error, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(colors.error, 0.35),
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: withAlpha(colors.error, 0.18), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </View>
          <Text style={{ color: colors.error, fontWeight: '800', fontSize: 16 }}>{tr('deleteGroup')}</Text>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader title={detail.title} subtitle={tr('groupMembers')} onBack={() => navigation.goBack()} />
      <FlatList
        data={members}
        keyExtractor={(m) => m.userId}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => {
          const isMgr = item.userId === managerId;
          const isMe = item.userId === me?.id;
          const online = presence[item.userId] ?? item.online;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginHorizontal: 10,
                paddingHorizontal: 8,
                paddingVertical: 9,
                borderRadius: 18,
                backgroundColor: isMe ? withAlpha(colors.primary, 0.06) : 'transparent',
              }}
            >
              <Avatar uri={item.profilePhotoUrl} name={item.fullName} online={online} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                  {item.fullName}
                  {isMe ? ` (${tr('you')})` : ''}
                </Text>
                {isMgr ? (
                  <RoleBadge label={tr('manager')} tone="manager" />
                ) : item.role !== 'MEMBER' ? (
                  <RoleBadge label={tr('leader')} tone="leader" />
                ) : null}
              </View>
              {canManage && !isMgr && !isMe ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {item.role === 'LEADER' ? (
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={tr('makeManager')}
                      onPress={() =>
                        confirm(`${tr('makeManager')}: ${item.fullName}?`, () =>
                          void run(() => updateGroupApi(conversationId, { managerId: item.userId })),
                          false,
                        )
                      }
                      style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(BRAND.lime, 0.2) }}
                    >
                      <Ionicons name="ribbon-outline" size={20} color={colors.primary} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={tr('removeMember')}
                    onPress={() =>
                      confirm(`${tr('removeMember')}: ${item.fullName}?`, () =>
                        void run(() => removeMemberApi(conversationId, item.userId)),
                      )
                    }
                    style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.error, 0.12) }}
                  >
                    <Ionicons name="person-remove-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <PromptModal
        visible={renameOpen}
        title={tr('rename')}
        initialValue={detail.title}
        onClose={() => setRenameOpen(false)}
        onSubmit={(v) => {
          setRenameOpen(false);
          void run(() => updateGroupApi(conversationId, { name: v }));
        }}
      />

      <AddMembersModal
        visible={addOpen}
        existingIds={new Set(detail.members.map((m) => m.userId))}
        onClose={() => setAddOpen(false)}
        onAdd={(ids) => {
          setAddOpen(false);
          void run(() => addMembersApi(conversationId, ids));
        }}
      />

      {busy ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ padding: 22, borderRadius: 24, backgroundColor: colors.surface }}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function AddMembersModal({
  visible,
  existingIds,
  onClose,
  onAdd,
}: {
  visible: boolean;
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;
  const { presence } = useChatState();
  const [all, setAll] = useState<MemberInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setQuery('');
    loadAllMembers().then(setAll).catch(() => undefined);
  }, [visible]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((m) => !existingIds.has(m.userId))
      .filter((m) => !q || m.fullName.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [all, existingIds, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ChatHeader
          title={tr('addMembers')}
          subtitle={selected.size > 0 ? tr('selected', { count: selected.size }) : undefined}
          onBack={onClose}
          right={
            <Pressable
              onPress={() => selected.size > 0 && onAdd(Array.from(selected))}
              disabled={selected.size === 0}
              accessibilityRole="button"
              style={{
                paddingHorizontal: 18,
                height: 42,
                borderRadius: 15,
                backgroundColor: selected.size > 0 ? BRAND.lime : 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: selected.size > 0 ? BRAND.deep : 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
                {tr('done')}
              </Text>
            </Pressable>
          }
        />
        <View style={{ padding: 14 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder={tr('searchMembers')} />
        </View>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <MemberList
            members={candidates}
            selectedIds={selected}
            presence={presence}
            onPress={(m) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(m.userId)) next.delete(m.userId);
                else next.add(m.userId);
                return next;
              })
            }
          />
        </View>
      </View>
    </Modal>
  );
}