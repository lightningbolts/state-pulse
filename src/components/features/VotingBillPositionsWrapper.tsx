import VotingBillPositions from './VotingBillPositions';
import { getBillVotingInfo } from '@/services/votingService';

interface VotingBillPositionsWrapperProps {
  billId: string;
}

export async function VotingBillPositionsWrapper({ billId }: VotingBillPositionsWrapperProps) {
  // Fetch voting data directly from the service
  const votingData = await getBillVotingInfo(billId);

  // If no voting records, don't render
  if (!votingData || !votingData.votingRecords || votingData.votingRecords.length === 0) {
    return null;
  }

  return <VotingBillPositions votingData={votingData} />;
}
