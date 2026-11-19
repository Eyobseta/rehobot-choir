import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { searchMessagesApi } from './chatApi';
import { useTr } from './chatStrings';
import { dayLabel, formatClock } from './chatUtils';
import type { ChatMessage } from './chatTypes';
import { Avatar, EmptyState, HeaderButton, SearchField } from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatSearch'>;

/** Bold + tint every occurrence of `query` inside `text` (display only). */
function Highlighted({ text, query, color, hi }: { text: string; query: string; color: string; hi: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <Text style={{ color }}>{text}</Text>;
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let k = 0;
  while (from < text.length) {
    const at = lower.indexOf(needle, from);
    if (at === -1) {
      parts.push(text.slice(from));
      break;
    }
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <Text key={k++} style={{ backgroundColor: hi, color: BRAND.deep, fontWeight: '800' }}>
        {text.slice(at, at + needle.length)}
      </Text>,
    );
    from = at + needle.length;
  }
  return <Text style={{ color }}>{parts}</Text>;
}

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
      <View
        style={{
          backgroundColor: BRAND.teal,
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <HeaderButton icon="chevron-back" onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <SearchField value={q} onChangeText={setQ} placeholder={tr('search')} onDark autoFocus loading={loading} />
        </View>
      </View>

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
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.popTo('Conversation', { conversationId, jumpToId: item.id })}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 12,
                marginHorizontal: 10,
                paddingHorizontal: 8,
                paddingVertical: 11,
                borderRadius: 18,
                backgroundColor: pressed ? withAlpha(colors.primary, 0.08) : 'transparent',
              })}
            >
              <Avatar uri={item.sender.profilePhotoUrl} name={item.sender.fullName} size={42} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.accent, fontWeight: '800', fontSize: 13 }}>
                    {item.sender.fullName}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {dayLabel(item.createdAt, tr)} · {formatClock(item.createdAt)}
                  </Text>
                </View>
                <Text numberOfLines={3} style={{ fontSize: 15, lineHeight: 21, marginTop: 3 }}>
                  <Highlighted
                    text={item.text ?? ''}
                    query={q}
                    color={colors.text}
                    hi={withAlpha(BRAND.lime, 0.55)}
                  />
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}