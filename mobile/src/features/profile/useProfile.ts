import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOwnProfile,
  updateOwnProfile,
  uploadOwnPhoto,
  type UpdateProfileInput,
} from '../../services/members';
import {
  getPreferences,
  updatePreferences,
  type PreferenceUpdate,
} from '../../services/notifications';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useOwnProfileQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.ownProfile(userId),
    queryFn: getOwnProfile,
  });
}

export function useNotificationPrefsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.notificationPrefs(userId),
    queryFn: getPreferences,
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate on success, no optimistic updates
// ---------------------------------------------------------------------------

export function useUpdateOwnProfileMutation() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateOwnProfile(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId ?? 'anon'] });
    },
  });
}

export function useUploadProfilePhotoMutation() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uri: string) => uploadOwnPhoto(uri),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId ?? 'anon'] });
    },
  });
}

export function useUpdateNotificationPrefsMutation() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferenceUpdate) => updatePreferences(input),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.notificationPrefs(userId),
      });
    },
  });
}