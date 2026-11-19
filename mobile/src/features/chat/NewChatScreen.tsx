import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useMe, isLeaderRole } from './chatSession';
import { useTr } from './chatStrings';
import { openDirect } from './chatApi';
import { loadAllMembers, useChatState } from './chatStore';
import type { MemberInfo } from './chatTypes';
import { ChatHeader, EmptyState, MemberList, SearchField } from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'NewChat'>;

export default function NewChatScreen({ navigation }: Props) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const me = useMe();
  const leader = isLeaderRole(me?.role);
  const { presence } = useChatState();

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [opening, setOpening] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    loadAllMembers(true)
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

  const startDm = async (m: MemberInfo) => {
    if (opening) return;
    setOpening(true);
    try {
      const { id } = await openDirect(m.userId);
      navigation.replace('Conversation', { conversationId: id, title: m.fullName });
    } catch (e) {
      Alert.alert((e as { message?: string }).message ?? tr('loadFailed'));
      setOpening(false);
    }
  };

  const header = (
    <View>
      <View style={{ padding: 14 }}>
        <SearchField value={query} onChangeText={setQuery} placeholder={tr('searchMembers')} />
      </View>
      {leader ? (
        <Pressable
          onPress={() => navigation.navigate('CreateGroup')}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginHorizontal: 14,
            marginBottom: 8,
            padding: 12,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              backgroundColor: BRAND.lime,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={22} color={BRAND.deep} />
          </View>
          <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' }}>{tr('newGroup')}</Text>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: BRAND.teal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-forward" size={15} color={BRAND.lime} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader title={tr('newChat')} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : failed ? (
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      ) : (
        <MemberList members={list} onPress={startDm} presence={presence} header={header} />
      )}
      {opening ? (
        <View
          pointerEvents="auto"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(colors.background, 0.55), alignItems: 'center', justifyContent: 'center' }}
        >
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
    </View>
  );
}