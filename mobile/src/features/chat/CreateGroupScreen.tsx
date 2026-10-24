import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../../../src/navigation/ChatStack';
import { useMe } from './chatSession';
import { useTr } from './chatStrings';
import { createGroupApi } from './chatApi';
import { loadAllMembers, refreshConversations, useChatState } from './chatStore';
import { pickSinglePhoto } from './pickPhoto';
import type { LocalPhoto, MemberInfo } from './chatTypes';
import { ChatHeader, EmptyState, MemberList } from './components/ChatUI';

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable onPress={choosePhoto}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: 68, height: 68, borderRadius: 34 }} />
          ) : (
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera" size={26} color={BRAND.violet} />
            </View>
          )}
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          placeholder={tr('groupName')}
          placeholderTextColor={colors.textSecondary}
          style={{
            flex: 1,
            color: colors.text,
            fontSize: 17,
            borderBottomWidth: 2,
            borderBottomColor: BRAND.violet,
            paddingVertical: 8,
          }}
        />
      </View>

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
          placeholder={tr('searchMembers')}
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, color: colors.text, fontSize: 15 }}
        />
      </View>
      <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
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
            style={{
              paddingHorizontal: 16,
              height: 40,
              borderRadius: 20,
              backgroundColor: canCreate ? BRAND.gold : 'rgba(255,255,255,0.2)',
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
          <ActivityIndicator color={BRAND.violet} size="large" />
        </View>
      ) : failed ? (
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      ) : (
        <MemberList members={list} selectedIds={selected} onPress={toggle} presence={presence} header={header} />
      )}
    </View>
  );
}
