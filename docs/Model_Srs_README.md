# REHOBOT CHOIR MOBILE APP
## DATA MODEL — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Version:** 1.1 (Added Service Assignments & Reassignment Requests)  
**Currency:** Ethiopian Birr (ETB)  
**User-facing calendar:** Ethiopian Calendar  

---

## DOCUMENT STATUS
**Final v1.1** — verified directly against `schema.prisma`.
**Authority:** This document describes the physical data model, enums, relations, constraints, and retention policies.

---

## ARCHITECTURAL PRINCIPLES (CRITICAL FOR BACKEND IMPLEMENTATION)

1. **DATE POLICY (Dual Storage):**
   - Ethiopian Calendar (E.C.) is the source of truth for user-facing dates.
   - Stored as three separate integers: `*EthYear`, `*EthMonth`, `*EthDay`.
   - A derived Gregorian date (`@db.Date`) is stored in `*Gregorian` columns **STRICTLY** for sorting, filtering, and unique index constraints. 
   - No timezone shifts: E.C. dates are computed at UTC midnight.
2. **MONEY POLICY:**
   - Stored as integers in minor units (santim). 1 ETB = 100 santim.
   - Named with the `*Minor` suffix (e.g., `amountDueMinor`).
   - **NEVER** use Float or Decimal types.
3. **IDENTIFIERS:**
   - Primary keys are Strings using `@default(cuid())`.
4. **CONCURRENCY & IDEMPOTENCY:**
   - Funding models use a `version Int` field for optimistic locking.
   - Chat and Funding declarations use a `clientId` field with a unique constraint `[userId, clientId]` to prevent duplicate submissions during network retries.

---

## 1. AUTH & USER DOMAIN

### 1.1 User (Table: `users`)
**Purpose:** Core identity for all actors (Members, Leaders, Admins).  
**Fields:**
- `id` (String, PK)
- `phone` (String, Unique)
- `email` (String, Unique, Nullable)
- `passwordHash` (String) // Argon2id
- `role` (UserRole)
- `status` (UserStatus)
- `mustChangePassword` (Boolean, default: false)
- `lastActiveAt` (DateTime, Nullable)
- `deletedAt` (DateTime, Nullable) // Soft delete
- `createdAt`, `updatedAt` (DateTime)

**Indexes:** `@@index([status])`, `@@index([role])`

### 1.2 Session (Table: `sessions`)
**Purpose:** Refresh token / active device tracking.  
**Fields:**
- `id` (String, PK)
- `userId` (String, FK)
- `refreshTokenHash` (String)
- `deviceLabel` (String, Nullable)
- `revokedAt` (DateTime, Nullable)
- `lastUsedAt` (DateTime, Nullable)

**Constraints:** `onDelete: Cascade` (from User).

### 1.3 AccountLock (Table: `account_locks`)
**Purpose:** Brute-force protection.  
**Fields:**
- `id` (String, PK)
- `userId` (String, Unique, FK)
- `failedAttempts` (Int, default: 0)
- `lockedUntil` (DateTime, Nullable)
- `lastFailedAt` (DateTime, Nullable)

### 1.4 RegistrationApplication (Table: `registration_applications`)
**Purpose:** Multi-step registration data before approval.  
**Fields:**
- `id` (String, PK)
- `fullName`, `phone`, `email`, `passwordHash`, `profilePhotoUrl`, `profilePhotoPublicId`, `gender` (String)
- `dateOfBirthEthYear`, `Month`, `Day` (Int) + `dateOfBirthGregorian` (@db.Date)
- `emergencyContactName`, `emergencyContactPhone` (String)
- `joiningDateEthYear`, `Month`, `Day` (Int?) + `joiningDateGregorian` (@db.Date?)
- `status` (ApplicationStatus)
- `rejectionReason` (String?)
- `reviewedByUserId`, `reviewedAt` (String?, DateTime?)

### 1.5 MemberProfile (Table: `member_profiles`)
**Purpose:** Approved member details.  
**Fields:**
- `id` (String, PK)
- `userId` (String, Unique, FK)
- `fullName`, `gender`, `emergencyContactName`, `emergencyContactPhone` (String)
- `dateOfBirthEth*` (Int) + Gregorian mirror
- `joiningDateEth*` (Int?) + Gregorian mirror
- `profilePhotoUrl`, `profilePhotoPublicId` (String)

