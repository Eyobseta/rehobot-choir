import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha } from '../auth/Auth_UI';
import type { ChatStackParamList } from '../../navigation/ChatStack';
import { useTr } from './chatStrings';
import { fetchReports, resolveReportApi } from './chatApi';
import { dayLabel, formatClock, messagePreview, thumbUrl } from './chatUtils';
import type { ReportItem } from './chatTypes';
import { ChatHeader, EmptyState } from './components/ChatUI';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatReports'>;

export default function ChatReportsScreen({ navigation }: Props) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await fetchReports());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (r: ReportItem, resolution: 'KEPT' | 'DELETED' | 'DISMISSED') => {
    setBusyId(r.messageId);
    try {
      await resolveReportApi(r.messageId, resolution);
      setItems((prev) => prev.filter((x) => x.messageId !== r.messageId));
    } catch (e) {
      Alert.alert((e as { message?: string }).message ?? tr('uploadFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const ask = (r: ReportItem, resolution: 'KEPT' | 'DELETED' | 'DISMISSED', label: string) =>
    Alert.alert(label, undefined, [
      { text: tr('cancel'), style: 'cancel' },
      {
        text: tr('done'),
        style: resolution === 'DELETED' ? 'destructive' : 'default',
        onPress: () => void resolve(r, resolution),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ChatHeader
        title={tr('reports')}
        subtitle={!loading && !failed && items.length > 0 ? String(items.length) : undefined}
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : failed ? (
        <EmptyState icon="cloud-offline-outline" text={tr('loadFailed')} actionLabel={tr('retry')} onAction={load} />
      ) : items.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" text={tr('noReports')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.messageId}
          contentContainerStyle={{ padding: 14, gap: 12 }}
          renderItem={({ item: r }) => {
            const photo = r.message.media.find((m) => m.type === 'PHOTO');
            const busy = busyId === r.messageId;
            return (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 10,
                  opacity: busy ? 0.6 : 1,
                  overflow: 'hidden',
                }}
              >
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.warning }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.accent, fontWeight: '800' }}>
                    {r.conversationTitle}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: withAlpha(colors.warning, 0.16),
                    }}
                  >
                    <Ionicons name="flag" size={12} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '800' }}>
                      {tr('reportCount', { count: r.reportCount })}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{r.message.sender.fullName}</Text>

                {photo ? (
                  <Image
                    source={{ uri: thumbUrl(photo.storageUrl, 500) }}
                    style={{ width: '100%', height: 180, borderRadius: 18 }}
                    resizeMode="cover"
                  />
                ) : null}

                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21 }}>{messagePreview(r.message, tr)}</Text>

                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {dayLabel(r.message.createdAt, tr)} · {formatClock(r.message.createdAt)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {tr('reportedBy', { names: r.reporters.join(', ') })}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <ActionButton icon="checkmark-circle" label={tr('keep')} color={colors.success} onPress={() => ask(r, 'KEPT', tr('keep'))} disabled={busy} />
                  <ActionButton icon="close-circle" label={tr('dismiss')} color={colors.textSecondary} onPress={() => ask(r, 'DISMISSED', tr('dismiss'))} disabled={busy} />
                  <ActionButton icon="trash" label={tr('deleteMessage')} color={colors.error} onPress={() => ask(r, 'DELETED', tr('deleteMessage'))} disabled={busy} />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        paddingHorizontal: 4,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: withAlpha(color, 0.14),
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text numberOfLines={1} style={{ color, fontWeight: '800', fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}