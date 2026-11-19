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
import MemoryVideoScreen from '../features/memories/MemoryVideoScreen';
import SongVideoScreen from '../features/songs/SongVideoScreen';
// 🟢 NEW IMPORT
import LeaderAssignmentsScreen from '../features/leader/LeaderAssignmentsScreen';

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
  MemoryVideo: { youtubeUrl: string; memoryTitle?: string };
  SongVideo: { youtubeUrl: string; title: string };
  // 🟢 NEW ROUTE TYPE
  LeaderAssignments: undefined;
};

const Stack = createNativeStackNavigator<LeaderStackParamList>();

export default function LeaderStack() {
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ApplicantDetail"
        component={ApplicantDetailScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="ManageMember"
        component={ManageMemberScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="LeaderEvents"
        component={LeaderEventsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EventEditor"
        component={EventEditorScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="LeaderAttendance"
        component={LeaderAttendanceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LeaderAttendanceMembers"
        component={LeaderAttendanceMembersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemberAttendanceGrid"
        component={MemberAttendanceGridScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="LeaderAnnouncements"
        component={LeaderAnnouncementsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AnnouncementEditor"
        component={AnnouncementEditorScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="LeaderSongs"
        component={LeaderSongsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SongEditor"
        component={SongEditorScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SongCategories"
        component={SongCategoriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ZemaTeam"
        component={ZemaTeamScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SongReview"
        component={SongReviewScreen}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="LeaderMemories"
        component={LeaderMemoriesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemoryReviewDetail"
        component={MemoryReviewDetailScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MemoryVideo"
        component={MemoryVideoScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="SongVideo"
        component={SongVideoScreen}
        options={{ headerShown: false, animation: 'slide_from_right' }}
      />

      {/* 🟢 NEW SCREEN REGISTERED */}
      <Stack.Screen
        name="LeaderAssignments"
        component={LeaderAssignmentsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}