**Constraints:** `onDelete: Cascade` (from User).

---

## 2. NOTIFICATION & COMMUNICATION DOMAIN

### 2.1 Notification (Table: `notifications`)
**Fields:**
- `id` (String, PK)
- `recipientId` (String, FK)
- `type` (NotificationType)
- `title` (String), `body` (String?)
- `relatedEntityType`, `relatedEntityId` (String?)
- `readAt`, `expiresAt` (DateTime?)

**Indexes:** `@@index([recipientId, readAt])`, `@@index([recipientId, createdAt])`

### 2.2 NotificationPreference (Table: `notification_preferences`)
**Purpose:** User opt-in/out toggles (1:1 with User).  
**Fields:**
- `userId` (String, Unique, FK)
- `announcementsEnabled`, `eventRemindersEnabled`, `chatMessagesEnabled`
- `birthdaysEnabled`, `newSongEnabled`, `newMemoryEnabled`, `dailyQuoteEnabled`
- `fundingReminderEnabled`, `fundingCampaignEnabled` (Boolean, default: true)

### 2.3 PushToken (Table: `push_tokens`)
**Fields:**
- `id` (String, PK)
- `userId` (String, FK)
- `token` (String, Unique)
- `platform` (String) // e.g., "android"
- `deviceLabel` (String?)

---

## 3. CHOIR CONTENT DOMAIN

### 3.1 Event (Table: `events`)
**Fields:**
- `id`, `title`, `description?`, `location?` (String)
- `dateEthYear`, `Month`, `Day` (Int) + `dateGregorian` (@db.Date)
- `coverImageUrl?`, `coverImagePublicId?` (String)
- `status` (EventStatus)
- `createdByUserId` (String?, FK)
- `publishedAt?`, `deletedAt?` (DateTime)

### 3.2 EventAttachment (Table: `event_attachments`)
**Fields:**
- `id`, `eventId` (FK), `imageUrl`, `imagePublicId` (String)

**Constraints:** `onDelete: Cascade`.

### 3.3 EventRSVP (Table: `event_rsvps`)
**Fields:**
- `id`, `eventId` (FK), `userId` (FK)
- `response` (RsvpResponse)

**Constraints:** `@@unique([eventId, userId])`, `onDelete: Cascade`.

### 3.4 AttendanceRecord (Table: `attendance_records`)
**Fields:**
- `id`, `memberId` (FK)
- `gathering` (GatheringType)
- `dateEthYear`, `Month`, `Day` (Int) + `dateGregorian` (@db.Date)
- `status` (AttendanceStatus)
- `lockedAt` (DateTime?)
- `recordedByUserId` (String?, FK)

**Constraints:** `@@unique([memberId, gathering, dateGregorian])`

### 3.5 Announcement (Table: `announcements`)
**Fields:**
- `id`, `title`, `message` (String)
- `publishAt` (DateTime), `status` (AnnouncementStatus)
- `imageUrl?`, `imagePublicId?` (String)
- `eventId?` (FK), `createdByUserId?` (FK)
- `deletedAt` (DateTime?)

### 3.6 AnnouncementSong (Table: `announcement_songs`)
**Fields:**
- `id`, `announcementId` (FK)
- `songId` (String), `songTitle` (String)

**Constraints:** `onDelete: Cascade`.

### 3.7 SongCategory (Table: `song_categories`)
**Fields:**
- `id`, `name` (String, Unique)

### 3.8 Song (Table: `songs`)
**Fields:**
- `id`, `title`, `lyrics?`, `audioUrl?`, `audioPublicId?`, `youtubeUrl?` (String)
- `categoryId` (String?, FK)
- `status` (SongStatus)
- `dateAdded`, `publishedAt?`, `updatedAt` (DateTime)
- `createdByUserId` (String?, FK)

### 3.9 SongFavorite (Table: `song_favorites`)
**Fields:**
- `id`, `songId` (FK), `userId` (FK)

**Constraints:** `@@unique([songId, userId])`, `onDelete: Cascade`.

### 3.10 ZemaMembership (Table: `zema_memberships`)
**Fields:**
- `id`, `userId` (FK), `assignedByUserId` (String?, FK)
- `assignedAt`, `removedAt?` (DateTime)

