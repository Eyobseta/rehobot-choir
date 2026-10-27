import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
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
      <ChatHeader title={tr('reports')} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={BRAND.violet} size="large" />
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
              <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8, opacity: busy ? 0.6 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: BRAND.magenta, fontWeight: '800' }}>{r.conversationTitle}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {tr('reportCount', { count: r.reportCount })}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{r.message.sender.fullName}</Text>
                {photo ? (
                  <Image source={{ uri: thumbUrl(photo.storageUrl, 500) }} style={{ width: '100%', height: 180, borderRadius: 12 }} resizeMode="cover" />
                ) : null}
                <Text style={{ color: colors.text, fontSize: 15 }}>{messagePreview(r.message, tr)}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {dayLabel(r.message.createdAt, tr)} · {formatClock(r.message.createdAt)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {tr('reportedBy', { names: r.reporters.join(', ') })}
                </Text>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <ActionButton label={tr('keep')} color={BRAND.violet} onPress={() => ask(r, 'KEPT', tr('keep'))} disabled={busy} />
                  <ActionButton label={tr('dismiss')} color={colors.textSecondary} onPress={() => ask(r, 'DISMISSED', tr('dismiss'))} disabled={busy} />
                  <ActionButton label={tr('deleteMessage')} color={colors.error} onPress={() => ask(r, 'DELETED', tr('deleteMessage'))} disabled={busy} />
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
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: withAlpha(color, 0.14),
      }}
    >
      <Text numberOfLines={1} style={{ color, fontWeight: '800', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
