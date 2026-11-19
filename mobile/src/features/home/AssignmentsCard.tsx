import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { useMyAssignmentsQuery, useRequestReassignmentMutation } from '../assignments/useAssignments';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import { Assignment } from '../../services/assignments';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AssignmentsCard({ navigation }: { navigation: any }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const { data: assignments, isLoading } = useMyAssignmentsQuery();
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [reassignReason, setReassignReason] = useState('');
  
  const reassignMut = useRequestReassignmentMutation();

  if (isLoading || !assignments || assignments.length === 0) return null;

  // Show only the most immediate upcoming assignment
  const nextAssignment = assignments[0]; 

  const handleContactLeader = () => {
    // Assuming your chat system takes a userId to start a DM
    // Adjust this if your chat navigates by conversationId directly
    navigation.navigate('Chat', { 
      screen: 'NewChat', 
      params: { initialUserId: nextAssignment.assignedById } 
    });
  };

  const submitReassignment = () => {
    if (!selectedAssignment) return;
    if (reassignReason.trim().length < 5) {
      Alert.alert('Error', 'Please provide a valid reason (min 5 chars).');
      return;
    }
    reassignMut.mutate(
      { id: selectedAssignment.id, reason: reassignReason },
      {
        onSuccess: () => {
          setSelectedAssignment(null);
          setReassignReason('');
          Alert.alert('Success', 'Reassignment request sent to your leader.');
        },
        onError: (err: any) => {
          Alert.alert('Error', err.message || 'Failed to send request.');
        },
      }
    );
  };

  const roleLabel = nextAssignment.role === 'PRAYER_LEADER' ? t('home.prayerLeader') : t('home.worshipLeader');
  const gatheringLabel = nextAssignment.gatheringType === 'SPECIAL_EVENT' 
    ? nextAssignment.customGatheringName 
    : t(`home.${nextAssignment.gatheringType.toLowerCase().replace('_zema', 'Zema').replace('_choir', 'Choir')}` as any);

  return (
    <>
      <LinearGradient
        colors={[withAlpha(BRAND.teal, 0.95), withAlpha(BRAND.tealDark, 0.98)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 16, marginBottom: 16, shadowColor: BRAND.deep, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mic" size={16} color={BRAND.gold} />
            </View>
            <Text style={[typography.h3, { color: '#FFF', fontWeight: '800' }]}>{t('home.assignmentsTitle')}</Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>
            {formatEthDate(nextAssignment.date, lang)}
          </Text>
        </View>

        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: BRAND.lime, fontWeight: '800', fontSize: 14 }}>{gatheringLabel}</Text>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{roleLabel}</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="person" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
              {t('home.assignedBy', { name: nextAssignment.assignedBy })}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={() => setSelectedAssignment(nextAssignment)} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Request Change</Text>
          </Pressable>
          <Pressable onPress={handleContactLeader} style={{ flex: 1, backgroundColor: BRAND.lime, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-ellipses" size={16} color={BRAND.deep} />
            <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 13 }}>{t('home.contactLeader')}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <Modal visible={!!selectedAssignment} transparent animationType="fade" onRequestClose={() => setSelectedAssignment(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20 }}>
            <Text style={[typography.h3, { color: colors.text, marginBottom: 8 }]}>Request Reassignment</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 13 }}>Provide a reason why you cannot serve on this date. A leader will review your request.</Text>
            
            <TextInput
              value={reassignReason}
              onChangeText={setReassignReason}
              placeholder="e.g., I am out of the city for a wedding..."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Pressable onPress={() => setSelectedAssignment(null)} style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable onPress={submitReassignment} disabled={reassignMut.isPending} style={{ flex: 1, backgroundColor: BRAND.teal, paddingVertical: 14, alignItems: 'center', borderRadius: 12, opacity: reassignMut.isPending ? 0.7 : 1 }}>
                {reassignMut.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Submit</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}