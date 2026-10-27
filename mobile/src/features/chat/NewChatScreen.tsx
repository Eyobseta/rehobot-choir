import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
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
import { ChatHeader, EmptyState, MemberList } from './components/ChatUI';

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
      </View>
      {leader ? (
        <Pressable
          onPress={() => navigation.navigate('CreateGroup')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: pressed ? withAlpha(BRAND.violet, 0.08) : 'transparent',
          })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND.magenta, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people" size={22} color="#FFFFFF" />
          </View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{tr('newGroup')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader title={tr('newChat')} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND.violet} size="large" />
        </View>
      ) : failed ? (
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      ) : (
        <MemberList members={list} onPress={startDm} presence={presence} header={header} />
      )}
    </View>
  );
}
