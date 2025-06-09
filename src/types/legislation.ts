import type { Timestamp } from "firebase/firestore";

// Represents the structure of a legislative session, often part of jurisdiction or bill details
export interface OpenStatesLegislativeSession {
  identifier: string;
  name: string;
  classification?: string; // e.g., "primary", "special"
  start_date?: string;
  end_date?: string;
}

// Represents an organization (e.g., a legislative body, committee, or chamber)
export interface OpenStatesOrganization {
  id: string; // OCD ID, e.g., "ocd-organization/..."
  name: string;
  classification: string; // e.g., "legislature", "upper", "lower", "committee"
}

// Represents a sponsor of a bill
export interface OpenStatesSponsor {
  id?: string; // OpenStates specific ID for the sponsorship link itself
  name: string; // Name of the sponsor
  entity_type?: 'person' | 'organization' | string | null; // Type of sponsor
  primary?: boolean | null; // Is this a primary sponsor?
  classification?: string | null; // e.g., "primary", "cosponsor"
  person_id?: string | null; // OCD ID if sponsor is a person (references OpenStatesPerson.id)
  organization_id?: string | null; // OCD ID if sponsor is an organization (references OpenStatesOrganization.id)
}

// Represents a link associated with a bill version, person, or source
export interface OpenStatesLink {
  url: string;
  media_type?: string | null; // e.g., "application/pdf", "text/html"
  note?: string | null;
}

// Represents a version of a bill's text
export interface OpenStatesVersion {
  id?: string; // OpenStates specific ID for this version
  note: string; // Description of the version, e.g., "Introduced", "Enrolled"
  date: string; // Date of the version (can be an empty string if not specified)
  classification: string; // Classification of the version (can be an empty string)
  links?: OpenStatesLink[] | null;
}

// Represents an action taken on a bill (history event)
export interface OpenStatesAction {
  id?: string; // OpenStates specific ID for this action
  organization: OpenStatesOrganization; // The organization responsible for the action
  description: string; // Text description of the action
  date: string; // Date of the action (full timestamp or YYYY-MM-DD)
  classification?: string[] | null; // Standardized classifications, e.g., ["passage", "committee-referral"]
  order: number; // Order of the action
  related_entities?: any[] | null; // Other entities related to this action
}

// Represents an abstract or summary of a bill
export interface OpenStatesAbstract {
  abstract: string;
  note?: string | null; // e.g., "summary", "fiscal note"
}

// Represents a source URL for a bill
export interface OpenStatesBillSource extends OpenStatesLink {
  // Inherits url, media_type, note from OpenStatesLink
}

// Represents the jurisdiction to which a bill or person belongs
export interface OpenStatesJurisdiction {
  id: string; // OCD ID, e.g., "ocd-jurisdiction/country:us/state:al/government"
  name: string;
  classification: 'state' | 'country' | 'municipality' | string; // Type of jurisdiction
}

// Main interface representing a bill from the OpenStates API
export interface OpenStatesBill {
  id: string; // OpenStates bill ID, e.g., "ocd-bill/..."
  identifier: string; // Human-readable bill identifier, e.g., "HB 101", "SB 271"
  title: string;
  session: string; // Identifier for the legislative session, e.g., "2023rs"
  jurisdiction: OpenStatesJurisdiction;

  classification?: string[] | null;
  subject?: string[] | string | null;

  from_organization?: OpenStatesOrganization | null;

  created_at: string;
  updated_at: string;
  openstates_url: string;

  first_action_date?: string | null;
  latest_action_date?: string | null;
  latest_action_description?: string | null;
  latest_passage_date?: string | null;

  status?: string[] | string | null;

  abstracts?: OpenStatesAbstract[] | null;
  sponsorships?: OpenStatesSponsor[] | null;
  actions?: OpenStatesAction[] | null;
  versions?: OpenStatesVersion[] | null;
  sources?: OpenStatesBillSource[] | null;

  extras?: Record<string, any> | null;
}

// Represents a contact detail for a person (generic)
export interface OpenStatesContactDetail {
  type: 'address' | 'email' | 'phone' | 'fax' | string;
  value: string;
  note?: string | null;
  label?: string | null;
}

// Represents an office location and its contact details for a person
export interface OpenStatesOffice {
  name: string; // e.g., "District Office", "Capitol Office"
  classification: 'capitol' | 'district' | string; // Type of office
  address?: string | null; // Full address string
  voice?: string | null; // Phone number
  fax?: string | null; // Fax number
}

// Represents a role held by a person (detailed, often historical)
export interface OpenStatesRole {
  term: string;
  jurisdiction: OpenStatesJurisdiction;
  organization: OpenStatesOrganization;
  classification: 'member' | 'speaker' | 'committee member' | string;
  district?: string | number | null;
  division_id?: string | null; // Added based on example
  start_date?: string | null;
  end_date?: string | null;
  title?: string | null; // Role title, e.g., "Senator", "Representative"
}

// Represents the summarized current role of a person
export interface OpenStatesCurrentRole {
  title: string; // e.g., "Senator"
  org_classification: 'upper' | 'lower' | string; // e.g., "upper" for Senate
  district?: string | number | null;
  division_id?: string | null; // e.g., "ocd-division/country:us/state:nc/sldu:3"
  // You might add other fields from the detailed role if they are consistently present here
}

// Represents other identifiers for a person
export interface OpenStatesIdentifier {
  identifier: string;
  scheme: string; // e.g., "legacy_openstates"
  note?: string | null;
}

// Represents other names for a person
export interface OpenStatesOtherName {
  name: string;
  note?: string | null; // e.g., "nickname"
}

// Represents a person (e.g., legislator) from the OpenStates API
export interface OpenStatesPerson {
  id: string; // OCD ID, e.g., "ocd-person/..."
  name: string; // Full name
  party?: string | null; // Political party affiliation
  current_role?: OpenStatesCurrentRole | null; // Summarized current role
  jurisdiction?: OpenStatesJurisdiction | null; // Jurisdiction the person belongs to

  given_name?: string | null;
  family_name?: string | null;
  image?: string | null; // URL to a photo
  email?: string | null; // Direct email if available
  gender?: string | null;
  birth_date?: string | null; // YYYY-MM-DD
  death_date?: string | null; // YYYY-MM-DD

  extras?: Record<string, any> | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  openstates_url: string; // URL to the person on OpenStates.org

  other_identifiers?: OpenStatesIdentifier[] | null;
  other_names?: OpenStatesOtherName[] | null;
  links?: OpenStatesLink[] | null; // Links to websites, social media
  sources?: OpenStatesLink[] | null; // Source URLs for this person's data
  offices?: OpenStatesOffice[] | null; // List of office locations and contacts

  roles?: OpenStatesRole[] | null; // List of all roles, current and past (more detailed)
  contact_details?: OpenStatesContactDetail[] | null; // Generic contact details
  biography?: string | null;
}

// API response types
export interface OpenStatesApiBillListResponse {
  pagination: {
    page: number;
    per_page: number;
    max_page: number;
    total_items: number;
  };
  results: OpenStatesBill[];
}

export interface OpenStatesApiPersonListResponse {
  pagination: {
    page: number;
    per_page: number;
    max_page: number;
    total_items: number;
  };
  results: OpenStatesPerson[];
}
