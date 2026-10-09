import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';
import ApprovalsListScreen from '../features/leader/ApprovalsListScreen';
import ApplicantDetailScreen from '../features/leader/ApplicantDetailScreen';
import ManageMemberScreen from '../features/leader/ManageMemberScreen';
import LeaderEventsScreen from '../features/events/LeaderEventsScreen';
import EventEditorScreen from '../features/events/EventEditorScreen';
import LeaderAttendanceScreen from '../features/attendance/LeaderAttendanceScreen';
import LeaderAttendanceMembersScreen from '../features/attendance/LeaderAttendanceMembersScreen';
import MemberAttendanceGridScreen from '../features/attendance/MemberAttendanceGridScreen';
import LeaderAnnouncementsScreen from '../features/announcements/LeaderAnnouncementsScreen';
import AnnouncementEditorScreen from '../features/announcements/AnnouncementEditorScreen';
import LeaderSongsScreen from '../features/leader/LeaderSongsScreen';
import SongEditorScreen from '../features/leader/SongEditorScreen';
import SongCategoriesScreen from '../features/leader/SongCategoriesScreen';
import ZemaTeamScreen from '../features/leader/ZemaTeamScreen';
import SongReviewScreen from '../features/leader/SongReviewScreen';
import LeaderMemoriesScreen from '../features/memories/LeaderMemoriesScreen';
import MemoryReviewDetailScreen from '../features/memories/MemoryReviewDetailScreen';


export type LeaderStackParamList = {
  ApprovalsList: undefined;
  ApplicantDetail: { id: string };
  ManageMember: undefined;
  LeaderEvents: undefined;
  EventEditor: { id: string | null };
  LeaderAttendance: undefined;
  LeaderAttendanceMembers: undefined;
  MemberAttendanceGrid: { memberId: string; memberName: string };
    LeaderAnnouncements: undefined;
  AnnouncementEditor: { id: string | null };
    LeaderSongs: undefined;
  SongEditor: { id: string | null };
  SongCategories: undefined;
  ZemaTeam: undefined;
  SongReview: undefined;
    LeaderMemories: undefined;
  MemoryReviewDetail: { id: string };
};

const Stack = createNativeStackNavigator<LeaderStackParamList>();

export default function LeaderStack() {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="ApprovalsList"
        component={ApprovalsListScreen}
        options={{ title: t('leader.approvalsTab') }}
      />
      <Stack.Screen
        name="ApplicantDetail"
        component={ApplicantDetailScreen}
        options={{ title: t('leader.applicantDetail') }}
      />
      <Stack.Screen
        name="ManageMember"
        component={ManageMemberScreen}
        options={{ title: t('leaderTools.manageMember') }}
      />
      <Stack.Screen
        name="LeaderEvents"
        component={LeaderEventsScreen}
        options={{ title: t('events.title') }}
      />
      <Stack.Screen
        name="EventEditor"
        component={EventEditorScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="LeaderAttendance"
        component={LeaderAttendanceScreen}
        options={{ title: t('attendance.record') }}
      />
      <Stack.Screen
        name="LeaderAttendanceMembers"
        component={LeaderAttendanceMembersScreen}
        options={{ title: t('attendance.members') }}
      />
      <Stack.Screen
        name="MemberAttendanceGrid"
        component={MemberAttendanceGridScreen}
        options={{ title: t('attendance.grid') }}
      />
            <Stack.Screen
        name="LeaderAnnouncements"
        component={LeaderAnnouncementsScreen}
        options={{ title: t('announcements.title') }}
      />
      <Stack.Screen
        name="AnnouncementEditor"
        component={AnnouncementEditorScreen}
        options={{ title: '' }}
      />
            <Stack.Screen
        name="LeaderSongs"
        component={LeaderSongsScreen}
        options={{ title: t('leaderSongs.title') }}
      />
      <Stack.Screen
        name="SongEditor"
        component={SongEditorScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="SongCategories"
        component={SongCategoriesScreen}
        options={{ title: t('leaderSongs.categories') }}
      />
      <Stack.Screen
        name="ZemaTeam"
        component={ZemaTeamScreen}
        options={{ title: t('leaderSongs.zemaTeam') }}
      />
      <Stack.Screen
        name="SongReview"
        component={SongReviewScreen}
        options={{ title: t('leaderSongs.review') }}
      />
            <Stack.Screen
        name="LeaderMemories"
        component={LeaderMemoriesScreen}
        options={{ title: t('memories.reviewTitle') }}
      />
      <Stack.Screen
        name="MemoryReviewDetail"
        component={MemoryReviewDetailScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>

  );
}