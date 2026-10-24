export type ChatMessageType = 'TEXT' | 'PHOTO' | 'VOICE';
export type ConversationType = 'DIRECT' | 'GENERAL' | 'GROUP';
export type UserRoleName = 'MEMBER' | 'LEADER' | 'ADMIN';

export type MediaItem = {
  id: string;
  type: 'PHOTO' | 'VOICE';
  storageUrl: string;
  durationSeconds: number | null;
};

export type Reaction = { emoji: string; userId: string };

export type ReplyPreview = {
  id: string;
  type: ChatMessageType;
  text: string | null;
  deleted: boolean;
  sender: { id: string; fullName: string };
};

export type LocalPhoto = { uri: string; name: string; type: string };
export type LocalVoice = {
  uri: string;
  name: string;
  type: string;
  durationSeconds: number;
};

export type Draft = {
  text: string;
  replyToId: string | null;
  photos: LocalPhoto[];
  voice: LocalVoice | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  clientId: string | null;
  type: ChatMessageType;
  text: string | null;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  sender: { id: string; fullName: string; profilePhotoUrl: string | null };
  media: MediaItem[];
  mediaExpired: boolean;
  replyTo: ReplyPreview | null;
  reactions: Reaction[];
  pinned: boolean;
  /** Local-only (optimistic sends). */
  _status?: 'sending' | 'failed';
  _draft?: Draft;
};

export type LastMessage = {
  id: string;
  type: ChatMessageType;
  text: string | null;
  deleted: boolean;
  senderId: string;
  senderName: string;
  createdAt: string;
};

export type ConversationListItem = {
  id: string;
  type: ConversationType;
  title: string;
  photoUrl: string | null;
  readOnly: boolean;
  otherUserId: string | null;
  online: boolean | null;
  lastActiveAt: string | null;
  memberCount: number;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage: LastMessage | null;
  group: {
    id: string;
    name: string;
    photoUrl: string | null;
    managerId: string;
  } | null;
};

export type MemberInfo = {
  userId: string;
  role: UserRoleName;
  fullName: string;
  profilePhotoUrl: string | null;
  lastActiveAt: string | null;
  online: boolean;
};

export type ConversationDetail = {
  id: string;
  type: ConversationType;
  title: string;
  readOnly: boolean;
  group: {
    id: string;
    name: string;
    photoUrl: string | null;
    managerId: string;
    createdByUserId: string | null;
  } | null;
  members: MemberInfo[];
  readStates: { userId: string; lastReadAt: string }[];
  pinned: ChatMessage[];
};

export type MessagePage = {
  items: ChatMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  /** Server clock when the page was read; used as the "last synced" mark. */
  serverTime?: string;
};

export type ChangesPage = {
  items: ChatMessage[];
  truncated: boolean;
  serverTime: string;
};

export type ReportItem = {
  messageId: string;
  conversationId: string;
  conversationType: ConversationType;
  conversationTitle: string;
  message: ChatMessage;
  reportCount: number;
  reporters: string[];
  firstReportedAt: string;
};
