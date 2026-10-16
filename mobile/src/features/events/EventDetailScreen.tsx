import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { BRAND, withAlpha } from '../auth/Auth_UI';

type IconName = keyof typeof Ionicons.glyphMap;

const GREEN = '#16A34A';
const AMBER = '#F59E0B';
const RED = '#EF4444';

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: withAlpha(colors.error, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="calendar-clear-outline" size={32} color={colors.error} />
        </View>
        <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
          {error ?? t('events.notFound')}
        </Text>
      </View>
    );
  }

  const going = event.rsvps.filter((r) => r.response === 'GOING').length;
  const maybe = event.rsvps.filter((r) => r.response === 'MAYBE').length;
  const notGoing = event.rsvps.filter((r) => r.response === 'NOT_GOING').length;
  const total = event.rsvps.length;
  const d = new Date(event.date);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------- HERO ---------- */}
      <View style={{ height: 290 }}>
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <LinearGradient
            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="calendar" size={130} color="rgba(255,255,255,0.14)" />
          </LinearGradient>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(10,6,30,0.1)', 'rgba(10,6,30,0.0)', 'rgba(10,6,30,0.55)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* date badge */}
        <View
          style={{
            position: 'absolute',
            left: spacing.lg,
            bottom: 44,
            width: 62,
            paddingVertical: 8,
            borderRadius: 18,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          }}
        >
          <Text style={{ fontSize: 26, fontWeight: '800', color: BRAND.deep, lineHeight: 28 }}>
            {d.getDate()}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: BRAND.magenta,
              textTransform: 'uppercase',
            }}
          >
            {d.toLocaleString(undefined, { month: 'short' })}
          </Text>
        </View>
      </View>

      {/* ---------- SHEET ---------- */}
      <View
        style={{
          marginTop: -28,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          backgroundColor: colors.background,
          padding: spacing.xl,
          paddingTop: spacing.xl + 2,
        }}
      >
        <Text
          style={[
            typography.h2,
            { color: colors.text, fontWeight: '800', letterSpacing: -0.3 },
          ]}
        >
          {event.title}
        </Text>

        {/* info rows */}
        <View style={{ marginTop: spacing.md, gap: spacing.sm + 2 }}>
          <InfoRow
            icon="time"
            tint={BRAND.violet}
            text={new Date(event.date).toLocaleString()}
          />
          {event.location && (
            <InfoRow icon="location" tint={BRAND.magenta} text={event.location} />
          )}
        </View>

        {event.description && (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.md + 2,
              borderRadius: 22,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.body, { color: colors.text, lineHeight: 24 }]}>
              {event.description}
            </Text>
          </View>
        )}

        {event.attachments.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <SectionTitle icon="images" tint={BRAND.water} label={t('events.attachments')} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -spacing.xl }}
              contentContainerStyle={{ paddingHorizontal: spacing.xl }}
            >
              {event.attachments.map((a) => (
                <Image
                  key={a.id}
                  source={{ uri: a.imageUrl }}
                  style={{
                    width: 132,
                    height: 132,
                    borderRadius: 22,
                    marginRight: spacing.sm + 2,
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ---------- RSVP ---------- */}
        <View
          style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: 28,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <SectionTitle icon="ticket" tint={BRAND.violet} label={t('events.rsvp')} />

          {event.rsvpClosed ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: 16,
                backgroundColor: withAlpha(colors.textSecondary, 0.1),
              }}
            >
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}>
                {t('events.rsvpClosed')}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <RsvpBtn
                icon="checkmark-circle"
                tint={GREEN}
                label={t('events.rsvpGoing')}
                active={myRsvp === 'GOING'}
                disabled={busy}
                onPress={() => onRsvp('GOING')}
              />
              <RsvpBtn
                icon="help-circle"
                tint={AMBER}
                label={t('events.rsvpMaybe')}
                active={myRsvp === 'MAYBE'}
                disabled={busy}
                onPress={() => onRsvp('MAYBE')}
              />
              <RsvpBtn
                icon="close-circle"
                tint={RED}
                label={t('events.rsvpNotGoing')}
                active={myRsvp === 'NOT_GOING'}
                disabled={busy}
                onPress={() => onRsvp('NOT_GOING')}
              />
            </View>
          )}

          {/* attendees */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionTitle icon="people" tint={BRAND.magenta} label={t('events.attendees')} />
            {event.rsvps.length === 0 ? (
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {t('events.noRsvps')}
              </Text>
            ) : (
              <>
                {/* proportion bar */}
                <View
                  style={{
                    flexDirection: 'row',
                    height: 10,
                    borderRadius: 5,
                    overflow: 'hidden',
                    backgroundColor: withAlpha(colors.textSecondary, 0.12),
                  }}
                >
                  {going > 0 && <View style={{ flex: going, backgroundColor: GREEN }} />}
                  {maybe > 0 && <View style={{ flex: maybe, backgroundColor: AMBER }} />}
                  {notGoing > 0 && <View style={{ flex: notGoing, backgroundColor: RED }} />}
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <StatTile tint={GREEN} label={t('events.rsvpGoing')} count={going} />
                  <StatTile tint={AMBER} label={t('events.rsvpMaybe')} count={maybe} />
                  <StatTile tint={RED} label={t('events.rsvpNotGoing')} count={notGoing} />
                </View>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'right' },
                  ]}
                >
                  {total}
                </Text>
              </>
            )}
          </View>
        </View>

        {error && (
          <View
            style={{
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.md + 2,
              backgroundColor: withAlpha(colors.error, 0.1),
              borderWidth: 1,
              borderColor: withAlpha(colors.error, 0.35),
            }}
          >
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
              {error}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ---------- Helper components (module scope — stable across renders) ----------

function InfoRow({ icon, tint, text }: { icon: IconName; tint: string; text: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 13,
          backgroundColor: withAlpha(tint, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[typography.body, { color: colors.textSecondary, flex: 1 }]}>
        {text}
      </Text>
    </View>
  );
}

function SectionTitle({ icon, tint, label }: { icon: IconName; tint: string; label: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 9,
          backgroundColor: withAlpha(tint, 0.16),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>
        {label}
      </Text>
    </View>
  );
}

function StatTile({ tint, label, count }: { tint: string; label: string; count: number }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 12,
        borderRadius: 18,
        alignItems: 'center',
        backgroundColor: withAlpha(tint, 0.12),
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: tint }}>{count}</Text>
      <Text
        style={[typography.caption, { color: colors.text, fontWeight: '700', marginTop: 2 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function RsvpBtn({
  icon,
  tint,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: IconName;
  tint: string;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: active ? tint : colors.border,
        backgroundColor: active ? tint : colors.background,
        alignItems: 'center',
        gap: 4,
        opacity: disabled ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Ionicons
        name={active ? icon : (`${icon}-outline` as IconName)}
        size={22}
        color={active ? '#FFFFFF' : tint}
      />
      <Text
        style={[
          typography.caption,
          { color: active ? '#FFFFFF' : colors.text, fontWeight: '800' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}