### 3.11 SongSubmission (Table: `song_submissions`)
**Fields:**
- `id`, `songId` (FK), `submittedByUserId` (FK)
- `status` (SubmissionStatus)
- `returnReason` (String?)
- `reviewedAt` (DateTime?)

### 3.12 Memory (Table: `memories`)
**Fields:**
- `id`, `title`, `description?` (String)
- `dateEthYear`, `Month`, `Day` (Int) + `dateGregorian` (@db.Date)
- `status` (MemoryStatus)
- `rejectionReason` (String?)
- `publishedAt?`, `deletedAt?` (DateTime)
- `submittedByUserId?`, `reviewedByUserId?` (String?, FK)
- `reviewedAt?` (DateTime)

### 3.13 MemoryMedia (Table: `memory_media`)
**Fields:**
- `id`, `memoryId` (FK)
- `type` (MemoryMediaType)
- `storageUrl?`, `storagePublicId?`, `youtubeUrl?` (String)

### 3.14 DailyQuote (Table: `daily_quotes`)
**Fields:**
- `id`
- `dateEthYear`, `Month`, `Day` (Int) + `dateGregorian` (@db.Date)
- `quoteText`, `source` (String)
- `youtubeUrl?`, `audioUrl?`, `audioPublicId?` (String)
- `status` (DailyQuoteStatus)
- `submittedByUserId` (String?, FK)

**Constraints:** `@@unique([dateGregorian])`

### 3.15 ServiceAssignment (Table: `service_assignments`)
**Purpose:** Assigns a member to a specific role (Prayer/Worship) for a gathering.
**Fields:**
- `id` (String, PK)
- `gatheringType` (GatheringType)
- `customGatheringName` (String?) // Used if gatheringType is SPECIAL_EVENT
- `dateEthYear`, `Month`, `Day` (Int) + `dateGregorian` (@db.Date)
- `role` (AssignmentRole) // PRAYER_LEADER, WORSHIP_LEADER
- `assignedUserId` (String, FK) // The member doing the service
- `assignedByUserId` (String, FK) // The leader who assigned it
- `status` (AssignmentStatus) // SCHEDULED, CANCELLED
- `createdAt`, `updatedAt` (DateTime)

**Constraints:**
- `@@unique([gatheringType, dateGregorian, role])` 
- `onDelete: Cascade` (from assignedUser), `Restrict` (from assignedByUser)

### 3.16 ReassignmentRequest (Table: `reassignment_requests`)
**Purpose:** Allows members to request a reassignment due to conflicts.
**Fields:**
- `id` (String, PK)
- `assignmentId` (String, FK)
- `requesterId` (String, FK)
- `reason` (String) // Required reason (e.g., "Out of city")
- `status` (ReassignmentStatus) // PENDING, APPROVED, REJECTED
- `resolvedByUserId` (String?, FK)
- `resolvedAt` (DateTime?)
- `createdAt`, `updatedAt` (DateTime)

**Constraints:** `onDelete: Cascade` (from assignment).

---

## 4. BIRTHDAY DOMAIN

### 4.1 BirthdayPost (Table: `birthday_posts`)
**Fields:**
- `id`, `userId` (FK), `year` (Int)
- `birthdayEthYear`, `Month`, `Day` (Int) + `birthdayGregorian` (@db.Date)

**Constraints:** `@@unique([userId, year])`

### 4.2 BirthdayComment (Table: `birthday_comments`)
**Fields:**
- `id`, `postId` (FK), `authorId` (FK)
- `parentCommentId` (String?, FK) // Self-referencing for replies
- `text` (String)
- `deletedAt` (DateTime?)

### 4.3 BirthdayCommentLike (Table: `birthday_comment_likes`)
**Fields:**
- `id`, `commentId` (FK), `userId` (FK)

**Constraints:** `@@unique([commentId, userId])`

### 4.4 BirthdayReaction (Table: `birthday_reactions`)
**Fields:**
- `id`, `postId` (FK), `userId` (FK)
- `emoji` (String)

**Constraints:** `@@unique([postId, userId])`

---

## 5. CHAT DOMAIN

### 5.1 ChatConversation (Table: `chat_conversations`)
**Fields:**
- `id`, `type` (ConversationType)
- `directKey` (String?, Unique) // e.g., "userId1_userId2" for DMs
- `lastMessageAt` (DateTime?)

