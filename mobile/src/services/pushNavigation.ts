import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

/**
 * Shape of the `data` payload attached to a push by the backend.
 * Accepts both `entityType/entityId` (used by fanOut in the backend)
 * and `relatedEntityType/relatedEntityId` (used by some older notifications).
 */
export type PushPayload = {
  entityType?: string | null;
  entityId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

type RootNavRef = NavigationContainerRefWithCurrent<any>;

/**
 * Navigate to the entity described by a push payload, using the app-level
 * navigation ref. Returns true if a route was navigated to.
 *
 * Called from two places:
 *  - App.tsx: the global `addNotificationResponseReceivedListener` (push taps
 *    received while any screen is mounted, or buffered from cold start).
 *  - (future) any other root-level handler.
 *
 * NotificationsScreen keeps its own `navigateToEntity` (which uses the
 * screen's local navigation so it can check `routeNames` for the current
 * stack) for in-app row taps.
 */
export function navigateFromRoot(
  nav: RootNavRef,
  data: PushPayload | null | undefined,
): boolean {
  if (!data) return false;
  if (!nav.isReady()) return false;

  const entityType = data.relatedEntityType ?? data.entityType ?? null;
  const entityId = data.relatedEntityId ?? data.entityId ?? null;
  if (!entityType) return false;

  switch (entityType) {
    case 'Announcement':
      if (entityId) {
        nav.navigate('Home', { screen: 'AnnouncementDetail', params: { id: entityId } });
        return true;
      }
      break;

    case 'Song':
      if (entityId) {
        nav.navigate('Songs', { screen: 'SongDetail', params: { id: entityId } });
        return true;
      }
      break;

    case 'Memory':
      if (entityId) {
        nav.navigate('Memories', { screen: 'MemoryDetail', params: { id: entityId } });
        return true;
      }
      break;

    case 'Event':
      if (entityId) {
        nav.navigate('Home', { screen: 'EventDetail', params: { id: entityId } });
        return true;
      }
      break;

    case 'DailyQuote':
      nav.navigate('Home', { screen: 'DailyQuoteHistory' });
      return true;

    case 'ChatConversation':
      if (entityId) {
        nav.navigate('Chat', { screen: 'Conversation', params: { conversationId: entityId } });
        return true;
      }
      break;

    case 'AnnualContributionRecord':
    case 'SpecialDonationPayment':
    case 'SpecialDonationCampaign':
      nav.navigate('Profile', { screen: 'Funding' });
      return true;

    case 'BirthdayPost':
      if (entityId) {
        nav.navigate('Home', { screen: 'BirthdayDetail', params: { postId: entityId } });
        return true;
      }
      break;

    case 'LeadershipHistory':
      return false;

    default:
      return false;
  }

  return false;
}