import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import type { MemberDetail } from '../../services/members';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import type { HomeStackParamList } from '../../navigation/HomeStack';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import { useMemberQuery } from './useDirectory';

type Props = NativeStackScreenProps<HomeStackParamList, 'MemberProfile'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const accents = {
  violet: '#8B6FD6', violetSoft: '#8B6FD622',
  cyan: '#14A38B', cyanSoft: '#14A38B22',
  pink: '#E8736F', pinkSoft: '#E8736F22',
  gold: '#E8A65D', goldSoft: '#E8A65D22',
  lime: '#2FB36A', limeSoft: '#2FB36A22',
};

export default function MemberProfileScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const q = useMemberQuery(id);
  const member = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  if (firstLoad) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: withAlpha(colors.error, 0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={32} color={colors.error} />
        </View>
        <ErrorBanner message={(q.error as { message?: string })?.message ?? t('directory.memberNotFound', { defaultValue: 'Member not found' })} />

        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const initial = member.fullName.trim().charAt(0).toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: BRAND.teal,  paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 28, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden', alignItems: 'center' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -70, left: -70, width: 130, height: 130, borderRadius: 65, backgroundColor: BRAND.lime }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -70, right: -60, width: 130, height: 130, borderRadius: 65, backgroundColor: BRAND.lavender }} />

        <View pointerEvents="box-none" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
          <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} />
        </View>

        <LinearGradient colors={[BRAND.lime, BRAND.mint, BRAND.lavender, BRAND.lime]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 148, height: 148, borderRadius: 74, padding: 4 }}>
          {member.profilePhotoUrl ? (
            <Image source={{ uri: member.profilePhotoUrl }} style={{ width: '100%', height: '100%', borderRadius: 70 }} />
          ) : (
            <View style={{ flex: 1, borderRadius: 70, backgroundColor: BRAND.deep, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 54, fontWeight: '800', color: BRAND.gold }}>{initial}</Text>
            </View>
          )}
        </LinearGradient>

        <Text style={[typography.h2, { color: '#FFFFFF', marginTop: 16, textAlign: 'center', fontWeight: '800' }]}>{member.fullName}</Text>

        {!member.deleted && member.phone && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <Ionicons name="call" size={12} color={BRAND.gold} />
            <Text style={{ color: BRAND.gold, fontSize: 12, fontWeight: '700' }}>{member.phone}</Text>
          </View>
        )}
      </View>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
          <View accessibilityRole="text" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#E8A65D', 0.14), borderWidth: 1, borderColor: withAlpha('#E8A65D', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
            <Text style={[typography.caption, { color: '#E8A65D', fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {!member.deleted && (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <View style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, overflow: 'hidden' }}>
            {member.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${member.phone}`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}
                accessibilityRole="button"
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: accents.limeSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="call" size={18} color={accents.lime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('memberProfile.phone')}</Text>
                  <Text style={[typography.body, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>{member.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            )}

            {member.email && (
              <InfoRow icon="mail" tint={accents.cyan} soft={accents.cyanSoft} label={t('memberProfile.email')} value={member.email} />
            )}
            {member.gender && (
              <InfoRow icon="male-female" tint={accents.pink} soft={accents.pinkSoft} label={t('memberProfile.gender')} value={member.gender} />
            )}
            {member.dateOfBirth && (
              <InfoRow icon="gift" tint={accents.gold} soft={accents.goldSoft} label={t('memberProfile.dateOfBirth')} value={formatEthDate(member.dateOfBirth, lang)} />
            )}
            {member.joiningDate && (
              <InfoRow icon="calendar" tint={accents.violet} soft={accents.violetSoft} label={t('memberProfile.joiningDate')} value={formatEthDate(member.joiningDate, lang)} last />
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function InfoRow({ icon, tint, soft, label, value, last }: { icon: IconName; tint: string; soft: string; label: string; value: string; last?: boolean }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );
}