### 5.2 ConversationMember (Table: `conversation_members`)
**Fields:**
- `id`, `conversationId` (FK), `userId` (FK)
- `joinedAt`, `leftAt?` (DateTime)

**Constraints:** `@@unique([conversationId, userId])`

### 5.3 ChatGroup (Table: `chat_groups`)
**Fields:**
- `id`, `conversationId` (Unique, FK)
- `name` (String, Unique)
- `photoUrl?`, `photoPublicId?` (String)
- `managerId` (FK), `createdByUserId` (String?, FK)

### 5.4 ChatMessage (Table: `chat_messages`)
**Fields:**
- `id`, `conversationId` (FK), `senderId` (FK)
- `type` (ChatMessageType)
- `text` (String?)
- `clientId` (String?) // For idempotency
- `replyToId` (String?, FK) // Self-referencing
- `editedAt?`, `deletedAt?` (DateTime?)

**Constraints:** 
- `@@unique([senderId, clientId])`
- `onDelete: Cascade`

### 5.5 ChatMedia (Table: `chat_media`)
**Fields:**
- `id`, `messageId` (FK)
- `type` (ChatMediaType)
- `storageUrl`, `storagePublicId` (String)
- `durationSeconds` (Int?) // For voice messages
- `retentionUntil` (DateTime) // 1 year from creation

### 5.6 MessageReaction (Table: `message_reactions`)
**Fields:**
- `id`, `messageId` (FK), `userId` (FK), `emoji` (String)

**Constraints:** `@@unique([messageId, userId, emoji])`

### 5.7 MessagePin (Table: `message_pins`)
**Fields:**
- `id`, `conversationId` (FK), `messageId` (FK), `pinnedByUserId` (FK)

**Constraints:** `@@unique([conversationId, messageId])`

### 5.8 MessageReport (Table: `message_reports`)
**Fields:**
- `id`, `messageId` (FK), `reporterId` (FK)
- `resolution` (MessageReportResolution?)
- `resolvedAt?`, `resolvedByUserId` (String?, FK)
- `retainUntil` (DateTime) // 30 days

**Constraints:** `@@unique([messageId, reporterId])`

### 5.9 ChatReadState (Table: `chat_read_states`)
**Fields:**
- `id`, `conversationId` (FK), `userId` (FK)
- `lastReadAt` (DateTime)
- `lastReadMessageId` (String?)

**Constraints:** `@@unique([conversationId, userId])`

---

## 6. FUNDING DOMAIN (SRS v2.0)

### 6.1 AnnualFundingConfiguration (Table: `annual_funding_configurations`)
**Purpose:** Configures annual hosting contribution rules per E.C. year.  
**Fields:**
- `id`, `contributionYear` (Int, Unique) // E.C. year
- `amountMinor` (Int) // Santim
- `includeMembers`, `includeLeaders` (Boolean, default: true)
- `expiryEth*` (Int) + `expiryGregorian` (@db.Date)
- `deadlineEth*` (Int) + `deadlineGregorian` (@db.Date)
- `monthlyReminderEnabled` (Boolean), `monthlyReminderEthDay` (Int, default: 1)
- `preDeadlineReminderDays` (Int, default: 7)
- `receiptUploadsEnabled` (Boolean, default: false)
- `referenceEnabled` (Boolean, default: true)
- `active` (Boolean, default: true)
- `createdByUserId?`, `updatedByUserId` (String?, FK)

### 6.2 AnnualContributionRecord (Table: `annual_contribution_records`)
**Purpose:** Tracks individual member obligations and partial payments.  
**Fields:**
- `id`, `configId` (FK), `participantId` (FK)
- `contributionYear` (Int)
- `amountDueMinor`, `paidMinor` (Int)
- `status` (FundingStatus)
- `verifiedByUserId?`, `verifiedAt?`, `rejectionReason?` (String?, DateTime?)
- `version` (Int, default: 0) // Optimistic locking

**Constraints:** 
- `@@unique([participantId, contributionYear])`
- `onDelete: Restrict` (for config), `Cascade` (for participant)

