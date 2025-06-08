import type { Timestamp } from "firebase/firestore";

export interface LegislationSponsor {
  name: string;
  id?: string; // Optional: An identifier for the sponsor from the source system
}

export interface LegislationHistoryEvent {
  date: Timestamp; // Use Firestore Timestamp for dates
  action: string; // e.g., "Introduced", "Passed Committee", "Voted On"
  actor: string; // e.g., "House", "Senate", "Committee on Judiciary"
  details?: string; // Optional additional details
}

export interface Legislation {
  id?: string; // Firestore document ID will be auto-generated if not provided on creation
  title: string;
  billNumber: string; // e.g., "H.R. 123", "S.B. 45"
  jurisdiction: string; // e.g., "CA", "TX", "US" (for federal)
  status: string; // e.g., "Introduced", "In Committee", "Passed House", "Enacted", "Failed"
  summary?: string;
  fullTextUrl?: string; // URL to the full text of the bill
  sponsors: LegislationSponsor[];
  introductionDate?: Timestamp;
  lastActionDate?: Timestamp;
  history?: LegislationHistoryEvent[];
  tags?: string[]; // e.g., ["education", "healthcare", "environment"]
  sourceId?: string; // An ID from the original data source (e.g., OpenStates ID) for easier updates/deduplication
  chamber?: 'House' | 'Senate' | 'Joint' | 'Unicameral' | string; // Primary chamber
  fiscalImpact?: string;
  effectiveDate?: Timestamp;
  versions?: Array<{ date: Timestamp; url: string; name: string }>;
}
