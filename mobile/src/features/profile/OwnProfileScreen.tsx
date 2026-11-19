import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Animated, Easing, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { formatEthDate, EthDate } from '../../utils/ethiopianCalendar';
import { AvatarRing, ErrorBanner, BRAND } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useOwnProfileQuery } from './useProfile';
import {
  ActionButton,
  Group,
  HeroChip,
  HeroShell,
  InfoRow,
  SavedNotice,
  SectionLabel,
  StaffLines,
} from './SettingsKit';

const AVATAR = 128;

function safeFmt(d: any, lang: 'en' | 'am' = 'en'): string {
  if (!d) return '—';
  try {
    if (typeof d === 'object' && 'year' in d && 'month' in d && 'day' in d) {
      return formatEthDate(d as EthDate, lang);
    }
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

export default function OwnProfileScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing } = theme;

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const gender = profile?.official.gender ?? '';
  const genderLabel = gender ? t(`register.${gender}`, { defaultValue: gender }) : '';
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
  const initial = (profile?.official.fullName ?? '?').trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={fadeUp(0)}>
          <HeroShell paddingBottom={28} radiusBottom={32}>
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }} />
              <GlassBackButton
                onPress={() => navigation.goBack()}
                accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
                size={44}
              />
            </View>

            <View style={styles.avatarWrap}>
              <StaffLines top={AVATAR / 2 - 20} />
              <AvatarRing
                size={AVATAR}
                uri={profile?.editable.profilePhotoUrl}
                gapColor={BRAND.teal}
                fallback={<Text style={{ fontSize: 44, fontWeight: '800', color: BRAND.lime }}>{initial}</Text>}
              />
            </View>

            <Text style={styles.heroName}>{profile?.official.fullName ?? ''}</Text>
            <View style={styles.chipRow}>
              <HeroChip icon="call" text={profile?.editable.phone ?? ''} />
            </View>
          </HeroShell>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {showingSavedData && (
            <View style={{ marginTop: spacing.md }}>
              <SavedNotice text={t('home.showingSavedData', { defaultValue: 'Showing saved data' })} />
            </View>
          )}

          <Animated.View style={fadeUp(1)}>
            <SectionLabel icon="shield-checkmark" title={t('myProfile.officialSection')} />
            <Group>
              <InfoRow icon="person" tone="lavender" label={t('register.fullName')} value={profile?.official.fullName ?? ''} />
              <InfoRow icon="male-female" tone="peach" label={t('register.gender')} value={genderLabel} />
              <InfoRow icon="gift" tone="mint" label={t('register.dateOfBirth')} value={safeFmt(profile?.official.dateOfBirth, lang)} />
              <InfoRow icon="calendar" tone="lime" label={t('register.joiningDate')} value={safeFmt(profile?.official.joiningDate, lang)} last />
            </Group>
          </Animated.View>

          <Animated.View style={fadeUp(2)}>
            <SectionLabel icon="create" title={t('myProfile.editableSection')} />
            <Group>
              <InfoRow icon="call" tone="mint" label={t('register.phone')} value={profile?.editable.phone ?? ''} />
              <InfoRow icon="mail" tone="lavender" label={t('register.email')} value={profile?.editable.email ?? '—'} />
              <InfoRow icon="heart" tone="peach" label={t('register.emergencyContactName')} value={profile?.editable.emergencyContactName ?? ''} />
              <InfoRow icon="medkit" tone="lime" label={t('register.emergencyContactPhone')} value={profile?.editable.emergencyContactPhone ?? ''} last />
            </Group>
          </Animated.View>

          {q.isError && q.data === undefined && (
            <View style={{ marginTop: spacing.lg }}>
              <ErrorBanner message={(q.error as { message?: string })?.message ?? 'Error'} />
            </View>
          )}

          <Animated.View style={[{ marginTop: 28 }, fadeUp(3)]}>
            <ActionButton
              icon="pencil"
              label={t('profile.editProfile')}
              onPress={() => navigation.navigate('EditProfile')}
            />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTopRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 4 },
  avatarWrap: { alignSelf: 'stretch', alignItems: 'center', marginTop: 6 },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 16, textAlign: 'center' },
  chipRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
});