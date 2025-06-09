import type { Timestamp } from "firebase/firestore";
import type { components } from "./openstates.types.d.ts"; // Import OpenStates types

// Re-exporting specific OpenStates types for clarity if needed elsewhere, or they can be imported directly
export type OpenStatesBill = components["schemas"]["Bill"];
export type OpenStatesJurisdiction = components["schemas"]["CompactJurisdiction"];
export type OpenStatesOrganization = components["schemas"]["Organization"];
export type OpenStatesSponsor = components["schemas"]["BillSponsorship"];
export type OpenStatesLink = components["schemas"]["Link"];
export type OpenStatesVersion = components["schemas"]["BillDocumentOrVersion"];
export type OpenStatesAction = components["schemas"]["BillAction"];
export type OpenStatesAbstract = components["schemas"]["BillAbstract"];
export type OpenStatesLegislativeSession = components["schemas"]["LegislativeSession"];

// Firestore-specific types for storing legislation data

export interface FirestoreLegislationSponsor {
  name: string;
  // id from OpenStatesSponsor is 'id' (uuid), person_id/organization_id are not directly on BillSponsorship
  // We'll use the 'id' of the person or organization linked in the sponsorship
  id: string | null;
  entityType: string | null; // 'person' | 'organization' from BillSponsorship.entity_type
  primary: boolean | null;
  classification: string | null; // from BillSponsorship.classification
  personId?: string | null; // OCD ID if sponsor is a person
  organizationId?: string | null; // OCD ID if sponsor is an organization
}

export interface FirestoreLegislationHistoryEvent {
  date: Timestamp; // Firestore Timestamp from BillAction.date
  action: string; // Description of the action from BillAction.description
  actor: string; // Organization name from BillAction.organization.name
  classification?: string[] | null; // from BillAction.classification
  order?: number; // from BillAction.order
}

export interface FirestoreLegislationVersionLink {
  url: string; // from BillDocumentLink.url
  media_type?: string | null; // from BillDocumentLink.media_type
  // note is not directly available on BillDocumentLink, but on BillDocumentOrVersion itself
}

export interface FirestoreLegislationVersion {
  note: string; // Description of the version from BillDocumentOrVersion.note
  date: Timestamp | null; // Firestore Timestamp from BillDocumentOrVersion.date
  classification?: string | null; // from BillDocumentOrVersion.classification
  links?: FirestoreLegislationVersionLink[] | null; // from BillDocumentOrVersion.links
}

export interface FirestoreLegislationSourceLink {
  url: string; // from Link.url
  note?: string | null; // from Link.note
  // media_type is not directly on the main Bill.sources Link, but could be on version links
}

export interface FirestoreLegislationAbstract {
  abstract: string; // from BillAbstract.abstract
  note?: string | null; // from BillAbstract.note
}

export interface FirestoreLegislation {
  id: string; // OpenStates bill ID (ocd-bill/...) from Bill.id
  identifier: string; // Human-readable bill identifier (e.g., "HB 101") from Bill.identifier
  title: string; // from Bill.title
  session: string; // Session identifier (e.g., "2023rs") from Bill.session

  jurisdictionId: string; // OCD ID of the jurisdiction from Bill.jurisdiction.id
  jurisdictionName: string; // Name of the jurisdiction from Bill.jurisdiction.name

  chamber?: string | null; // Deduced from Bill.from_organization.classification or Bill.jurisdiction.classification

  classification?: string[] | null; // Bill type, e.g., ["bill", "resolution"] from Bill.classification
  subjects?: string[] | null; // Topics/subjects of the bill from Bill.subject

  statusText?: string | null; // Potentially derived from latest_action_description or a custom logic

  sponsors: FirestoreLegislationSponsor[];
  history: FirestoreLegislationHistoryEvent[];
  versions?: FirestoreLegislationVersion[] | null;
  sources?: FirestoreLegislationSourceLink[] | null; // from Bill.sources
  abstracts?: FirestoreLegislationAbstract[] | null; // from Bill.abstracts

  openstatesUrl: string; // URL to the bill on OpenStates.org from Bill.openstates_url

  firstActionAt: Timestamp | null; // from Bill.first_action_date
  latestActionAt: Timestamp | null; // from Bill.latest_action_date
  latestActionDescription: string | null; // from Bill.latest_action_description
  latestPassageAt?: Timestamp | null; // from Bill.latest_passage_date

  createdAt: Timestamp; // Firestore Timestamp from Bill.created_at
  updatedAt: Timestamp; // Firestore Timestamp from Bill.updated_at

  // Optional fields for additional data
  summary?: string | null; // This can be one of the abstracts or an AI-generated summary
  aiSummary?: {
    short?: string;
    medium?: string;
    long?: string;
    lastGeneratedAt?: Timestamp;
  } | null;
  tags?: string[] | null; // Could be same as subjects or enhanced
  fiscalNoteUrl?: string | null; // Not directly in OpenStates Bill, might be in extras or links
  committee?: string | null; // Name of the primary committee, might need to be derived

  extras?: Record<string, any> | null; // For any other data from Bill.extras
}

// --- Person Types (Example, if you were to store People) ---
// export interface FirestorePerson { ... }
// --- End Person Types ---

// API response types from openstates.types.d.ts are already defined
// e.g. operations["bills_search_bills_get"]["responses"]["200"]["content"]["application/json"]
// or components["schemas"]["BillList"]

// We can keep these for simpler import if desired, but they are essentially wrappers now.
export type OpenStatesApiBillListResponse = components["schemas"]["BillList"];
export type OpenStatesApiPersonListResponse = components["schemas"]["PersonList"];
