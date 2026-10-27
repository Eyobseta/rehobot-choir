import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  lookupMember,
  resetMemberPassword,
  deleteMember,
  appointMember,
  MemberLookup,
} from '../../services/leaderMembers';
import { ApiError } from '../../services/api';
import { AuthField, BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

export default function ManageMemberScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<MemberLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- NEW: State for custom reset password modal ---
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const onLookup = async () => {
    setError(null);
    setMember(null);
    setBusy(true);
    try {
      const m = await lookupMember(phone.trim());
      setMember(m);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  // --- UPDATED: Reset Password Action ---
  const confirmReset = async () => {
    if (!member) return;
    if (newPassword.trim().length < 8) {
      return setError(t('register.passwordTooShort', { defaultValue: 'Password must be at least 8 characters.' }));
    }

    setBusy(true);
    setError(null);
    try {
      await resetMemberPassword(member.id, newPassword.trim());
      
      setResetOpen(false);
      setNewPassword('');
      
      Alert.alert(
        t('leaderTools.resetPasswordSuccessTitle', { defaultValue: 'Password reset' }),
        t('leaderTools.resetPasswordSuccess', {
          pwd: newPassword.trim(),
          defaultValue: `Temporary password: ${newPassword.trim()}`,
        }),
      );
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!member) return;
    if (!deletePassword) return setError(t('register.fieldRequired'));
    setBusy(true);
    setError(null);
    try {
      await deleteMember(member.id, deletePassword);
      setDeleteOpen(false);
      setDeletePassword('');
      setMember(null);
      Alert.alert(t('leaderTools.delete'), t('leaderTools.deleteSuccess'));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <View pointerEvents="none" style={[styles.blob, { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.22) }]} />
          <View pointerEvents="none" style={[styles.blob, { bottom: -80, left: -50, backgroundColor: withAlpha(BRAND.water, 0.22) }]} />

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="person-circle" size={22} color={BRAND.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>{t('leaderTools.manageMember')}</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>{t('leaderTools.lookupTitle')}</Text>
            </View>
            <GlassBackButton onPress={() => navigation.goBack()} size={44} />
          </View>

          <Text style={styles.heroSubtitle}>{t('leaderTools.lookupSubtitle')}</Text>

          <View style={styles.searchWrap}>
            <Ionicons name="call" size={18} color="rgba(255,255,255,0.85)" />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('register.phone')}
              placeholderTextColor="rgba(255,255,255,0.65)"
              keyboardType="phone-pad"
              returnKeyType="search"
              onSubmitEditing={onLookup}
              style={styles.searchInput}
              selectionColor={BRAND.gold}
            />
            {phone.length > 0 && (
              <Pressable onPress={() => setPhone('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
              </Pressable>
            )}
          </View>

          <Pressable onPress={onLookup} disabled={busy} style={[styles.lookupBtn, { opacity: busy ? 0.7 : 1 }]}>
            <LinearGradient colors={[BRAND.gold, '#FFA94D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.lookupBtnInner}>
              {busy ? <ActivityIndicator color={BRAND.deep} /> : (
                <>
                  <Ionicons name="search" size={18} color={BRAND.deep} />
                  <Text style={styles.lookupText}>{t('leaderTools.lookup')}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </LinearGradient>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: withAlpha(colors.error, 0.12), borderColor: withAlpha(colors.error, 0.4) }]}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[typography.bodySmall, { color: colors.error, flex: 1, fontWeight: '700' }]}>{error}</Text>
          </View>
        )}

        {/* Member Card */}
        {member && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.memberBorder}>
              <View style={[styles.memberCard, { backgroundColor: colors.surface }]}>
                <View style={styles.memberHeader}>
                  {member.profilePhotoUrl ? (
                    <Image source={{ uri: member.profilePhotoUrl }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, { backgroundColor: withAlpha(BRAND.violet, 0.16), alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: BRAND.violet, fontSize: 22, fontWeight: '800' }}>
                        {(member.fullName ?? member.phone).trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ marginLeft: spacing.md, flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]}>{member.fullName ?? '—'}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{member.phone}</Text>
                    <View style={styles.roleRow}>
                      <View style={[styles.rolePill, { backgroundColor: withAlpha(BRAND.violet, 0.14) }]}>
                        <Ionicons name="ribbon" size={11} color={BRAND.violet} />
                        <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>{member.role}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {member.mustChangePassword && (
                  <View style={[styles.warnRow, { backgroundColor: withAlpha('#F59E0B', 0.12), borderColor: withAlpha('#F59E0B', 0.4) }]}>
                    <Ionicons name="warning" size={14} color="#F59E0B" />
                    <Text style={[typography.caption, { color: '#F59E0B', flex: 1, fontWeight: '700' }]}>{t('password.banner')}</Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                  <AnimatedButton
                    onPress={() => {
                      setNewPassword('');
                      setShowPassword(false);
                      setResetOpen(true);
                    }}
                    disabled={busy}
                    colors={[BRAND.violet, BRAND.magenta]}
                    icon="key"
                    label={t('leaderTools.resetPassword')}
                  />
                  <AnimatedButton
                    onPress={() => setDeleteOpen(true)}
                    disabled={busy}
                    colors={['#C0262D', '#E0405A']}
                    icon="trash"
                    label={t('leaderTools.delete')}
                  />
                </View>

                {member.role === 'MEMBER' && (
                  <AnimatedButton
                    onPress={() =>
                      Alert.alert(
                        t('leaderTools.appointTitle'),
                        t('leaderTools.appointBody', { name: member.fullName ?? member.phone }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('leaderTools.appointYes'),
                            onPress: async () => {
                              setBusy(true);
                              try {
                                await appointMember(member.id);
                                Alert.alert(t('leaderTools.appointSuccessTitle'), t('leaderTools.appointSuccessBody', { name: member.fullName ?? member.phone }));
                                setMember({ ...member, role: 'LEADER' });
                              } catch (e) {
                                setError(`${(e as ApiError).message}`);
                              } finally {
                                setBusy(false);
                              }
                            },
                          },
                        ],
                      )
                    }
                    disabled={busy}
                    colors={[BRAND.gold, '#FFA94D']}
                    icon="ribbon"
                    label={t('leaderTools.appoint')}
                  />
                )}
              </View>
            </LinearGradient>
          </View>
        )}

        {!member && !error && (
          <View style={{ padding: spacing.xl, alignItems: 'center', marginTop: spacing.lg }}>
            <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyRing}>
              <View style={[styles.emptyInner, { backgroundColor: colors.background }]}>
                <Ionicons name="person-outline" size={36} color={colors.textSecondary} />
              </View>
            </LinearGradient>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' }]}>{t('leaderTools.lookupSubtitle')}</Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- RESET PASSWORD MODAL ---------- */}
      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.sheetIcon, { backgroundColor: withAlpha(BRAND.violet, 0.16) }]}>
                <Ionicons name="key" size={26} color={BRAND.violet} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: 12, fontWeight: '800' }]}>
                {t('leaderTools.resetPassword')}
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Type a temporary password for {member?.fullName ?? member?.phone}. They will be asked to change it after logging in.
              </Text>

              <View style={{ marginTop: spacing.lg }}>
                <AuthField
                  label="Temporary Password"
                  iconNode={<Ionicons name="lock-closed" size={16} color={BRAND.violet} />}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={confirmReset}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                  <Text style={{ color: BRAND.violet, fontSize: 12, fontWeight: '700' }}>
                    {showPassword ? 'Hide password' : 'Show password'}
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
                <Pressable onPress={() => setResetOpen(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[typography.button, { color: colors.text }]}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable onPress={confirmReset} disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
                  <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dangerBtn}>
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 }]}>Reset</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- DELETE MODAL ---------- */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.sheetIcon, { backgroundColor: withAlpha(colors.error, 0.16) }]}>
                <Ionicons name="trash" size={26} color={colors.error} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: 12, fontWeight: '800' }]}>{t('leaderTools.deleteConfirmTitle')}</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                {t('leaderTools.deleteConfirmBody', { name: member?.fullName ?? member?.phone ?? '' })}
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <AuthField
                  label={t('leaderTools.deleteConfirmLabel')}
                  iconNode={<Ionicons name="lock-closed" size={16} color={colors.error} />}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Pressable onPress={() => { setDeleteOpen(false); setDeletePassword(''); }} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[typography.button, { color: colors.text }]}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable onPress={confirmDelete} disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
                  <LinearGradient colors={['#C0262D', '#E0405A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.dangerBtn}>
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="trash" size={16} color="#FFFFFF" />
                        <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800', marginLeft: 6 }]}>{t('leaderTools.delete')}</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function AnimatedButton({ onPress, disabled, colors, icon, label }: any) {
  const { theme } = useTheme();
  const { typography } = theme;
  const scale = React.useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)} disabled={disabled} style={{ opacity: disabled ? 0.6 : 1 }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <Ionicons name={icon} size={16} color="#FFFFFF" />
          <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '800', marginLeft: 6, flexShrink: 1 }]} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  heroSubtitle: { marginTop: 12, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 14 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 },
  lookupBtn: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  lookupBtnInner: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  lookupText: { color: BRAND.deep, fontWeight: '800', fontSize: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, borderRadius: 14, borderWidth: 1 },
  memberBorder: { borderRadius: 24, padding: 2 },
  memberCard: { borderRadius: 22, padding: 16 },
  memberHeader: { flexDirection: 'row', alignItems: 'center' },
  memberAvatar: { width: 56, height: 56, borderRadius: 28 },
  roleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 12, borderWidth: 1 },
  actionBtn: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  emptyRing: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 28, padding: 22 },
  sheetIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});