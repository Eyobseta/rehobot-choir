import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  getApplication,
  approveApplication,
  rejectApplication,
  ApplicationDetail,
} from '../../services/leaders';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import type { LeaderStackParamList } from '../../navigation/LeaderStack';

type Props = NativeStackScreenProps<LeaderStackParamList, 'ApplicantDetail'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const accents = {
  violet: '#B6A0FF', violetSoft: '#B6A0FF22',
  cyan: '#6EDBD5', cyanSoft: '#6EDBD522',
  pink: '#EE9BBD', pinkSoft: '#EE9BBD22',
  gold: '#E6C779', goldSoft: '#E6C77922',
  lime: '#B8E986', limeSoft: '#B8E98622',
};

export default function ApplicantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const detail = await getApplication(id);
        if (alive) setItem(detail);
      } catch (e) {
        const err = e as ApiError;
        if (alive) setError(`${err.message} [${err.code}]`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const onApprove = () => {
    if (!item) return;
    Alert.alert(
      t('leader.approveConfirmTitle'),
      t('leader.approveConfirmBody', { name: item.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('leader.approveConfirmYes'),
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await approveApplication(item.id);
              navigation.goBack();
            } catch (e) {
              const err = e as ApiError;
              setError(`${err.message} [${err.code}]`);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onReject = async () => {
    if (!item) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError(t('leader.reasonRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rejectApplication(item.id, reason);
      setRejectModalOpen(false);
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.violet} />
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md },
          ]}
        >
          {t('leader.loadingDetail')}
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
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
          <Ionicons name="person-outline" size={32} color={colors.error} />
        </View>
        <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
          {error ?? 'Not found'}
        </Text>

        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const initial = item.fullName.trim().charAt(0).toUpperCase();
  const genderLabel = item.gender
    ? t(`register.${item.gender}`, { defaultValue: item.gender })
    : '';

  return (
    <>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: 28,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
            alignItems: 'center',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -60,
              left: -70,
              width: 210,
              height: 210,
              borderRadius: 105,
              backgroundColor: withAlpha(BRAND.gold, 0.18),
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -80,
              right: -60,
              width: 230,
              height: 230,
              borderRadius: 115,
              backgroundColor: withAlpha(BRAND.water, 0.2),
            }}
          />

          {/* Back — top-right of hero */}
          <View
            pointerEvents="box-none"
            style={{ alignSelf: 'flex-end', marginBottom: 8 }}
          >
            <GlassBackButton
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
              size={44}
            />
          </View>

          {/* Avatar with gradient ring */}
          <LinearGradient
            colors={[BRAND.gold, BRAND.magenta, BRAND.violet, BRAND.water, BRAND.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 148, height: 148, borderRadius: 74, padding: 4 }}
          >
            {item.profilePhotoUrl ? (
              <Image
                source={{ uri: item.profilePhotoUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 70 }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  borderRadius: 70,
                  backgroundColor: BRAND.deep,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 54, fontWeight: '800', color: BRAND.gold }}>
                  {initial}
                </Text>
              </View>
            )}
          </LinearGradient>

          <Text
            style={[
              typography.h2,
              { color: '#FFFFFF', marginTop: 16, textAlign: 'center', fontWeight: '800' },
            ]}
          >
            {item.fullName}
          </Text>

          {/* Pending chip */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              marginTop: 10,
              backgroundColor: withAlpha('#F59E0B', 0.24),
              borderWidth: 1,
              borderColor: withAlpha('#F59E0B', 0.5),
            }}
          >
            <Ionicons name="time" size={12} color="#FDE68A" />
            <Text style={{ color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>
              {t('status.pendingTitle', { defaultValue: 'PENDING' })}
            </Text>
          </View>
        </LinearGradient>

        {/* ---------- Info card ---------- */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <View
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              overflow: 'hidden',
            }}
          >
            <InfoRow icon="call" tint={accents.lime} soft={accents.limeSoft} label={t('register.phone')} value={item.phone} />
            <InfoRow icon="mail" tint={accents.cyan} soft={accents.cyanSoft} label={t('register.email')} value={item.email} />
            <InfoRow icon="male-female" tint={accents.pink} soft={accents.pinkSoft} label={t('register.gender')} value={genderLabel} />
            <InfoRow
              icon="gift"
              tint={accents.gold}
              soft={accents.goldSoft}
              label={t('register.dateOfBirth')}
              value={new Date(item.dateOfBirth).toISOString().slice(0, 10)}
            />
            <InfoRow
              icon="heart"
              tint={accents.pink}
              soft={accents.pinkSoft}
              label={t('register.emergencyContactName')}
              value={item.emergencyContactName}
            />
            <InfoRow
              icon="medkit"
              tint={accents.gold}
              soft={accents.goldSoft}
              label={t('register.emergencyContactPhone')}
              value={item.emergencyContactPhone}
            />
            {item.joiningDate && (
              <InfoRow
                icon="calendar"
                tint={accents.violet}
                soft={accents.violetSoft}
                label={t('register.joiningDate')}
                value={new Date(item.joiningDate).toISOString().slice(0, 10)}
              />
            )}
            <InfoRow
              icon="time"
              tint={accents.cyan}
              soft={accents.cyanSoft}
              label={t('leader.submittedAt', { when: '' })}
              value={new Date(item.createdAt).toLocaleString()}
              last
            />
          </View>

          {error && (
            <View
              style={{
                marginTop: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: 14,
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

          {/* Decision buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Pressable
              onPress={() => setRejectModalOpen(true)}
              disabled={busy}
              style={{ flex: 1, opacity: busy ? 0.6 : 1 }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#C0262D', '#E0405A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  minHeight: 54,
                  borderRadius: radius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: '#C0262D',
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                  {t('leader.reject')}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={onApprove}
              disabled={busy}
              style={{ flex: 1, opacity: busy ? 0.6 : 1 }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={['#16A34A', '#22C55E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  minHeight: 54,
                  borderRadius: radius.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: '#16A34A',
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                      {t('leader.approve')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ---------- Reject modal ---------- */}
      <Modal
        visible={rejectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.55)',
              justifyContent: 'center',
              padding: spacing.xl,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 28,
                padding: 22,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: withAlpha(colors.error, 0.16),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close-circle" size={26} color={colors.error} />
              </View>

              <Text
                style={[
                  typography.h3,
                  { color: colors.text, marginTop: 12, fontWeight: '800' },
                ]}
              >
                {t('leader.rejectReasonTitle')}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: 4 },
                ]}
              >
                {t('leader.rejectReasonLabel')}
              </Text>

              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t('leader.rejectReasonPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  marginTop: spacing.sm,
                  minHeight: 100,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1.5,
                  borderRadius: radius.md + 2,
                  padding: spacing.md,
                  color: colors.text,
                  textAlignVertical: 'top',
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  marginTop: spacing.lg,
                }}
              >
                <Pressable
                  onPress={() => {
                    setRejectModalOpen(false);
                    setRejectReason('');
                  }}
                  style={{
                    flex: 1,
                    minHeight: 54,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[typography.button, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={onReject}
                  disabled={busy}
                  style={{ flex: 1, opacity: busy ? 0.7 : 1 }}
                >
                  <LinearGradient
                    colors={['#C0262D', '#E0405A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      minHeight: 54,
                      borderRadius: radius.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                        <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                          {t('leader.rejectSubmit')}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  value: string;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: soft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
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