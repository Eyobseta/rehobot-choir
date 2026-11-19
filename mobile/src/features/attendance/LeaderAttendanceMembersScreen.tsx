import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { DirectoryMember } from '../../services/members';
import { BRAND, ErrorBanner } from '../auth/Auth_UI';
import { useDirectoryQuery } from '../directory/useDirectory';
import {
  Avatar,
  EmptyState,
  SavedPill,
  ScaleTap,
  ScreenHero,
  SkeletonRows,
} from './Attendance_Kit';

// Flat avatar tints, cycled by row index.
const AVATAR_TINTS = [BRAND.lavender, BRAND.mint, BRAND.lime, BRAND.lavenderSoft] as const;

export default function LeaderAttendanceMembersScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useDirectoryQuery(debounced);
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero with search */}
      <ScreenHero
        icon="people"
        overline={t('attendance.title', { defaultValue: 'Attendance' })}
        title={t('attendance.memberPicker', { defaultValue: 'Pick a member' })}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back', { defaultValue: 'Back' })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 50,
            paddingHorizontal: 14,
            borderRadius: 18,
            borderWidth: 1.5,
            marginTop: 16,
            borderColor: focused ? BRAND.lime : 'rgba(255,255,255,0.18)',
            backgroundColor: BRAND.tealDark,
          }}
        >
          <Ionicons
            name="search"
            size={18}
            color={focused ? BRAND.lime : 'rgba(255,255,255,0.85)'}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('attendance.searchMember')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="words"
            selectionColor={BRAND.lime}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={t('attendance.searchMember')}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 11 }}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel', { defaultValue: 'Cancel' })}
            >
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
      </ScreenHero>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <SavedPill text={t('home.showingSavedData', { defaultValue: 'Showing saved data' })} />
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner
            message={(q.error as { message?: string })?.message ?? 'Something went wrong.'}
          />
        </View>
      )}

      {firstLoad ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonRows count={7} height={72} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          ListEmptyComponent={
            <EmptyState
              icon="person-outline"
              text={t('directory.empty', { defaultValue: 'No members found.' })}
            />
          }
          renderItem={({ item, index }) => (
            <MemberCard
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate('MemberAttendanceGrid', {
                  memberId: item.id,
                  memberName: item.fullName,
                })
              }
              chevronLabel={t('attendance.viewMembersGrid', {
                defaultValue: 'Member history',
              })}
            />
          )}
        />
      )}
    </View>
  );
}

function MemberCard({
  item,
  index,
  onPress,
  chevronLabel,
}: {
  item: DirectoryMember;
  index: number;
  onPress: () => void;
  chevronLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const tint = AVATAR_TINTS[index % AVATAR_TINTS.length];

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  return (
    <Animated.View
      style={{
        marginBottom: 10,
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [22, 0],
            }),
          },
        ],
      }}
    >
      <ScaleTap
        onPress={onPress}
        to={0.98}
        accessibilityLabel={`${item.fullName}, ${chevronLabel}`}
        pressableStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 72,
          padding: 12,
          borderRadius: 20,
          borderWidth: 1,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        <Avatar
          uri={item.profilePhotoUrl}
          name={item.fullName}
          tone={tint}
          ink={BRAND.teal}
          size={48}
        />

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.fullName}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {chevronLabel}
          </Text>
        </View>

        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </View>
      </ScaleTap>
    </Animated.View>
  );
}