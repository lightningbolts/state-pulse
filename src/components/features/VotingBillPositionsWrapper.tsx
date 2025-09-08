import VotingBillPositions from './VotingBillPositions';

interface VotingBillPositionsWrapperProps {
  billId: string;
}

export async function VotingBillPositionsWrapper({ billId }: VotingBillPositionsWrapperProps) {
  // Fetch voting data server-side
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/legislation/${billId}/bill-voting-info`, {
      cache: 'no-store' // Ensure fresh data
    });
    
    if (!res.ok) {
      // If there's no voting data, don't render the component at all
      return null;
    }
    
    const data = await res.json();
    
    // If no voting records, don't render
    if (!data || !data.votingRecords || data.votingRecords.length === 0) {
      return null;
    }
    
    return <VotingBillPositions votingData={data} />;
  } catch (error) {
    // If there's an error fetching, don't render the component
    return null;
  }
}