### 6.3 SpecialDonationCampaign (Table: `special_donation_campaigns`)
**Fields:**
- `id`, `title`, `description` (String)
- `donationType` (DonationType)
- `requestedAmountMinor?`, `targetAmountMinor?` (Int)
- `startEth*` (Int?) + `startGregorian` (@db.Date?)
- `deadlineEth*` (Int) + `deadlineGregorian` (@db.Date)
- `status` (CampaignStatus)
- `receiptUploadsEnabled?`, `referenceEnabled?` (Boolean?)
- `createdByUserId?` (FK)
- `publishedAt?`, `closedAt?`, `cancelledAt?` (DateTime)

### 6.4 SpecialDonationPayment (Table: `special_donation_payments`)
**Fields:**
- `id`, `campaignId` (FK), `participantId` (FK)
- `amountMinor`, `paidMinor` (Int)
- `status` (FundingStatus)
- `verifiedByUserId?`, `verifiedAt?`, `rejectionReason?`
- `version` (Int, default: 0) // Optimistic locking

**Constraints:** 
- `@@unique([campaignId, participantId])`
- `onDelete: Restrict` (for campaign)

### 6.5 FundingDeclaration (Table: `funding_declarations`)
**Purpose:** Append-only log of member payment declarations.  
**Fields:**
- `id`
- `annualRecordId` (String?, FK) // Mutually exclusive with donationPaymentId
- `donationPaymentId` (String?, FK)
- `participantId` (FK)
- `amountMinor` (Int)
- `paymentMethod` (PaymentMethod)
- `reference` (String?), `receiptUrl?`, `receiptPublicId?` (String?)
- `clientId` (String?) // For offline-sync idempotency
- `status` (DeclarationStatus)
- `decidedByUserId?`, `decidedAt?`, `rejectionReason?`

**Constraints:** `@@unique([participantId, clientId])`

### 6.6 FundingAuditLog (Table: `funding_audit_logs`)
**Fields:**
- `id`, `actorId` (String?, FK)
- `action` (String)
- `recordType` (FundingRecordType)
- `recordId` (String)
- `previousStatus?`, `newStatus?`, `reason?` (String?)
- `details` (Json?)

### 6.7 PaymentInstructions (Table: `payment_instructions`)
**Fields:**
- `id`, `method` (PaymentMethod), `providerName`, `accountHolderName`, `accountIdentifier`
- `note` (String?), `active` (Boolean)
- `updatedByUserId` (String?, FK)

**Constraints:** `@@unique([method, providerName, accountIdentifier])`

### 6.8 FundingReminderLog (Table: `funding_reminder_logs`)
**Purpose:** Prevents duplicate scheduled reminders.  
**Fields:**
- `id`, `recipientId` (String)
- `recordType` (FundingRecordType), `recordId` (String)
- `kind` (String), `periodKey` (String)
- `sentAt` (DateTime)

**Constraints:** `@@unique([recipientId, recordType, recordId, kind, periodKey])`

---

## 7. HELP & ASSISTANT DOMAIN

### 7.1 HelpEntry (Table: `help_entries`)
**Fields:**
- `id`, `slug` (Unique), `category` (String)
- `intentsEn`, `intentsAm` (String[]) // Postgres arrays
- `questionVariantsEn`, `questionVariantsAm` (String[])
- `answerEn`, `answerAm` (String)
- `deepLink` (String?)
- `visibleToRoles` (UserRole[]) // Postgres array of enum
- `screenHints` (String[])
- `active` (Boolean, default: true)
- `sortOrder` (Int, default: 0)

### 7.2 HelpQueryLog (Table: `help_query_logs`)
**Fields:**
- `id`, `userId` (String?, FK)
- `roleAtQuery` (UserRole?), `screen` (String?), `language` (String)
- `rawQuery` (String?) // Redacted before insert
- `matchedEntryId` (String?, FK), `matchScore` (Float?)
- `feedback` (HelpFeedback, default: NONE)
- `feedbackNote` (String?)

---

## 8. ENUMS (AUTHORITATIVE LIST)

