import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  RefreshControl,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { ALLOWED_REACTIONS, BirthdayComment } from '../../services/birthdays';
import { useMe } from '../chat/chatSession';
import { BRAND, AvatarRing, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  useBirthdayPostQuery,
  useToggleReactionMutation,
  useToggleCommentLikeMutation,
  useAddCommentMutation,
  useDeleteCommentMutation,
} from './useBirthdays';

const AMBER = '#F59E0B';
const HEART = '#E0245E';

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** "5m ago" / "3h ago" / "2d ago"; falls back to a date after a week. */
function timeAgo(iso: string | Date, t: (k: string, o?: any) => string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return new Date(iso).toLocaleDateString();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('home.justNow', { defaultValue: 'Just now' });
  if (m < 60) return t('home.minAgo', { count: m, defaultValue: '{{count}}m ago' });
  const h = Math.floor(m / 60);
  if (h < 24) return t('home.hrAgo', { count: h, defaultValue: '{{count}}h ago' });
  const d = Math.floor(h / 24);
  if (d < 7) return t('home.dayAgo', { count: d, defaultValue: '{{count}}d ago' });
  return new Date(iso).toLocaleDateString();
}

export default function BirthdayDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const { postId } = route.params;

  const me = useMe();
  const q = useBirthdayPostQuery(postId);
  const post = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const toggleReactionMut = useToggleReactionMutation();
  const toggleLikeMut = useToggleCommentLikeMutation();
  const addCommentMut = useAddCommentMutation();
  const deleteCommentMut = useDeleteCommentMutation();

  const busy =
    toggleReactionMut.isPending ||
    toggleLikeMut.isPending ||
    addCommentMut.isPending ||
    deleteCommentMut.isPending;

  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [commentText, setCommentText] = useState('');

  // We draw our own hero + back button, so hide the native header.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onToggleReaction = (emoji: string) => {
    if (!post) return;
    toggleReactionMut.mutate({
      postId: post.id,
      emoji,
      isMine: post.myReaction === emoji,
    });
  };

  const onToggleCommentLike = (commentId: string, liked: boolean) => {
    toggleLikeMut.mutate({ commentId, liked });
  };

  const onDeleteComment = (commentId: string) => {
    Alert.alert(t('birthdays.deleteComment'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('birthdays.deleteComment'),
        style: 'destructive',
        onPress: () => deleteCommentMut.mutate(commentId),
      },
    ]);
  };

  const onSubmitComment = () => {
    if (!post) return;
    const text = commentText.trim();
    if (!text) return;
    addCommentMut.mutate(
      { postId: post.id, text, parentId: replyTo?.id ?? null },
      {
        onSuccess: () => {
          setCommentText('');
          setReplyTo(null);
        },
      },
    );
  };

  // ---------- Loading ----------
  if (firstLoad) {
    return (
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ fontSize: 44 }}>🎂</Text>
        <ActivityIndicator size="large" color={BRAND.gold} style={{ marginTop: spacing.lg }} />
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </LinearGradient>
    );
  }

  // ---------- Not found / error ----------
  if (!post) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
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
          <Ionicons name="gift-outline" size={32} color={colors.error} />
        </View>
        <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
          {(q.error as { message?: string })?.message ?? t('birthdays.notFound')}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const person = post.person;
  const initial = person.fullName.trim().charAt(0).toUpperCase();
  const totalReactions = post.reactions.reduce((n, r) => n + r.count, 0);
  const totalComments = post.comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  const canSend = !busy && commentText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
          />
        }
      >
        {/* ================= HERO ================= */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: 32,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
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
              backgroundColor: withAlpha(BRAND.gold, 0.2),
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
          <Confetti />

          <View pointerEvents="box-none" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
            <GlassBackButton
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            />
          </View>

          <AvatarRing
            size={136}
            uri={person.profilePhotoUrl ?? null}
            gapColor={BRAND.deep}
            fallback={
              <Text style={{ fontSize: 52, fontWeight: '800', color: BRAND.gold }}>{initial}</Text>
            }
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 16,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: BRAND.gold,
            }}
          >
            <Text style={{ fontSize: 14 }}>🎂</Text>
            <Text style={{ color: BRAND.deep, fontSize: 12.5, fontWeight: '800' }}>
              {t('birthdays.happyBirthday')}
            </Text>
          </View>

          <Text
            style={[
              typography.h1,
              { color: '#FFFFFF', marginTop: 10, textAlign: 'center', fontWeight: '800' },
            ]}
          >
            {person.fullName}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <StatChip icon="happy" value={totalReactions} />
            <StatChip icon="chatbubble-ellipses" value={totalComments} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {showingSavedData && (
            <View
              accessibilityRole="text"
              style={{
                marginTop: spacing.md,
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: withAlpha(AMBER, 0.14),
                borderWidth: 1,
                borderColor: withAlpha(AMBER, 0.4),
              }}
            >
              <Ionicons name="cloud-offline" size={13} color={AMBER} />
              <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
                {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
              </Text>
            </View>
          )}

          {/* ================= REACTIONS ================= */}
          <View
            style={{
              marginTop: spacing.xl,
              padding: spacing.md,
              borderRadius: 26,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.sm,
                justifyContent: 'center',
              }}
            >
              {ALLOWED_REACTIONS.map((emoji) => {
                const isMine = post.myReaction === emoji;
                const count = post.reactions.find((r) => r.emoji === emoji)?.count ?? 0;
                return (
                  <ReactionPill
                    key={emoji}
                    emoji={emoji}
                    count={count}
                    mine={isMine}
                    disabled={busy}
                    onPress={() => onToggleReaction(emoji)}
                  />
                );
              })}
            </View>
          </View>

          {/* ================= COMMENTS ================= */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
              marginTop: spacing.xl,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 11,
                backgroundColor: withAlpha(BRAND.violet, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chatbubbles" size={16} color={BRAND.violet} />
            </View>
            <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>
              {t('birthdays.comments')}
            </Text>
            {totalComments > 0 && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: withAlpha(BRAND.violet, 0.14),
                }}
              >
                <Text style={{ color: BRAND.violet, fontSize: 12, fontWeight: '800' }}>
                  {totalComments}
                </Text>
              </View>
            )}
          </View>

          {post.comments.length === 0 && (
            <View
              style={{
                marginTop: spacing.md,
                alignItems: 'center',
                padding: spacing.xl,
                borderRadius: 24,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.border,
                gap: spacing.sm,
              }}
            >
              <Text style={{ fontSize: 34 }}>🎈</Text>
              <Text
                style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}
              >
                {t('birthdays.noComments')}
              </Text>
            </View>
          )}

          {post.comments.map((c) => (
            <CommentBlock
              key={c.id}
              comment={c}
              myUserId={me?.id ?? null}
              onLike={() => onToggleCommentLike(c.id, c.likedByMe)}
              onReply={() => setReplyTo({ id: c.id, name: c.author.fullName })}
              onDelete={() => onDeleteComment(c.id)}
              onReplyLike={(replyId, liked) => onToggleCommentLike(replyId, liked)}
              onReplyDelete={(replyId) => onDeleteComment(replyId)}
            />
          ))}
        </View>
      </ScrollView>

      {/* ================= COMPOSER ================= */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        }}
      >
        {replyTo && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginBottom: spacing.sm,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 14,
              backgroundColor: withAlpha(BRAND.violet, 0.12),
              borderLeftWidth: 3,
              borderLeftColor: BRAND.violet,
            }}
          >
            <Ionicons name="return-down-forward" size={15} color={BRAND.violet} />
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('birthdays.replyingTo')}{' '}
              <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{replyTo.name}</Text>
            </Text>
            <Pressable
              onPress={() => setReplyTo(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close-circle" size={19} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('birthdays.commentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              maxHeight: 110,
              minHeight: 46,
              backgroundColor: colors.background,
              borderColor: commentText ? BRAND.violet : colors.border,
              borderWidth: 1.5,
              borderRadius: 23,
              paddingHorizontal: spacing.lg,
              paddingTop: Platform.OS === 'ios' ? 13 : 10,
              paddingBottom: Platform.OS === 'ios' ? 13 : 10,
              color: colors.text,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={onSubmitComment}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('birthdays.send', { defaultValue: 'Send' })}
            style={{ opacity: canSend ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={canSend ? [BRAND.violet, BRAND.magenta] : [colors.border, colors.border]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {addCommentMut.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={19} color="#FFFFFF" style={{ marginLeft: 2 }} />
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Hero pieces
// ---------------------------------------------------------------------------

function StatChip({
  icon,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.26)',
      }}
    >
      <Ionicons name={icon} size={13} color={BRAND.gold} />
      <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

/** Falling confetti in the hero. Pure Animated, respects reduce-motion. */
const CONFETTI = [
  { x: 0.05, c: BRAND.gold, d: 3600, l: 0 },
  { x: 0.15, c: '#FFFFFF', d: 4400, l: 700 },
  { x: 0.26, c: BRAND.water, d: 3900, l: 1400 },
  { x: 0.37, c: BRAND.gold, d: 4700, l: 300 },
  { x: 0.5, c: BRAND.magenta, d: 3700, l: 1800 },
  { x: 0.61, c: '#FFFFFF', d: 4200, l: 900 },
  { x: 0.72, c: BRAND.gold, d: 4500, l: 200 },
  { x: 0.83, c: BRAND.water, d: 3800, l: 1200 },
  { x: 0.93, c: BRAND.gold, d: 4300, l: 500 },
];

function ConfettiPiece({
  x,
  c,
  d,
  l,
  w,
  h,
}: (typeof CONFETTI)[number] & { w: number; h: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(l),
        Animated.timing(v, {
          toValue: 1,
          duration: d,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, d, l]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * w,
        top: -14,
        width: 7,
        height: 11,
        borderRadius: 2,
        backgroundColor: c,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.9, 0.9, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, h + 16] }) },
          {
            translateX: v.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0, 9, 0, -9, 0],
            }),
          },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
        ],
      }}
    />
  );
}

