import { getRelatedBills } from '@/services/relatedBillsService';
import { RelatedBills } from '@/components/features/RelatedBills';
import { Legislation } from '@/types/legislation';

interface RelatedBillsWrapperProps {
  legislation: Legislation;
}

export async function RelatedBillsWrapper({ legislation }: RelatedBillsWrapperProps) {
  const relatedBills = await getRelatedBills(legislation, 3);
  return <RelatedBills relatedBills={relatedBills} />;
}
