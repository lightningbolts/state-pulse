export interface ExecutiveOrder {
  id: string; // unique, e.g. ca-eo-n-19-25, us-eo-14567
  state: string; // "United States" for presidential, otherwise state name
  governor_or_president: string; // e.g. "Gavin Newsom" or "Joe Biden"
  title: string;
  number: string | null; // EO number (may be null for some states)
  date_signed: Date;
  full_text_url: string;
  summary?: string | null; // preprovided summary if available
  geminiSummary?: string | null; // AI-generated summary
  topics: string[]; // e.g. ["climate", "emergency"]
  createdAt: Date;
  updatedAt?: Date;
  full_text?: string | null; // extracted text content
  source_type: 'federal_register' | 'governor_website'; // source of the data
  raw_data?: Record<string, any>; // store original API/scraper response
}

// Federal Register API response types
export interface FederalRegisterDocument {
  document_number: string;
  title: string;
  type: string;
  abstract: string;
  document_number: string;
  html_url: string;
  pdf_url: string;
  publication_date: string;
  signing_date: string;
  start_page: number;
  end_page: number;
  page_length: number;
  correction_of?: string;
  agencies: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  topics: string[];
  significant: boolean;
}

export interface FederalRegisterResponse {
  count: number;
  description: string;
  results: FederalRegisterDocument[];
  next_page_url?: string;
  previous_page_url?: string;
}

// Governor scraper interfaces
export interface GovernorScrapedOrder {
  number?: string;
  title: string;
  date_signed: Date;
  url: string;
  summary?: string;
  topics?: string[];
}

export interface GovernorScraper {
  state: string;
  governorName: string;
  scrape(): Promise<GovernorScrapedOrder[]>;
}

// MongoDB document types
export interface ExecutiveOrderMongoDocument extends Omit<ExecutiveOrder, 'id' | 'createdAt' | 'updatedAt'> {
  _id?: any;
  createdAt: Date;
  updatedAt: Date;
}
