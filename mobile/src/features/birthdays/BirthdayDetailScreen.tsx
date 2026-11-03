import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { ALLOWED_REACTIONS, BirthdayComment } from '../../services/birthdays';
import { useMe } from '../chat/chatSession';
import {
  useBirthdayPostQuery,
  useToggleReactionMutation,
  useToggleCommentLikeMutation,
  useAddCommentMutation,
  useDeleteCommentMutation,
} from './useBirthdays';

export default function BirthdayDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
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
      }
    );
  };

  if (firstLoad) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl }}>
        <Text style={[typography.body, { color: colors.error }]}>
          {(q.error as { message?: string })?.message ?? t('birthdays.notFound')}
        </Text>
      </View>
    );
  }

  const person = post.person;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        {showingSavedData && (
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,158,11,0.14)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)' }}>
              <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
              <Text style={[typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>
                {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
              </Text>
            </View>
          </View>
        )}

        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          {person.profilePhotoUrl ? (
            <Image source={{ uri: person.profilePhotoUrl }} style={{ width: 120, height: 120, borderRadius: 60 }} />
          ) : (
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={60} color={colors.textSecondary} />
            </View>
          )}
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>
            {person.fullName}
          </Text>
          <Text style={[typography.caption, { color: colors.primary, marginTop: spacing.xs }]}>
            🎂 {t('birthdays.happyBirthday')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg }}>
          {ALLOWED_REACTIONS.map((emoji) => {
            const isMine = post.myReaction === emoji;
            const count = post.reactions.find((r) => r.emoji === emoji)?.count ?? 0;
            return (
              <Pressable
                key={emoji}
                onPress={() => onToggleReaction(emoji)}
                disabled={busy}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  borderWidth: 2,
                  borderColor: isMine ? colors.primary : colors.border,
                  backgroundColor: isMine ? colors.surfaceAlt : colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
                {count > 0 && (
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{count}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Text style={[typography.h3, { color: colors.text }]}>{t('birthdays.comments')}</Text>
        </View>

        {post.comments.length === 0 && (
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {t('birthdays.noComments')}
          </Text>
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
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        {replyTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.xs }}>
            <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}>
              {t('birthdays.replyingTo')}{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{replyTo.name}</Text>
            </Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('birthdays.commentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text,
            }}
          />
          <Pressable
            onPress={onSubmitComment}
            disabled={busy || !commentText.trim()}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: busy || !commentText.trim() ? 0.5 : 1,
            }}
          >
            <Ionicons name="send" size={20} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// CommentBlock — hoisted to module scope
//
// Previously declared INSIDE BirthdayDetailScreen, which meant a new function
// reference was created on every render of that parent. React therefore
// treated each <CommentBlock key="..."> as a new component *type* every time
// the parent re-rendered (e.g. on each keystroke of the composer), tearing
// down and re-mounting the whole comment subtree: entrance/reply animations
// replayed, and the list scrolled back to the top mid-typing.
//
// Hoisting it fixes that: React now sees a stable component reference and
// re-renders the comments in place, preserving layout and any transient state.
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
  const { colors, spacing, radius, typography } = theme;
  const isMine = myUserId === comment.author.id;

  return (
    <View style={{ marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {comment.author.profilePhotoUrl ? (
          <Image source={{ uri: comment.author.profilePhotoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
        ) : (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt }} />
        )}
        <Text style={[typography.body, { color: colors.text, fontWeight: '600', marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
          {comment.author.fullName}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {new Date(comment.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <Text style={[typography.body, { color: colors.text, marginTop: spacing.sm, lineHeight: 20 }]}>
        {comment.text}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, alignItems: 'center' }}>
        <Pressable onPress={onLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons
            name={comment.likedByMe ? 'heart' : 'heart-outline'}
            size={16}
            color={comment.likedByMe ? '#E0245E' : colors.textSecondary}
          />
          {comment.likeCount > 0 && (
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{comment.likeCount}</Text>
          )}
        </Pressable>

        <Pressable onPress={onReply}>
          <Text style={[typography.caption, { color: colors.primary }]}>{t('birthdays.reply')}</Text>
        </Pressable>

        {isMine && (
          <Pressable onPress={onDelete}>
            <Text style={[typography.caption, { color: colors.error }]}>{t('birthdays.deleteComment')}</Text>
          </Pressable>
        )}
      </View>

      {comment.replies.map((r) => {
        const mine = myUserId === r.author.id;
        return (
          <View key={r.id} style={{ marginTop: spacing.md, marginLeft: spacing.xl, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {r.author.profilePhotoUrl ? (
                <Image source={{ uri: r.author.profilePhotoUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} />
              ) : (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceAlt }} />
              )}
              <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '600', marginLeft: spacing.sm, flex: 1 }]} numberOfLines={1}>
                {r.author.fullName}
              </Text>
            </View>
            <Text style={[typography.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 18 }]}>
              {r.text}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: 4, alignItems: 'center' }}>
              <Pressable onPress={() => onReplyLike(r.id, r.likedByMe)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons
                  name={r.likedByMe ? 'heart' : 'heart-outline'}
                  size={14}
                  color={r.likedByMe ? '#E0245E' : colors.textSecondary}
                />
                {r.likeCount > 0 && (
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{r.likeCount}</Text>
                )}
              </Pressable>
              {mine && (
                <Pressable onPress={() => onReplyDelete(r.id)}>
                  <Text style={[typography.caption, { color: colors.error }]}>{t('birthdays.deleteComment')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}