import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyFunding,
  getPaymentInstructions,
  getCampaignDetail,
  declareAnnualPayment,
  declareCampaignPayment,
  DeclareInput,
} from '../../services/funding';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';

function useUserId(): string | null {
  return useMe()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useMyFundingQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.myFunding(userId),
    queryFn: getMyFunding,
  });
}

export function usePaymentInstructionsQuery() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.paymentInstructions(userId),
    queryFn: getPaymentInstructions,
  });
}

export function useCampaignDetailQuery(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.fundingCampaign(userId, id),
    queryFn: () => getCampaignDetail(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations — invalidate on success only, never optimistic
// ---------------------------------------------------------------------------

function useInvalidateFunding() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ['funding', userId ?? 'anon'] });
}

export function useDeclareAnnualMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { recordId: string; body: DeclareInput }) =>
      declareAnnualPayment(v.recordId, v.body, userId),
    onSuccess: () => invalidate(),
  });
}

export function useDeclareCampaignMutation() {
  const userId = useUserId();
  const invalidate = useInvalidateFunding();
  return useMutation({
    mutationFn: (v: { campaignId: string; body: DeclareInput }) =>
      declareCampaignPayment(v.campaignId, v.body, userId),
    onSuccess: () => invalidate(),
  });
}