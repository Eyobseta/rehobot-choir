import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { HelpDeepLinkKey } from './helpTypes';

type RootNavRef = NavigationContainerRefWithCurrent<any>;

/**
 * Semantic key → React Navigation call.
 *
 * Uses the same "loose" navigate pattern as `services/pushNavigation.ts`
 * (which also calls `nav.navigate('Home', { screen: '...', params: ... })`
 * on a `NavigationContainerRefWithCurrent<any>`). The `as never` casts are
 * gone — they broke overload resolution by turning each argument tuple into
 * `[never, never]`, which no overload accepts.
 */
export function resolveDeepLink(
  nav: RootNavRef | null | undefined,
  key: HelpDeepLinkKey | null | undefined,
): boolean {
  if (!nav || !key || !nav.isReady()) return false;
  try {
    switch (key) {
      case 'HOME':
        nav.navigate('Home');
        return true;
      case 'SONGS':
        nav.navigate('Songs');
        return true;
      case 'MEMORIES':
        nav.navigate('Memories');
        return true;
      case 'CHAT':
        nav.navigate('Chat');
        return true;
      case 'PROFILE':
        nav.navigate('Profile', { screen: 'ProfileHome' });
        return true;
      case 'FUNDING':
        nav.navigate('Profile', { screen: 'Funding' });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}