- **UserRole:** `MEMBER`, `LEADER`, `ADMIN`
- **UserStatus:** `PENDING`, `APPROVED`, `REJECTED`, `DELETED`
- **ApplicationStatus:** `PENDING`, `APPROVED`, `REJECTED`
- **EventStatus:** `DRAFT`, `PUBLISHED`, `DELETED`
- **RsvpResponse:** `GOING`, `MAYBE`, `NOT_GOING`
- **GatheringType:** `TUESDAY_ZEMA`, `THURSDAY_CHOIR`, `SATURDAY_CHOIR`, `SPECIAL_EVENT`
- **AttendanceStatus:** `PRESENT`, `ABSENT`
- **AssignmentRole:** `PRAYER_LEADER`, `WORSHIP_LEADER`
- **AssignmentStatus:** `SCHEDULED`, `CANCELLED`
- **ReassignmentStatus:** `PENDING`, `APPROVED`, `REJECTED`
- **AnnouncementStatus:** `DRAFT`, `SCHEDULED`, `PUBLISHED`, `DELETED`
- **NotificationType:** `ANNOUNCEMENT`, `EVENT_REMINDER`, `CHAT_MESSAGE`, `BIRTHDAY`, `SONG_PUBLISHED`, `MEMORY_PUBLISHED`, `LEADERSHIP_CHANGE`, `DAILY_QUOTE`, `FUNDING_REMINDER`, `FUNDING_VERIFICATION_NEEDED`, `FUNDING_RESULT`, `FUNDING_CAMPAIGN`, `SERVICE_ASSIGNMENT`, `REASSIGNMENT_UPDATE`
- **SongStatus:** `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `RETURNED`, `UNPUBLISHED`, `DELETED`
- **SubmissionStatus:** `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `RETURNED`
- **MemoryStatus:** `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `DELETED`
- **MemoryMediaType:** `PHOTO`, `AUDIO`, `YOUTUBE`
- **DailyQuoteStatus:** `PUBLISHED`, `DELETED`
- **ConversationType:** `DIRECT`, `GENERAL`, `GROUP`
- **ChatMessageType:** `TEXT`, `PHOTO`, `VOICE`
- **ChatMediaType:** `PHOTO`, `VOICE`
- **MessageReportResolution:** `KEPT`, `DELETED`, `DISMISSED`
- **FundingStatus:** `UNPAID`, `PENDING_VERIFICATION`, `PAID`, `REJECTED`
- **DeclarationStatus:** `PENDING`, `APPROVED`, `REJECTED`, `VOID`
- **FundingRecordType:** `ANNUAL`, `DONATION`, `CAMPAIGN`, `CONFIGURATION`, `PAYMENT_INSTRUCTIONS`
- **DonationType:** `VOLUNTARY`, `REQUIRED`
- **CampaignStatus:** `DRAFT`, `PUBLISHED`, `CLOSED`, `CANCELLED`
- **PaymentMethod:** `BANK`, `TELEBIRR`
- **HelpFeedback:** `NONE`, `UP`, `DOWN`

---

## 9. RETENTION & CASCADE DELETION RULES

- **User Soft Delete:** `deletedAt` timestamp. MemberProfile and User data are retained, but the User status is changed and personal identifiers anonymized in the service layer.
- **Cascade Deletes:** `onDelete: Cascade` is applied to dependent records where the parent's deletion makes the child irrelevant (e.g., deleting a User removes their Sessions, PushTokens, and ChatMessages). For `ServiceAssignment`, if a member is deleted, their assignment cascades, but the assigning leader reference is restricted.
- **Funding Records:** `onDelete: Restrict` for Configurations and Campaigns. This ensures financial audit history cannot be accidentally deleted if a configuration or campaign is deleted.
- **Chat Media:** Hard deletion scheduled based on `retentionUntil` (1 year).
- **Message Reports:** Hard deletion scheduled based on `retainUntil` (30 days).
- **Notifications:** Hard deletion scheduled based on `expiresAt` (30 days).

---

## 10. MIGRATION HISTORY

The database schema is built incrementally via Prisma Migrations:
- `20261003..._init`: Foundation (Auth, Roles)
- `20261004..._auth_sessions...`
- `20261005..._registration...` / `add_must_change_p...`
- `20261013..._events_and_rsvp` / `attendance_records` / `announcements`
- `20261014..._songs_zema` / `memories` / `daily_quote`
- `20261017..._notifications_push` / `birthday_posts_com...`
- `20261018..._chat_schema` / `chat_production` / `chat_sync_indexes`
- `20261024..._add_funding`
- `20261025..._fundingadedndefin...` / `funding_v2_partial_p...` / `funding_constraints`
- `20261119..._add_service_assignments` (Pending)

---
*END OF MODEL SRS v1.1*