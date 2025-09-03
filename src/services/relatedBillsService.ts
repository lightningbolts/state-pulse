import { getCollection } from '@/lib/mongodb';
import { Legislation } from '@/types/legislation';

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

// Simple in-memory cache for related bills (in production, you'd use Redis or similar)
const relatedBillsCache = new Map<string, { data: RelatedBill[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of relatedBillsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      relatedBillsCache.delete(key);
    }
  }
}, CACHE_TTL); // Run cleanup every 5 minutes

export async function getRelatedBills(
  currentBill: Legislation,
  limit: number = 3
): Promise<RelatedBill[]> {
  // Check cache first
  const cacheKey = `${currentBill.id}-${limit}`;
  const cached = relatedBillsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const collection = await getCollection('legislation');
  
  // Step 1: Build targeted query based on current bill's content
  const matchConditions: any[] = [{ id: { $ne: currentBill.id } }];
  
  // If current bill has subjects, prioritize bills with shared subjects
  if (currentBill.subjects && currentBill.subjects.length > 0) {
    matchConditions.push({
      subjects: { $in: currentBill.subjects }
    });
  }
  
  // Step 2: Get targeted candidates with optimized query
  const targetedBills = await collection
    .find(
      { $and: matchConditions },
      {
        projection: {
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
    )
    .limit(300) // Reduced from 500 for better performance
    .toArray();
  
  // Step 3: If we don't have enough candidates, get some random ones for diversity
  let allCandidates = targetedBills;
  
  if (targetedBills.length < 100) {
    const additionalBills = await collection
      .aggregate([
        {
          $match: { 
            id: { $ne: currentBill.id },
            $nor: matchConditions.slice(1), // Exclude bills we already have
            $or: [
              { subjects: { $exists: true, $ne: [] } },
              { 
                $and: [
                  { geminiSummary: { $exists: true } },
                  { geminiSummary: { $ne: null } },
                  { geminiSummary: { $ne: '' } }
                ]
              }
            ]
          }
        },
        { $sample: { size: 100 } }, // Reduced from 200
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
      
    allCandidates = [...targetedBills, ...additionalBills as any];
  }

  const scoredBills = allCandidates.map((bill: any) => {
    let score = 0;
    
    // Fast subject similarity (highest weight) - optimized
    if (currentBill.subjects && bill.subjects) {
      const currentSubjects = new Set(currentBill.subjects.map((s: string) => s.toLowerCase()));
      const billSubjects = new Set(bill.subjects.map((s: string) => s.toLowerCase()));
      const intersection = new Set([...currentSubjects].filter(x => billSubjects.has(x)));
      
      if (intersection.size > 0) {
        const union = new Set([...currentSubjects, ...billSubjects]);
        const jaccardSimilarity = intersection.size / union.size;
        score += jaccardSimilarity * 50; // Weight: 50 points max
      }
    }
    
    // Fast title similarity (medium weight) - simplified word overlap
    if (currentBill.title && bill.title) {
      const currentWords = new Set(currentBill.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
      const billWords = new Set(bill.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
      const commonWords = [...currentWords].filter(w => billWords.has(w));
      
      if (commonWords.length > 0) {
        const titleSimilarity = commonWords.length / Math.max(currentWords.size, billWords.size);
        score += titleSimilarity * 30; // Weight: 30 points max
      }
    }
    
    // Light summary similarity (lower weight) - only for high-scoring candidates
    if (score > 20 && currentBill.geminiSummary && bill.geminiSummary) {
      const currentWords = new Set(
        currentBill.geminiSummary.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 4)
          .slice(0, 50) // Only compare first 50 meaningful words
      );
      const billWords = new Set(
        bill.geminiSummary.toLowerCase()
          .split(/\s+/)
          .filter((w: string) => w.length > 4)
          .slice(0, 50)
      );
      const commonWords = [...currentWords].filter(w => billWords.has(w));
      
      if (commonWords.length > 0) {
        const summarySimilarity = commonWords.length / Math.max(currentWords.size, billWords.size);
        score += summarySimilarity * 15; // Reduced weight: 15 points max
      }
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

  // Cache the results before returning
  relatedBillsCache.set(cacheKey, { data: diverseResults, timestamp: Date.now() });
  
  return diverseResults;
}
