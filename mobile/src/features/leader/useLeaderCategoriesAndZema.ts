import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCategories,
  leaderCreateCategory,
  leaderRenameCategory,
  leaderDeleteCategory,
  leaderListZemaMembers,
  leaderAddZemaMember,
  leaderRemoveZemaMember,
} from '../../services/songs';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Category list for the leader editor. Deliberately uses the SAME query key as
 * `useSongCategoriesQuery` (member Songs screen) so both views share one cache
 * entry — renaming a category here updates the chip row in Songs instantly, and
 * vice versa.
 */
export function useLeaderCategoriesQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.songCategories(userId),
    queryFn: listCategories,
  });
}

/**
 * Category names are denormalised inside Song responses
 * (`category: { id, name }`), so a rename / delete MUST refresh both trees:
 *   - ['songs', userId]                → member Songs list / detail / favorites
 *   - ['leader', userId, 'songs']      → LeaderSongs list + song review queue
 */
function useInvalidateCategoryData() {
  const userId = useUserId();
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['songs', userId ?? 'anon'] }),
      qc.invalidateQueries({ queryKey: ['leader', userId ?? 'anon', 'songs'] }),
    ]);
  };
}

export function useCreateCategoryMutation() {
  const invalidate = useInvalidateCategoryData();
  return useMutation({
    mutationFn: (name: string) => leaderCreateCategory(name),
    onSuccess: () => invalidate(),
  });
}

export function useRenameCategoryMutation() {
  const invalidate = useInvalidateCategoryData();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      leaderRenameCategory(v.id, v.name),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteCategoryMutation() {
  const invalidate = useInvalidateCategoryData();
  return useMutation({
    mutationFn: (id: string) => leaderDeleteCategory(id),
    onSuccess: () => invalidate(),
  });
}

// ---------------------------------------------------------------------------
// Zema team
// ---------------------------------------------------------------------------

const zemaKey = (userId: string | null) =>
  ['leader', userId ?? 'anon', 'zema'] as const;

export function useZemaMembersQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...zemaKey(userId), 'list'],
    queryFn: leaderListZemaMembers,
  });
}

function useInvalidateZema() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: zemaKey(userId) });
}

export function useAddZemaMemberMutation() {
  const invalidate = useInvalidateZema();
  return useMutation({
    mutationFn: (userId: string) => leaderAddZemaMember(userId),
    onSuccess: () => invalidate(),
  });
}

export function useRemoveZemaMemberMutation() {
  const invalidate = useInvalidateZema();
  return useMutation({
    mutationFn: (userId: string) => leaderRemoveZemaMember(userId),
    onSuccess: () => invalidate(),
  });
}