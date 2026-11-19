import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useMe } from './chatSession';
import { useTr } from './chatStrings';
import { createGroupApi } from './chatApi';
import { loadAllMembers, refreshConversations, useChatState } from './chatStore';
import { pickSinglePhoto } from './pickPhoto';
import type { LocalPhoto, MemberInfo } from './chatTypes';
import { Avatar, ChatHeader, EmptyState, MemberList, SearchField } from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const me = useMe();
  const { presence } = useChatState();

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    loadAllMembers()
      .then(setMembers)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => m.userId !== me?.id)
      .filter((m) => !q || m.fullName.toLowerCase().includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, query, me]);

  // Display only: the people picked so far, shown as removable chips.
  const picked = useMemo(
    () => members.filter((m) => selected.has(m.userId)),
    [members, selected],
  );

  const toggle = (m: MemberInfo) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(m.userId)) next.delete(m.userId);
      else next.add(m.userId);
      return next;
    });

  const choosePhoto = async () => {
    try {
      const p = await pickSinglePhoto();
      if (p) setPhoto(p);
    } catch {
      // picker cancelled / failed
    }
  };

  const canCreate = name.trim().length > 0 && !busy;

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const { id } = await createGroupApi({
        name: name.trim(),
        memberIds: Array.from(selected),
        photo,
      });
      void refreshConversations();
      navigation.replace('Conversation', { conversationId: id, title: name.trim() });
    } catch (e) {
      Alert.alert((e as { message?: string }).message ?? tr('uploadFailed'));
      setBusy(false);
    }
  };

  const header = (
    <View style={{ padding: 16, gap: 14 }}>
      {/* Photo + name card */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 24,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel={tr('changePhoto')}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 24 }} />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: withAlpha(colors.accent, 0.12),
                borderWidth: 1.5,
                borderColor: withAlpha(colors.accent, 0.5),
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera" size={26} color={colors.accent} />
            </View>
          )}
          <View
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 26,
              height: 26,
              borderRadius: 10,
              backgroundColor: BRAND.lime,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.surface,
            }}
          >
            <Ionicons name="add" size={16} color={BRAND.deep} />
          </View>
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder={tr('groupName')}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 18,
            fontWeight: '700',
            borderBottomWidth: 2,
            borderBottomColor: name.trim() ? colors.primary : colors.border,
            paddingVertical: 8,
          }}
        />
      </View>

      <SearchField value={query} onChangeText={setQuery} placeholder={tr('searchMembers')} />

      {picked.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {picked.map((m) => (
            <Pressable
              key={m.userId}
              onPress={() => toggle(m)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingLeft: 4,
                paddingRight: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: withAlpha(colors.primary, 0.14),
                borderWidth: 1,
                borderColor: withAlpha(colors.primary, 0.4),
              }}
            >
              <Avatar uri={m.profilePhotoUrl} name={m.fullName} size={26} />
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 13, maxWidth: 110 }}>
                {m.fullName.split(' ')[0]}
              </Text>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>
        {tr('selectMembers')} · {tr('selected', { count: selected.size })}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        title={tr('newGroup')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={create}
            disabled={!canCreate}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 18,
              height: 42,
              borderRadius: 15,
              backgroundColor: canCreate ? BRAND.lime : 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {busy ? (
              <ActivityIndicator color={BRAND.deep} />
            ) : (
              <Text style={{ color: canCreate ? BRAND.deep : 'rgba(255,255,255,0.7)', fontWeight: '800' }}>
                {tr('create')}
              </Text>
            )}
          </Pressable>
        }
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : failed ? (
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      ) : (
        <MemberList members={list} selectedIds={selected} onPress={toggle} presence={presence} header={header} />
      )}
    </View>
  );
}