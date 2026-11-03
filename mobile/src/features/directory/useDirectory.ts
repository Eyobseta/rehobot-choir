import { useQuery } from '@tanstack/react-query';
import { getMember, listMembers } from '../../services/members';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

/**
 * Directory list. Search is debounced by the caller; each distinct search
 * string gets its own cache entry under `['directory', userId, 'list', q]`.
 */
export function useDirectoryQuery(search: string) {
  const userId = useUserId();
  const q = search.trim();
  return useQuery({
    queryKey: queryKeys.directory(userId, q),
    queryFn: () => listMembers(q || undefined),
  });
}

/**
 * Individual member detail. Cached per member id.
 */
export function useMemberQuery(memberId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.member(userId, memberId),
    queryFn: () => getMember(memberId),
  });
}