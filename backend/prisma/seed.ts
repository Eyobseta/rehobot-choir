// prisma/seed.ts
import {
  PrismaClient,
  UserRole,
  UserStatus,
  ApplicationStatus,
  EventStatus,
  RsvpResponse,
  GatheringType,
  AttendanceStatus,
  AnnouncementStatus,
  NotificationType,
  SongStatus,
  SubmissionStatus,
  MemoryStatus,
  MemoryMediaType,
  DailyQuoteStatus,
  ConversationType,
  ChatMessageType,
  ChatMediaType,
  MessageReportResolution,
} from '@prisma/client';
import argon2 from 'argon2';
import {
  fromEthiopian,
  toEthiopian,
  todayEthiopian,
  addDaysEth,
} from './ethiopian-date';

const prisma = new PrismaClient();

const ARGON2_OPTIONS: Parameters<typeof argon2.hash>[1] = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const ETH_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume',
];

function ethLabel(d: Date): string {
  const e = toEthiopian(d);
  return `${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')} (${ETH_MONTHS[e.month - 1]} ${e.day}, ${e.year} E.C.)`;
}

// ------------------------------------------------------------
// USERS
// ------------------------------------------------------------

async function upsertUser(opts: {
  phone: string;
  email?: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword?: boolean;
}) {
  const passwordHash = await argon2.hash(opts.password, ARGON2_OPTIONS);
  const user = await prisma.user.upsert({
    where: { phone: opts.phone },
    create: {
      phone: opts.phone,
      email: opts.email,
      passwordHash,
      role: opts.role,
      status: opts.status,
      mustChangePassword: opts.mustChangePassword ?? false,
    },
    update: {
      email: opts.email,
      passwordHash,
      role: opts.role,
      status: opts.status,
      mustChangePassword: opts.mustChangePassword ?? false,
      deletedAt: null,
    },
  });
  console.log(
    `[seed] user ${opts.role.padEnd(6)} ${opts.phone.padEnd(12)} pwd=${opts.password}`,
  );
  return user;
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

async function main() {
  console.log('[seed] Seeding Rehobot dev data (Ethiopian calendar)...');

  // ---- Users ----
  const admin = await upsertUser({
    phone: '0000000001',
    email: 'admin@rehobot.local',
    password: 'Admin1234!',
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
  });
  const leader = await upsertUser({
    phone: '0000000002',
    email: 'leader@rehobot.local',
    password: 'Leader1234!',
    role: UserRole.LEADER,
    status: UserStatus.APPROVED,
  });
  const member = await upsertUser({
    phone: '0000000003',
    email: 'member@rehobot.local',
    password: 'Member1234!',
    role: UserRole.MEMBER,
    status: UserStatus.APPROVED,
  });
  const member2 = await upsertUser({
    phone: '0000000004',
    email: 'hanna@rehobot.local',
    password: 'Hanna1234!',
    role: UserRole.MEMBER,
    status: UserStatus.APPROVED,
  });
  const member3 = await upsertUser({
    phone: '0000000005',
    email: 'dawit@rehobot.local',
    password: 'Dawit1234!',
    role: UserRole.MEMBER,
    status: UserStatus.APPROVED,
  });
  const pending = await upsertUser({
    phone: '0000000006',
    email: 'pending@rehobot.local',
    password: 'Pending1234!',
    role: UserRole.MEMBER,
    status: UserStatus.PENDING,
  });

  // Notification preferences for all users
  for (const u of [admin, leader, member, member2, member3, pending]) {
    await prisma.notificationPreference.upsert({
      where: { userId: u.id },
      create: { userId: u.id },
      update: {},
    });
  }

  // ---- Member profiles (with Ethiopian birthdates) ----
  const ethBirth = fromEthiopian({ year: 1995, month: 5, day: 12 }); // Tir 12, 1995 E.C. ≈ Jan 20, 2003
  const ethBirth2 = fromEthiopian({ year: 1998, month: 9, day: 3 }); // Ginbot 3, 1998 E.C.
  const ethBirth3 = fromEthiopian({ year: 1992, month: 1, day: 20 }); // Meskerem 20, 1992 E.C.
  const ethJoining = fromEthiopian({ year: 2015, month: 2, day: 5 }); // Tikimt 5, 2015 E.C.

  const profileData = [
    { user: member, fullName: 'Yohannes Bekele', gender: 'male', dob: ethBirth },
    { user: member2, fullName: 'Hanna Tesfaye', gender: 'female', dob: ethBirth2 },
    { user: member3, fullName: 'Dawit Alemu', gender: 'male', dob: ethBirth3 },
  ];

  for (const p of profileData) {
    await prisma.memberProfile.upsert({
      where: { userId: p.user.id },
      create: {
        userId: p.user.id,
        fullName: p.fullName,
        gender: p.gender,
        dateOfBirth: p.dob,
        emergencyContactName: 'Family Contact',
        emergencyContactPhone: '0911000000',
        joiningDate: ethJoining,
        profilePhotoUrl: `https://res.cloudinary.com/demo/image/upload/sample_${p.user.id}.jpg`,
        profilePhotoPublicId: `rehobot/profiles/${p.user.id}`,
      },
      update: {},
    });
  }

  // ---- Registration application (Ethiopian birthdate) ----
  await prisma.registrationApplication.deleteMany({
    where: { phone: '0000000006' },
  });
  await prisma.registrationApplication.create({
    data: {
      fullName: 'Selam Girma',
      phone: '0000000006',
      email: 'selam@rehobot.local',
      passwordHash: await argon2.hash('Selam1234!', ARGON2_OPTIONS),
      profilePhotoUrl: 'https://res.cloudinary.com/demo/image/upload/selam.jpg',
      profilePhotoPublicId: 'rehobot/applications/selam',
      gender: 'female',
      dateOfBirth: fromEthiopian({ year: 2000, month: 7, day: 15 }),
      emergencyContactName: 'Girma Tesfaye',
      emergencyContactPhone: '0911223344',
      joiningDate: fromEthiopian({ year: 2017, month: 1, day: 1 }),
      status: ApplicationStatus.PENDING,
    },
  });

  // ---- Song categories & songs ----
  const catWorship = await prisma.songCategory.upsert({
    where: { name: 'Worship' },
    create: { name: 'Worship' },
    update: {},
  });
  const catZema = await prisma.songCategory.upsert({
    where: { name: 'Zema' },
    create: { name: 'Zema' },
    update: {},
  });
  const catAnthem = await prisma.songCategory.upsert({
    where: { name: 'Anthem' },
    create: { name: 'Anthem' },
    update: {},
  });

  const song1 = await prisma.song.create({
    data: {
      title: 'Igziabeher Yimesgen',
      lyrics: 'Igziabeher yimesgen, lealem...',
      youtubeUrl: 'https://www.youtube.com/watch?v=demo1',
      categoryId: catWorship.id,
      status: SongStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: leader.id,
    },
  });
  const song2 = await prisma.song.create({
    data: {
      title: 'Selam Endehon',
      lyrics: 'Selam endehon, selam...',
      categoryId: catZema.id,
      status: SongStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: admin.id,
    },
  });
  const song3 = await prisma.song.create({
    data: {
      title: 'Rehobot Anthem',
      lyrics: 'Rehobot, Rehobot...',
      categoryId: catAnthem.id,
      status: SongStatus.PENDING_REVIEW,
      createdByUserId: member.id,
    },
  });

  // Favorite
  await prisma.songFavorite.create({
    data: { songId: song1.id, userId: member.id },
  });

  // Zema membership
  await prisma.zemaMembership.create({
    data: { userId: member2.id, assignedByUserId: leader.id },
  });

  // Song submission
  await prisma.songSubmission.create({
    data: {
      songId: song3.id,
      submittedByUserId: member.id,
      status: SubmissionStatus.PENDING_REVIEW,
    },
  });

  // ---- Events (Ethiopian dates) ----
  const todayEth = todayEthiopian();
  const eventDates = [
    addDaysEth(todayEth, 7),
    addDaysEth(todayEth, 14),
    addDaysEth(todayEth, 30),
    addDaysEth(todayEth, -3), // past event
  ];

  const event1 = await prisma.event.create({
    data: {
      title: 'Sunday Choir Practice',
      description: 'Weekly choir rehearsal.',
      location: 'Rehobot Main Hall',
      date: fromEthiopian(eventDates[0]),
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: leader.id,
      attachments: {
        create: [
          {
            imageUrl: 'https://res.cloudinary.com/demo/image/upload/event1a.jpg',
            imagePublicId: 'rehobot/events/event1a',
          },
        ],
      },
    },
  });
  const event2 = await prisma.event.create({
    data: {
      title: 'Monthly Zema Night',
      description: 'Traditional Zema gathering.',
      location: 'Rehobot Hall B',
      date: fromEthiopian(eventDates[1]),
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: admin.id,
    },
  });
  const event3 = await prisma.event.create({
    data: {
      title: 'Rehobot Anniversary',
      description: 'Church anniversary celebration.',
      location: 'Main Sanctuary',
      date: fromEthiopian(eventDates[2]),
      status: EventStatus.DRAFT,
      createdByUserId: admin.id,
    },
  });
  const eventPast = await prisma.event.create({
    data: {
      title: 'Past Thanksgiving',
      description: 'Thanksgiving service.',
      location: 'Main Sanctuary',
      date: fromEthiopian(eventDates[3]),
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: leader.id,
    },
  });

  // RSVPs
  await prisma.eventRSVP.createMany({
    data: [
      { eventId: event1.id, userId: member.id, response: RsvpResponse.GOING },
      { eventId: event1.id, userId: member2.id, response: RsvpResponse.MAYBE },
      { eventId: event2.id, userId: member.id, response: RsvpResponse.GOING },
      { eventId: event2.id, userId: member3.id, response: RsvpResponse.NOT_GOING },
    ],
    skipDuplicates: true,
  });

  // ---- Attendance (Ethiopian dates, last 4 weeks) ----
  const gatheringTypes = [
    GatheringType.TUESDAY_ZEMA,
    GatheringType.THURSDAY_CHOIR,
    GatheringType.SATURDAY_CHOIR,
  ];
  const members = [member, member2, member3];

  for (let week = 1; week <= 4; week++) {
    const day = addDaysEth(todayEth, -week * 7);
    for (const g of gatheringTypes) {
      for (const m of members) {
        await prisma.attendanceRecord.create({
          data: {
            memberId: m.id,
            gathering: g,
            date: fromEthiopian(day),
            status:
              Math.random() > 0.25
                ? AttendanceStatus.PRESENT
                : AttendanceStatus.ABSENT,
            recordedByUserId: leader.id,
            lockedAt:
              week >= 2 ? fromEthiopian(addDaysEth(day, 2)) : null,
          },
        });
      }
    }
  }

  // ---- Announcements ----
  await prisma.announcement.create({
    data: {
      title: 'Choir Practice Update',
      message: 'Practice moved to 3 PM this Saturday.',
      status: AnnouncementStatus.PUBLISHED,
      publishAt: new Date(),
      createdByUserId: leader.id,
      eventId: event1.id,
      songs: {
        create: [
          { songId: song1.id, songTitle: song1.title },
          { songId: song2.id, songTitle: song2.title },
        ],
      },
    },
  });
  await prisma.announcement.create({
    data: {
      title: 'Upcoming Zema Night',
      message: 'Please prepare the listed songs.',
      status: AnnouncementStatus.SCHEDULED,
      publishAt: fromEthiopian(addDaysEth(todayEth, 5)),
      createdByUserId: admin.id,
      eventId: event2.id,
    },
  });

  // ---- Notifications ----
  await prisma.notification.createMany({
    data: [
      {
        recipientId: member.id,
        type: NotificationType.ANNOUNCEMENT,
        title: 'New announcement',
        body: 'Choir Practice Update',
        relatedEntityType: 'Announcement',
      },
      {
        recipientId: member2.id,
        type: NotificationType.EVENT_REMINDER,
        title: 'Event reminder',
        body: 'Sunday Choir Practice',
        relatedEntityType: 'Event',
        relatedEntityId: event1.id,
      },
      {
        recipientId: member3.id,
        type: NotificationType.BIRTHDAY,
        title: 'Happy Birthday!',
        body: 'Wishing you a blessed year.',
      },
    ],
  });

  // ---- Memories (Ethiopian dates) ----
  const mem1 = await prisma.memory.create({
    data: {
      title: 'Easter Celebration 2017 E.C.',
      description: 'Photos from our Fasika celebration.',
      date: fromEthiopian({ year: 2017, month: 8, day: 20 }),
      status: MemoryStatus.PUBLISHED,
      publishedAt: new Date(),
      submittedByUserId: member.id,
      reviewedByUserId: leader.id,
      reviewedAt: new Date(),
      media: {
        create: [
          {
            type: MemoryMediaType.PHOTO,
            storageUrl: 'https://res.cloudinary.com/demo/image/upload/mem1.jpg',
            storagePublicId: 'rehobot/memories/mem1',
          },
          {
            type: MemoryMediaType.YOUTUBE,
            youtubeUrl: 'https://www.youtube.com/watch?v=mem1',
          },
        ],
      },
    },
  });
  await prisma.memory.create({
    data: {
      title: 'Christmas Choir 2018 E.C.',
      description: 'Genna performance.',
      date: fromEthiopian({ year: 2018, month: 4, day: 29 }),
      status: MemoryStatus.PENDING_REVIEW,
      submittedByUserId: member2.id,
      media: {
        create: [
          {
            type: MemoryMediaType.AUDIO,
            storageUrl: 'https://res.cloudinary.com/demo/video/upload/mem2.mp3',
            storagePublicId: 'rehobot/memories/mem2',
          },
        ],
      },
    },
  });

  // ---- Daily quotes (next 7 days in Ethiopian calendar) ----
  const quotes = [
    { text: 'The Lord is my shepherd; I shall not want.', source: 'Psalm 23:1' },
    { text: 'I can do all things through Christ who strengthens me.', source: 'Philippians 4:13' },
    { text: 'Trust in the Lord with all your heart.', source: 'Proverbs 3:5' },
    { text: 'Be strong and courageous.', source: 'Joshua 1:9' },
    { text: 'The joy of the Lord is your strength.', source: 'Nehemiah 8:10' },
    { text: 'Love one another as I have loved you.', source: 'John 13:34' },
    { text: 'Thy word is a lamp unto my feet.', source: 'Psalm 119:105' },
  ];

  for (let i = 0; i < quotes.length; i++) {
    const d = fromEthiopian(addDaysEth(todayEth, i));
    await prisma.dailyQuote.upsert({
      where: { dateOnly: d },
      create: {
        dateOnly: d,
        quoteText: quotes[i].text,
        source: quotes[i].source,
        status: DailyQuoteStatus.PUBLISHED,
        submittedByUserId: admin.id,
      },
      update: {
        quoteText: quotes[i].text,
        source: quotes[i].source,
      },
    });
  }

  // ---- Birthday posts (Ethiopian birthdates) ----
  const bdayUser = member2;
  const bdayEth = toEthiopian(ethBirth2); // uses profile DOB
  await prisma.birthdayPost.create({
    data: {
      userId: bdayUser.id,
      year: bdayEth.year,
      birthdayDate: ethBirth2,
      reactions: {
        create: [
          { userId: member.id, emoji: '🎉' },
          { userId: member3.id, emoji: '🎂' },
        ],
      },
      comments: {
        create: [
          {
            authorId: member.id,
            text: 'Melkam lidet! 🎉',
            likes: {
              create: [{ userId: member3.id }],
            },
          },
        ],
      },
    },
  });

  // ---- Chat: General + Direct + Group ----
  const general = await prisma.chatConversation.create({
    data: {
      type: ConversationType.GENERAL,
      members: {
        create: [
          { userId: admin.id },
          { userId: leader.id },
          { userId: member.id },
          { userId: member2.id },
          { userId: member3.id },
        ],
      },
      readStates: {
        create: [
          { userId: admin.id },
          { userId: leader.id },
          { userId: member.id },
        ],
      },
    },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: general.id,
      senderId: admin.id,
      type: ChatMessageType.TEXT,
      text: 'Welcome to the Rehobot general chat!',
    },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: general.id,
      senderId: member.id,
      type: ChatMessageType.TEXT,
      text: 'Thank you admin!',
    },
  });

  // Direct conversation
  const directKey = [member.id, member2.id].sort().join('|');
  const direct = await prisma.chatConversation.create({
    data: {
      type: ConversationType.DIRECT,
      directKey,
      members: {
        create: [{ userId: member.id }, { userId: member2.id }],
      },
      readStates: {
        create: [{ userId: member.id }, { userId: member2.id }],
      },
    },
  });
  const dm = await prisma.chatMessage.create({
    data: {
      conversationId: direct.id,
      senderId: member.id,
      type: ChatMessageType.TEXT,
      text: 'Hi Hanna, are you coming to practice?',
    },
  });
  await prisma.chatMessage.create({
    data: {
      conversationId: direct.id,
      senderId: member2.id,
      type: ChatMessageType.TEXT,
      text: 'Yes, InshaAllah!',
      replyToId: dm.id,
    },
  });

  // Group chat
  const groupConv = await prisma.chatConversation.create({
    data: {
      type: ConversationType.GROUP,
      members: {
        create: [
          { userId: leader.id },
          { userId: member.id },
          { userId: member2.id },
        ],
      },
      group: {
        create: {
          name: 'Zema Team',
          managerId: leader.id,
          createdByUserId: leader.id,
        },
      },
    },
  });
  const groupMsg = await prisma.chatMessage.create({
    data: {
      conversationId: groupConv.id,
      senderId: leader.id,
      type: ChatMessageType.TEXT,
      text: 'Practice this Tuesday at 6 PM.',
    },
  });
  await prisma.messagePin.create({
    data: {
      conversationId: groupConv.id,
      messageId: groupMsg.id,
      pinnedByUserId: leader.id,
    },
  });
  await prisma.messageReaction.create({
    data: { messageId: groupMsg.id, userId: member.id, emoji: '👍' },
  });
  await prisma.messageReport.create({
    data: {
      messageId: groupMsg.id,
      reporterId: member3.id,
      retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ---- Push token ----
  await prisma.pushToken.create({
    data: {
      userId: member.id,
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'android',
      deviceLabel: 'Pixel 7',
    },
  });

  console.log('[seed] Done.');
  console.log('[seed] Ethiopian "today":', ethLabel(new Date()));
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });