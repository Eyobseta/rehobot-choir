import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  getEvent,
  rsvp,
  EventDetail,
  RsvpResponse,
} from '../../services/events';
import { ApiError } from '../../services/api';
import { me } from '../../services/auth';

export default function EventDetailScreen({ route }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await getEvent(id);
      setEvent(detail);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const m = await me();
          setMyUserId(m.user.id);
        } catch {
          // ignore
        }
        void load();
      })();
    }, [load]),
  );

  const onRsvp = async (response: RsvpResponse) => {
    if (!event) return;
    setBusy(true);
    try {
      await rsvp(event.id, response);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const myRsvp = event?.rsvps.find((r) => r.userId === myUserId)?.response;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl }}>
        <Text style={[typography.body, { color: colors.error }]}>
          {error ?? t('events.notFound')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.xl, backgroundColor: colors.background }}
    >
      {event.coverImageUrl && (
        <Image
          source={{ uri: event.coverImageUrl }}
          style={{ width: '100%', height: 220 }}
        />
      )}

      <View style={{ padding: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text }]}>
          {event.title}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          {new Date(event.date).toLocaleString()}
        </Text>
        {event.location && (
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 2 }]}>
            {event.location}
          </Text>
        )}

        {event.description && (
          <Text style={[typography.body, { color: colors.text, marginTop: spacing.lg }]}>
            {event.description}
          </Text>
        )}

        {event.attachments.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              {t('events.attachments')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {event.attachments.map((a) => (
                <Image
                  key={a.id}
                  source={{ uri: a.imageUrl }}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: radius.md,
                    marginRight: spacing.sm,
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.h3, { color: colors.text }]}>
            {t('events.rsvp')}
          </Text>

          {event.rsvpClosed ? (
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {t('events.rsvpClosed')}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <RsvpBtn
                label={t('events.rsvpGoing')}
                active={myRsvp === 'GOING'}
                disabled={busy}
                onPress={() => onRsvp('GOING')}
              />
              <RsvpBtn
                label={t('events.rsvpMaybe')}
                active={myRsvp === 'MAYBE'}
                disabled={busy}
                onPress={() => onRsvp('MAYBE')}
              />
              <RsvpBtn
                label={t('events.rsvpNotGoing')}
                active={myRsvp === 'NOT_GOING'}
                disabled={busy}
                onPress={() => onRsvp('NOT_GOING')}
              />
            </View>
          )}

          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xl }]}>
            {t('events.attendees')}
          </Text>
          {event.rsvps.length === 0 ? (
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {t('events.noRsvps')}
            </Text>
          ) : (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typography.body, { color: colors.text }]}>
                {t('events.rsvpGoing')}: {event.rsvps.filter((r) => r.response === 'GOING').length}
              </Text>
              <Text style={[typography.body, { color: colors.text }]}>
                {t('events.rsvpMaybe')}: {event.rsvps.filter((r) => r.response === 'MAYBE').length}
              </Text>
              <Text style={[typography.body, { color: colors.text }]}>
                {t('events.rsvpNotGoing')}: {event.rsvps.filter((r) => r.response === 'NOT_GOING').length}
              </Text>
            </View>
          )}
        </View>

        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );

  function RsvpBtn({
    label,
    active,
    disabled,
    onPress,
  }: {
    label: string;
    active: boolean;
    disabled: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          flex: 1,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.surface,
          alignItems: 'center',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text style={[typography.button, { color: active ? colors.primaryText : colors.text }]}>
          {label}
        </Text>
      </Pressable>
    );
  }
}