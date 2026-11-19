import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useLeaderAssignmentsQuery, useCreateAssignmentMutation, useResolveReassignmentMutation } from '../assignments/useAssignments';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import { GatheringType, AssignmentRole } from '../../services/assignments';
// NOTE: You will need a way to fetch members to assign.
// If you have a `useDirectoryQuery`, use it here. For this example, I assume you have one.
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../services/api'; 

export default function LeaderAssignmentsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'assignments' | 'requests'>('assignments');
  
  const { data, isLoading } = useLeaderAssignmentsQuery();
  const assignments = data?.assignments ?? [];
  const requests = data?.requests ?? [];

  const resolveMut = useResolveReassignmentMutation();
  const createMut = useCreateAssignmentMutation();

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formGathering, setFormGathering] = useState<GatheringType>('THURSDAY_CHOIR');
  const [formRole, setFormRole] = useState<AssignmentRole>('PRAYER_LEADER');
  const [formDate, setFormDate] = useState({ year: 2016, month: 1, day: 1 }); // Should use a date picker in production
  const [formUser, setFormUser] = useState<string>('');

  const handleResolve = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    Alert.alert(
      status === 'APPROVED' ? 'Approve Request' : 'Reject Request',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => resolveMut.mutate({ id: requestId, status }) }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.teal, BRAND.teal]}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="clipboard" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>LEADER</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }}>{t('leaderAssignments.title')}</Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Pressable onPress={() => setActiveTab('assignments')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'assignments' ? BRAND.lime : 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: activeTab === 'assignments' ? BRAND.deep : '#FFF', fontWeight: '800' }}>{t('leaderAssignments.tabAssignments')}</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('requests')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'requests' ? BRAND.lime : 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: activeTab === 'requests' ? BRAND.deep : '#FFF', fontWeight: '800' }}>{t('leaderAssignments.tabRequests')} ({requests.length})</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {activeTab === 'assignments' && (
            <View>
              <Pressable onPress={() => setShowForm(!showForm)} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{t('leaderAssignments.newAssignment')}</Text>
                <Ionicons name={showForm ? "chevron-up" : "add-circle"} size={24} color={colors.primary} />
              </Pressable>
              
              {/* Note: In a real app, replace the raw text inputs with proper Date/User pickers */}
              {showForm && (
                <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>Setup new assignment (Simplified UI)</Text>
                  <TextInput placeholder="Member ID (string)" placeholderTextColor={colors.textSecondary} value={formUser} onChangeText={setFormUser} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, color: colors.text, marginBottom: 10 }} />
                  <Pressable onPress={() => createMut.mutate({ gatheringType: formGathering, role: formRole, assignedUserId: formUser, date: formDate })} style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    {createMut.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Assign</Text>}
                  </Pressable>
                </View>
              )}

              {assignments.map((a) => (
                <View key={a.id} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{a.role.replace('_', ' ')}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatEthDate({ year: a.dateEthYear, month: a.dateEthMonth, day: a.dateEthDay }, lang)}</Text>
                    <Text style={{ color: colors.primary, fontSize: 13, marginTop: 4 }}>Assigned to: {a.assignedUser.memberProfile?.fullName || 'Unknown'}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                </View>
              ))}
            </View>
          )}

          {activeTab === 'requests' && (
            <View>
              {requests.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40 }}>{t('leaderAssignments.requestsEmpty')}</Text>
              ) : (
                requests.map((req) => (
                  <View key={req.id} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{req.requester.memberProfile?.fullName}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{req.assignment.role.replace('_', ' ')} on {formatEthDate({ year: req.assignment.dateEthYear, month: req.assignment.dateEthMonth, day: req.assignment.dateEthDay }, lang)}</Text>
                    <View style={{ backgroundColor: withAlpha(colors.error, 0.1), padding: 10, borderRadius: 8, marginTop: 10 }}>
                      <Text style={{ color: colors.error, fontWeight: '600' }}>Reason: {req.reason}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <Pressable onPress={() => handleResolve(req.id, 'REJECTED')} style={{ flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.error, alignItems: 'center' }}>
                        <Text style={{ color: colors.error, fontWeight: '700' }}>Reject</Text>
                      </Pressable>
                      <Pressable onPress={() => handleResolve(req.id, 'APPROVED')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: colors.success, alignItems: 'center' }}>
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}