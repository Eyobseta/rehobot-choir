import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../../../src/navigation/ChatStack';
import { searchMessagesApi } from './chatApi';
import { useTr } from './chatStrings';
import { dayLabel, formatClock } from './chatUtils';
import type { ChatMessage } from './chatTypes';
import { EmptyState, HeaderButton } from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatSearch'>;

export default function ChatSearchScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;

  const [q, setQ] = useState('');
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const cursor = useRef<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setItems([]);
      setSearched(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const page = await searchMessagesApi(conversationId, text);
        if (mySeq !== seq.current) return;
        setItems(page.items);
        cursor.current = page.nextCursor;
        setSearched(true);
      } catch {
        if (mySeq === seq.current) setItems([]);
      } finally {
        if (mySeq === seq.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [q, conversationId]);

  const loadMore = async () => {
    if (!cursor.current || loading) return;
    const mySeq = seq.current;
    try {
      const page = await searchMessagesApi(conversationId, q.trim(), cursor.current);
      if (mySeq !== seq.current) return;
      setItems((p) => [...p, ...page.items]);
      cursor.current = page.nextCursor;
    } catch {
      // ignore
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet]}
        style={{ paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <HeaderButton icon="chevron-back" onPress={() => navigation.goBack()} />
        <View
          style={{
            flex: 1,
            height: 42,
            borderRadius: 21,
            backgroundColor: 'rgba(255,255,255,0.18)',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={18} color="#FFFFFF" />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={tr('search')}
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={{ flex: 1, color: '#FFFFFF', fontSize: 16 }}
          />
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        </View>
      </LinearGradient>

      {q.trim().length < 2 ? (
        <EmptyState icon="search-outline" text={tr('searchHint')} />
      ) : searched && items.length === 0 && !loading ? (
        <EmptyState icon="search-outline" text={tr('noResults')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.popTo('Conversation', { conversationId, jumpToId: item.id })}
              style={({ pressed }) => ({
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: pressed ? withAlpha(BRAND.violet, 0.08) : 'transparent',
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: BRAND.magenta, fontWeight: '800', fontSize: 13 }}>{item.sender.fullName}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {dayLabel(item.createdAt, tr)} · {formatClock(item.createdAt)}
                </Text>
              </View>
              <Text numberOfLines={3} style={{ color: colors.text, fontSize: 15, marginTop: 3 }}>
                {item.text}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
