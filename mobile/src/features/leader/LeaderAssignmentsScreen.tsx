import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Modal, FlatList, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useLeaderAssignmentsQuery, useCreateAssignmentMutation, useResolveReassignmentMutation, useReassignToMemberMutation } from '../assignments/useAssignments';
import { formatEthDate, ethTodayFromInstant } from '../../utils/ethiopianCalendar';
import { GatheringType, AssignmentRole } from '../../services/assignments';
import { loadAllMembers } from '../chat/chatStore';

export default function LeaderAssignmentsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'assignments' | 'requests' | 'history'>('assignments');
  
  const { data, isLoading } = useLeaderAssignmentsQuery();
  const allAssignments = data?.assignments ?? [];
  const requests = data?.requests ?? [];

  const todayUtc = ethTodayFromInstant(new Date());
  
  const upcomingAssignments = allAssignments.filter((a) => {
    const aDate = { year: a.dateEthYear, month: a.dateEthMonth, day: a.dateEthDay };
    return (aDate.year > todayUtc.year) || 
           (aDate.year === todayUtc.year && aDate.month > todayUtc.month) || 
           (aDate.year === todayUtc.year && aDate.month === todayUtc.month && aDate.day >= todayUtc.day);
  });

  const historyAssignments = allAssignments.filter((a) => {
    const aDate = { year: a.dateEthYear, month: a.dateEthMonth, day: a.dateEthDay };
    return (aDate.year < todayUtc.year) || 
           (aDate.year === todayUtc.year && aDate.month < todayUtc.month) || 
           (aDate.year === todayUtc.year && aDate.month === todayUtc.month && aDate.day < todayUtc.day);
  });

  const resolveMut = useResolveReassignmentMutation();
  const createMut = useCreateAssignmentMutation();
  const reassignMut = useReassignToMemberMutation();

  const [showForm, setShowForm] = useState(false);
  const [formGathering, setFormGathering] = useState<GatheringType>('THURSDAY_CHOIR');
  const [formRole, setFormRole] = useState<AssignmentRole>('PRAYER_LEADER');
  const [formDate, setFormDate] = useState({ year: todayUtc.year, month: todayUtc.month, day: todayUtc.day });
  
  const [members, setMembers] = useState<any[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [reassigningRequestId, setReassigningRequestId] = useState<string | null>(null);

  useEffect(() => {
    if ((showForm || reassigningRequestId) && members.length === 0) {
      loadAllMembers(true).then(setMembers).catch(() => {});
    }
  }, [showForm, reassigningRequestId]);

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

  const openMemberPicker = (requestId: string | null = null) => {
    setReassigningRequestId(requestId);
    setShowMemberPicker(true);
  };

  const handleMemberSelect = (member: any) => {
    setShowMemberPicker(false);
    if (reassigningRequestId) {
      reassignMut.mutate({ requestId: reassigningRequestId, newUserId: member.userId }, {
        onSuccess: () => Alert.alert('Success', `${member.fullName} has been assigned.`),
        onError: (err: any) => Alert.alert('Error', err.message || 'Failed to reassign.'),
      });
      setReassigningRequestId(null);
    } else {
      setSelectedMember(member);
    }
  };

  const handleCreate = () => {
    if (!selectedMember) return Alert.alert('Error', 'Please select a member first.');
    
    const recentlyServed = historyAssignments.filter(h => h.assignedUser.id === selectedMember.userId).length;
    if (recentlyServed > 0) {
      Alert.alert(
        'Notice',
        `${selectedMember.fullName} has served ${recentlyServed} time(s) in the last 2 months. Are you sure you want to assign them again?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Assign', onPress: () => executeCreate() }
        ]
      );
    } else {
      executeCreate();
    }
  };

  const executeCreate = () => {
    createMut.mutate({
      gatheringType: formGathering,
      role: formRole,
      assignedUserId: selectedMember.userId,
      date: formDate,
    }, {
      onSuccess: () => {
        Alert.alert('Success', 'Assignment created!');
        setShowForm(false);
        setSelectedMember(null);
      },
      onError: (err: any) => {
        Alert.alert('Error', err.message || 'Failed to create assignment.');
      }
    });
  };

  const filteredMembers = members.filter(m => 
    m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
  );

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

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
          <Pressable onPress={() => setActiveTab('assignments')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'assignments' ? BRAND.lime : 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: activeTab === 'assignments' ? BRAND.deep : '#FFF', fontWeight: '800', fontSize: 13 }}>Upcoming</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('requests')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'requests' ? BRAND.lime : 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: activeTab === 'requests' ? BRAND.deep : '#FFF', fontWeight: '800', fontSize: 13 }}>Requests ({requests.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('history')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: activeTab === 'history' ? BRAND.lime : 'rgba(255,255,255,0.15)' }}>
            <Text style={{ color: activeTab === 'history' ? BRAND.deep : '#FFF', fontWeight: '800', fontSize: 13 }}>History</Text>
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
              
              {showForm && (
                <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>Role</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <Pressable onPress={() => setFormRole('PRAYER_LEADER')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: formRole === 'PRAYER_LEADER' ? withAlpha(colors.primary, 0.2) : colors.background, borderWidth: 1, borderColor: formRole === 'PRAYER_LEADER' ? colors.primary : colors.border }}>
                      <Text style={{ textAlign: 'center', color: formRole === 'PRAYER_LEADER' ? colors.primary : colors.text }}>Prayer</Text>
                    </Pressable>
                    <Pressable onPress={() => setFormRole('WORSHIP_LEADER')} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: formRole === 'WORSHIP_LEADER' ? withAlpha(colors.primary, 0.2) : colors.background, borderWidth: 1, borderColor: formRole === 'WORSHIP_LEADER' ? colors.primary : colors.border }}>
                      <Text style={{ textAlign: 'center', color: formRole === 'WORSHIP_LEADER' ? colors.primary : colors.text }}>Worship</Text>
                    </Pressable>
                  </View>

                  <Text style={{ fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>Member</Text>
                  <Pressable onPress={() => openMemberPicker(null)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: 8, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
                    <Text style={{ color: selectedMember ? colors.text : colors.textSecondary }}>
                      {selectedMember ? selectedMember.fullName : 'Select a member...'}
                    </Text>
                    <Ionicons name="person" size={18} color={colors.textSecondary} />
                  </Pressable>

                  <Pressable onPress={handleCreate} disabled={createMut.isPending} style={{ backgroundColor: colors.primary, padding: 14, borderRadius: 8, alignItems: 'center' }}>
                    {createMut.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Create Assignment</Text>}
                  </Pressable>
                </View>
              )}

              {upcomingAssignments.map((a) => (
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

          {activeTab === 'history' && (
             <View>
               {historyAssignments.length === 0 ? (
                 <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40 }}>No history in the last 2 months.</Text>
               ) : (
                 historyAssignments.map((a) => (
                   <View key={a.id} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', opacity: 0.8 }}>
                     <View style={{ flex: 1 }}>
                       <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{a.role.replace('_', ' ')}</Text>
                       <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{formatEthDate({ year: a.dateEthYear, month: a.dateEthMonth, day: a.dateEthDay }, lang)}</Text>
                       <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>Served: {a.assignedUser.memberProfile?.fullName || 'Unknown'}</Text>
                     </View>
                     <Ionicons name="time-outline" size={24} color={colors.textSecondary} />
                   </View>
                 ))
               )}
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
                      
                      <Pressable onPress={() => openMemberPicker(req.id)} style={{ flex: 1.5, padding: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                        <Ionicons name="swap-horizontal" size={16} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '700' }}>Reassign</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showMemberPicker} transparent animationType="slide" onRequestClose={() => setShowMemberPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 }}>
                {reassigningRequestId ? 'Reassign to...' : 'Select Member'}
              </Text>
              <TextInput
                placeholder="Search members..."
                placeholderTextColor={colors.textSecondary}
                value={memberSearch}
                onChangeText={setMemberSearch}
                style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12, color: colors.text }}
              />
            </View>
            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.userId}
              renderItem={({ item }) => (
                <Pressable 
                  onPress={() => handleMemberSelect(item)}
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>{item.fullName}</Text>
                  {selectedMember?.userId === item.userId && !reassigningRequestId && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  {reassigningRequestId && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

    </View>
  );
}