function Confetti() {
  const reduce = useReduceMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  if (reduce) return null;
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {size.w > 0 &&
        CONFETTI.map((p, i) => <ConfettiPiece key={i} {...p} w={size.w} h={size.h} />)}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reaction pill — springs when you toggle it
// ---------------------------------------------------------------------------

function ReactionPill({
  emoji,
  count,
  mine,
  disabled,
  onPress,
}: {
  emoji: string;
  count: number;
  mine: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  // Bounce when this reaction becomes "mine".
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!mine) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 120, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [mine, scale]);

  const press = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => press(0.92)}
        onPressOut={() => press(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected: mine, disabled }}
        accessibilityLabel={`${emoji} ${count}`}
        style={{
          minWidth: 58,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: mine ? BRAND.violet : colors.border,
          backgroundColor: mine ? withAlpha(BRAND.violet, 0.14) : colors.background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        {count > 0 && (
          <Text
            style={[
              typography.caption,
              { color: mine ? BRAND.violet : colors.text, fontWeight: '800' },
            ]}
          >
            {count}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Heart — pops when liked
// ---------------------------------------------------------------------------

function HeartButton({
  liked,
  count,
  size,
  onPress,
}: {
  liked: boolean;
  count: number;
  size: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!liked) return;
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.4, duration: 110, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [liked, pop]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? HEART : colors.textSecondary}
        />
      </Animated.View>
      {count > 0 && (
        <Text
          style={[
            typography.caption,
            { color: liked ? HEART : colors.textSecondary, fontWeight: liked ? '800' : '600' },
          ]}
        >
          {count}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Avatar with gradient initial fallback
// ---------------------------------------------------------------------------

function Avatar({
  uri,
  name,
  size,
}: {
  uri?: string | null;
  name: string;
  size: number;
}) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <LinearGradient
      colors={[BRAND.violet, BRAND.magenta]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.44, fontWeight: '800' }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// CommentBlock — hoisted to module scope
//
// Declared at module level (NOT inside BirthdayDetailScreen) so React sees a
// stable component type. Declaring it inside the screen re-created it on every
// keystroke of the composer, remounting the whole comment list.
// ---------------------------------------------------------------------------

function CommentBlock({
  comment,
  myUserId,
  onLike,
  onReply,
  onDelete,
  onReplyLike,
  onReplyDelete,
}: {
  comment: BirthdayComment;
  myUserId: string | null;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
  onReplyLike: (replyId: string, liked: boolean) => void;
  onReplyDelete: (replyId: string) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const isMine = myUserId === comment.author.id;

  return (
    <View
      style={{
        marginTop: spacing.md,
        padding: spacing.md,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: isMine ? withAlpha(BRAND.violet, 0.45) : colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={comment.author.profilePhotoUrl} name={comment.author.fullName} size={36} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={[typography.body, { color: colors.text, fontWeight: '800', flexShrink: 1 }]}
              numberOfLines={1}
            >
              {comment.author.fullName}
            </Text>
            {isMine && (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 1.5,
                  borderRadius: 8,
                  backgroundColor: withAlpha(BRAND.violet, 0.14),
                }}
              >
                <Text style={{ color: BRAND.violet, fontSize: 10, fontWeight: '800' }}>
                  {t('birthdays.you', { defaultValue: 'You' })}
                </Text>
              </View>
            )}
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {timeAgo(comment.createdAt, t)}
          </Text>
        </View>
      </View>

      <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm, lineHeight: 21 }]}>
        {comment.text}
      </Text>

      <View
        style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, alignItems: 'center' }}
      >
        <HeartButton liked={comment.likedByMe} count={comment.likeCount} size={18} onPress={onLike} />

        <Pressable
          onPress={onReply}
          hitSlop={8}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="return-down-forward" size={15} color={BRAND.violet} />
          <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>
            {t('birthdays.reply')}
          </Text>
        </Pressable>

        {isMine && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
          >
            <Ionicons name="trash-outline" size={15} color={colors.error} />
            <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>
              {t('birthdays.deleteComment')}
            </Text>
          </Pressable>
        )}
      </View>

      {comment.replies.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          {comment.replies.map((r) => {
            const mine = myUserId === r.author.id;
            return (
              <View
                key={r.id}
                style={{
                  marginTop: spacing.sm,
                  marginLeft: spacing.lg,
                  padding: spacing.sm + 2,
                  borderRadius: 16,
                  backgroundColor: colors.background,
                  borderLeftWidth: 3,
                  borderLeftColor: BRAND.violet,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Avatar uri={r.author.profilePhotoUrl} name={r.author.fullName} size={26} />
                  <Text
                    style={[typography.bodySmall, { color: colors.text, fontWeight: '800', flex: 1 }]}
                    numberOfLines={1}
                  >
                    {r.author.fullName}
                  </Text>
                  {mine && (
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 1.5,
                        borderRadius: 8,
                        backgroundColor: withAlpha(BRAND.violet, 0.14),
                      }}
                    >
                      <Text style={{ color: BRAND.violet, fontSize: 10, fontWeight: '800' }}>
                        {t('birthdays.you', { defaultValue: 'You' })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[typography.bodySmall, { color: colors.text, marginTop: 6, lineHeight: 19 }]}
                >
                  {r.text}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.lg,
                    marginTop: spacing.sm,
                    alignItems: 'center',
                  }}
                >
                  <HeartButton
                    liked={r.likedByMe}
                    count={r.likeCount}
                    size={16}
                    onPress={() => onReplyLike(r.id, r.likedByMe)}
                  />
                  {mine && (
                    <Pressable
                      onPress={() => onReplyDelete(r.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                      <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>
                        {t('birthdays.deleteComment')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}