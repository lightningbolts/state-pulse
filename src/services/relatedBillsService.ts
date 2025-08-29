import { getCollection } from '../lib/mongodb';
import { Legislation } from '../types/legislation';

interface RelatedBill {
  id: string;
  identifier: string;
  title: string;
  jurisdictionName: string;
  chamber?: string;
  latestActionAt?: Date;
  geminiSummary?: string;
  subjects?: string[];
  score: number;
}

export async function getRelatedBills(
  currentBill: Legislation,
  limit: number = 3
): Promise<RelatedBill[]> {
  const collection = await getCollection('legislation');
  
  // Get all bills except the current one with random sampling for diversity
  const allBills = await collection
    .aggregate([
      {
        $match: { 
          id: { $ne: currentBill.id },
          // Only include bills with some content to compare
          $or: [
            { subjects: { $exists: true, $ne: [] } },
            { 
              $and: [
                { geminiSummary: { $exists: true } },
                { geminiSummary: { $ne: null } },
                { geminiSummary: { $ne: '' } }
              ]
            },
            { 
              $and: [
                { title: { $exists: true } },
                { title: { $ne: null } },
                { title: { $ne: '' } }
              ]
            }
          ]
        }
      },
      { $sample: { size: 5000 } }, // Random sample for diversity
      {
        $project: {
          id: 1,
          identifier: 1,
          title: 1,
          jurisdictionName: 1,
          chamber: 1,
          latestActionAt: 1,
          geminiSummary: 1,
          subjects: 1
        }
      }
    ])
    .toArray();

  const scoredBills = allBills.map(bill => {
    let score = 0;
    
    // Subject similarity (highest weight)
    if (currentBill.subjects && bill.subjects) {
      const currentSubjects = new Set(currentBill.subjects.map((s: string) => s.toLowerCase()));
      const billSubjects = new Set(bill.subjects.map((s: string) => s.toLowerCase()));
      const intersection = new Set([...currentSubjects].filter(x => billSubjects.has(x)));
      const union = new Set([...currentSubjects, ...billSubjects]);
      
      if (union.size > 0) {
        const jaccardSimilarity = intersection.size / union.size;
        score += jaccardSimilarity * 50; // Weight: 50 points max
      }
    }
    
    // Title similarity (medium weight)
    if (currentBill.title && bill.title) {
      const titleSimilarity = calculateTextSimilarity(
        currentBill.title.toLowerCase(),
        bill.title.toLowerCase()
      );
      score += titleSimilarity * 30; // Weight: 30 points max
    }
    
    // Summary similarity (medium weight)
    if (currentBill.geminiSummary && bill.geminiSummary) {
      const summarySimilarity = calculateTextSimilarity(
        currentBill.geminiSummary.toLowerCase(),
        bill.geminiSummary.toLowerCase()
      );
      score += summarySimilarity * 25; // Weight: 25 points max
    }
    
    // Jurisdiction bonus for diversity
    if (currentBill.jurisdictionName === bill.jurisdictionName) {
      score += 8; // Slight bonus for same jurisdiction
    } else {
      // Small bonus for different jurisdictions to encourage diversity
      score += 3;
    }
    
    // Date proximity bonus (recent bills are more relevant)
    if (currentBill.latestActionAt && bill.latestActionAt) {
      const daysDiff = Math.abs(
        (new Date(currentBill.latestActionAt).getTime() - new Date(bill.latestActionAt).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      
      // Give higher score to bills within 365 days
      if (daysDiff <= 365) {
        const dateScore = Math.max(0, (365 - daysDiff) / 365) * 10;
        score += dateScore; // Weight: 10 points max
      }
    }
    
    return {
      id: bill.id,
      identifier: bill.identifier,
      title: bill.title,
      jurisdictionName: bill.jurisdictionName,
      chamber: bill.chamber,
      latestActionAt: bill.latestActionAt,
      geminiSummary: bill.geminiSummary,
      subjects: bill.subjects,
      score
    } as RelatedBill;
  });
  
  // Sort by score and ensure strict geographic diversity
  const sortedBills = scoredBills
    .filter(bill => bill.score > 0) // Only return bills with some similarity
    .sort((a, b) => b.score - a.score);

  // Strict diversity: force one bill per jurisdiction, prioritizing different jurisdictions
  const currentJurisdiction = currentBill.jurisdictionName;
  const seenJurisdictions = new Set<string>();
  const diverseResults: RelatedBill[] = [];
  
  // First pass: collect the best bill from each different jurisdiction
  for (const bill of sortedBills) {
    if (bill.jurisdictionName !== currentJurisdiction && 
        !seenJurisdictions.has(bill.jurisdictionName) &&
        diverseResults.length < limit) {
      diverseResults.push(bill);
      seenJurisdictions.add(bill.jurisdictionName);
    }
  }
  
  // Second pass: if we still have space and the current jurisdiction has good matches, add them
  if (diverseResults.length < limit) {
    const sameJurisdictionBills = sortedBills.filter(bill => 
      bill.jurisdictionName === currentJurisdiction
    );
    
    for (const bill of sameJurisdictionBills) {
      if (diverseResults.length < limit) {
        diverseResults.push(bill);
      }
    }
  }

  return diverseResults;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple word-based similarity using Jaccard index
  const words1 = new Set(text1.split(/\s+/).filter(word => word.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(word => word.length > 3));
  
  if (words1.size === 0 && words2.size === 0) return 0;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}
