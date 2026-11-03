import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leaderListRecords,
  leaderListDonations,
  leaderListCampaigns,
  leaderGetAnnualConfig,
  leaderListInstructions,
  approveRecord,
  rejectRecord,
  approveDonation,
  rejectDonation,
  leaderPublishCampaign,
  leaderCloseCampaign,
  leaderCancelCampaign,
  leaderCreateCampaign,
  leaderUpdateCampaign,
  leaderUpsertAnnualConfig,
  leaderCreateInstruction,
  leaderUpdateInstruction,
  LedgerFilter,
  CampaignInput,
  CampaignPatch,
  InstructionInput,
} from '../../services/funding';
import { EthDate } from '../../utils/ethiopianCalendar';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useLeaderRecordsQuery(p: { status?: LedgerFilter; q?: string; page?: number; pageSize?: number }) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['funding', userId ?? 'anon', 'leader', 'records', p],
    queryFn: () => leaderListRecords(p),
  });
}

export function useLeaderDonationsQuery(p: { status?: LedgerFilter; campaignId?: string; q?: string; page?: number; pageSize?: number }) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['funding', userId ?? 'anon', 'leader', 'donations', p],
    queryFn: () => leaderListDonations(p),
  });
}

export function useLeaderCampaignsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['funding', userId ?? 'anon', 'leader', 'campaigns'],
    queryFn: leaderListCampaigns,
  });
}

export function useLeaderAnnualConfigQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['funding', userId ?? 'anon', 'leader', 'annual-config'],
    queryFn: leaderGetAnnualConfig,
  });
}

export function useLeaderInstructionsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['funding', userId ?? 'anon', 'leader', 'instructions'],
    queryFn: leaderListInstructions,
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate the whole funding tree on success
// ---------------------------------------------------------------------------

function useInvalidateFunding() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['funding', userId ?? 'anon'] });
}

export function useApproveRecordMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { id: string; declId?: string }) => approveRecord(v.id, v.declId),
    onSuccess: () => invalidate(),
  });
}

export function useRejectRecordMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { id: string; reason: string; declId?: string }) => rejectRecord(v.id, v.reason, v.declId),
    onSuccess: () => invalidate(),
  });
}

export function useApproveDonationMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { id: string; declId?: string }) => approveDonation(v.id, v.declId),
    onSuccess: () => invalidate(),
  });
}

export function useRejectDonationMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { id: string; reason: string; declId?: string }) => rejectDonation(v.id, v.reason, v.declId),
    onSuccess: () => invalidate(),
  });
}

export function useLeaderCampaignMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: async (v: { action: 'publish' | 'close' | 'cancel'; id: string; reason?: string }): Promise<void> => {
      if (v.action === 'publish') await leaderPublishCampaign(v.id);
      else if (v.action === 'close') await leaderCloseCampaign(v.id);
      else await leaderCancelCampaign(v.id, v.reason || '');
    },
    onSuccess: () => invalidate(),
  });
}

export function useSaveCampaignMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: async (v: { id?: string; input: CampaignInput | CampaignPatch }): Promise<{ id: string } | void> => {
      if (v.id) {
        await leaderUpdateCampaign(v.id, v.input as CampaignPatch);
        return;
      }
      return leaderCreateCampaign(v.input as CampaignInput);
    },
    onSuccess: () => invalidate(),
  });
}

export function useSaveAnnualConfigMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: Parameters<typeof leaderUpsertAnnualConfig>[0]) => leaderUpsertAnnualConfig(v),
    onSuccess: () => invalidate(),
  });
}

export function useSaveInstructionMutation() {
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { id?: string; input: InstructionInput | (Partial<InstructionInput> & { reason: string }) }) => {
      if (v.id) return leaderUpdateInstruction(v.id, v.input as Partial<InstructionInput> & { reason: string });
      return leaderCreateInstruction(v.input as InstructionInput);
    },
    onSuccess: () => invalidate(),
  });
}