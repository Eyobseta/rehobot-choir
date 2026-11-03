import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { formatEthDate, EthDate } from '../../utils/ethiopianCalendar';
import {
  AvatarRing,
  PrimaryButton,
  ErrorBanner,
  WaterDrops,
  BRAND,
  withAlpha,
} from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useOwnProfileQuery } from './useProfile';

const accents = {
  violet: '#B6A0FF', violetSoft: '#B6A0FF22',
  cyan: '#6EDBD5', cyanSoft: '#6EDBD522',
  pink: '#EE9BBD', pinkSoft: '#EE9BBD22',
  gold: '#E6C779', goldSoft: '#E6C77922',
  lime: '#B8E986', limeSoft: '#B8E98622',
};

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function safeFmt(d: any): string {
  if (!d) return '—';
  try {
    if (typeof d === 'object' && 'year' in d && 'month' in d && 'day' in d) {
      return formatEthDate(d as EthDate, 'en');
    }
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

export default function OwnProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const q = useOwnProfileQuery();
  const profile = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (firstLoad) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [firstLoad, enter]);

  if (firstLoad) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  const gender = profile?.official.gender ?? '';
  const genderLabel = gender
    ? t(`register.${gender}`, { defaultValue: gender })
    : '';
  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [24 + i * 10, 0],
        }),
      },
    ],
  });
  const initial = (profile?.official.fullName ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={fadeUp(0)}>
          <LinearGradient
            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 16 }]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.blob,
                {
                  top: -50,
                  left: -50,
                  backgroundColor: withAlpha(BRAND.gold, 0.18),
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.blob,
                {
                  bottom: -70,
                  right: -50,
                  backgroundColor: withAlpha(BRAND.water, 0.2),
                },
              ]}
            />

            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }} />
              <GlassBackButton
                onPress={() => navigation.goBack()}
                accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
              />
            </View>

            <AvatarRing
              size={160}
              uri={profile?.editable.profilePhotoUrl}
              gapColor={BRAND.deep}
              fallback={
                <Text
                  style={{ fontSize: 44, fontWeight: '800', color: BRAND.gold }}
                >
                  {initial}
                </Text>
              }
            />
            <Text style={styles.heroName}>
              {profile?.official.fullName ?? ''}
            </Text>
            <View style={styles.heroChip}>
              <Ionicons name="call" size={12} color={BRAND.gold} />
              <Text style={styles.heroChipText}>
                {profile?.editable.phone ?? ''}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.xl }}>
          {showingSavedData && (
            <View style={{ marginTop: spacing.md }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: withAlpha('#F59E0B', 0.14),
                  borderWidth: 1,
                  borderColor: withAlpha('#F59E0B', 0.4),
                }}
              >
                <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
                <Text
                  style={[
                    theme.typography.caption,
                    { color: '#F59E0B', fontWeight: '800' },
                  ]}
                >
                  {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
                </Text>
              </View>
            </View>
          )}

          {/* Official */}
          <Animated.View style={fadeUp(1)}>
            <SectionTitle
              icon="shield-checkmark"
              color={BRAND.violet}
              title={t('myProfile.officialSection')}
            />
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <InfoRow
                icon="person"
                tint={accents.violet}
                soft={accents.violetSoft}
                label={t('register.fullName')}
                value={profile?.official.fullName ?? ''}
              />
              <InfoRow
                icon="male-female"
                tint={accents.pink}
                soft={accents.pinkSoft}
                label={t('register.gender')}
                value={genderLabel}
              />
              <InfoRow
                icon="gift"
                tint={accents.gold}
                soft={accents.goldSoft}
                label={t('register.dateOfBirth')}
                value={safeFmt(profile?.official.dateOfBirth)}
              />
              <InfoRow
                icon="calendar"
                tint={accents.cyan}
                soft={accents.cyanSoft}
                label={t('register.joiningDate')}
                value={safeFmt(profile?.official.joiningDate)}
                last
              />
            </View>
          </Animated.View>

          {/* Editable */}
          <Animated.View style={fadeUp(2)}>
            <SectionTitle
              icon="create"
              color={BRAND.magenta}
              title={t('myProfile.editableSection')}
            />
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <InfoRow
                icon="call"
                tint={accents.lime}
                soft={accents.limeSoft}
                label={t('register.phone')}
                value={profile?.editable.phone ?? ''}
              />
              <InfoRow
                icon="mail"
                tint={accents.cyan}
                soft={accents.cyanSoft}
                label={t('register.email')}
                value={profile?.editable.email ?? '—'}
              />
              <InfoRow
                icon="heart"
                tint={accents.pink}
                soft={accents.pinkSoft}
                label={t('register.emergencyContactName')}
                value={profile?.editable.emergencyContactName ?? ''}
              />
              <InfoRow
                icon="medkit"
                tint={accents.gold}
                soft={accents.goldSoft}
                label={t('register.emergencyContactPhone')}
                value={profile?.editable.emergencyContactPhone ?? ''}
                last
              />
            </View>
          </Animated.View>

          {q.isError && q.data === undefined && (
            <View style={{ marginTop: spacing.lg }}>
              <ErrorBanner
                message={
                  (q.error as { message?: string })?.message ?? 'Error'
                }
              />
            </View>
          )}

          <Animated.View style={[{ marginTop: 28 }, fadeUp(3)]}>
            <PrimaryButton
              label={t('profile.editProfile')}
              onPress={() => navigation.navigate('EditProfile')}
              iconNode={
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
              }
            />
          </Animated.View>
        </View>
      </ScrollView>
      <WaterDrops />
    </View>
  );
}

function SectionTitle({
  icon,
  color,
  title,
}: {
  icon: IconName;
  color: string;
  title: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={styles.sectionTitle}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Ionicons name={icon} size={16} color={color} />
      <Text
        style={[
          typography.caption,
          {
            color: colors.textSecondary,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: '800',
          },
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

function InfoRow({
  icon,
  tint,
  soft,
  label,
  value,
  last,
}: {
  icon: IconName;
  tint: string;
  soft: string;
  label: string;
  value: string | null | undefined;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={[
        styles.row,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[typography.body, { color: colors.text, fontWeight: '600' }]}
          numberOfLines={1}
        >
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 16,
    textAlign: 'center',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroChipText: { color: BRAND.gold, fontSize: 12, fontWeight: '700' },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    marginBottom: 10,
  },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  card: { borderWidth: 1, paddingHorizontal: 14, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});