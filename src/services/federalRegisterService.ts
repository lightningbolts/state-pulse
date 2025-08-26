import fetch from 'node-fetch';
import { FederalRegisterResponse, FederalRegisterDocument, ExecutiveOrder } from '../types/executiveOrder';
import { upsertExecutiveOrder } from '../services/executiveOrderService';
import pdf from 'pdf-parse';

export class FederalRegisterClient {
  private baseUrl = 'https://www.federalregister.gov/api/v1';

  /**
   * Fetch executive orders from Federal Register API
   * @param daysBack - Number of days to look back for new orders (default: 7)
   * @param perPage - Results per page (default: 100, max: 1000)
   */
  async fetchExecutiveOrders(daysBack: number = 7, perPage: number = 100): Promise<FederalRegisterDocument[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    const params = new URLSearchParams({
      'conditions[type]': 'PRESDOCU',
      'conditions[presidential_document_type]': 'executive_order',
      'conditions[publication_date][gte]': startDate.toISOString().split('T')[0],
      'conditions[publication_date][lte]': endDate.toISOString().split('T')[0],
      'per_page': perPage.toString(),
      'order': 'newest'
    });

    const url = `${this.baseUrl}/documents.json?${params}`;
    console.log(`Fetching executive orders from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Federal Register API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Handle case where results might not exist or be empty
    if (!data.results || !Array.isArray(data.results)) {
      console.log('No results found or results is not an array');
      return [];
    }

    console.log(`Found ${data.results.length} executive orders from Federal Register`);
    return data.results;
  }

  /**
   * Extract text content from PDF URL
   */
  async extractPdfText(pdfUrl: string): Promise<string | null> {
    try {
      console.log(`Extracting text from PDF: ${pdfUrl}`);
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        console.warn(`Failed to fetch PDF: ${response.status}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const data = await pdf(Buffer.from(buffer));
      return data.text;
    } catch (error) {
      console.error(`Error extracting PDF text from ${pdfUrl}:`, error);
      return null;
    }
  }

  /**
   * Extract president name from executive order data
   */
  private extractPresidentName(doc: FederalRegisterDocument): string {
    // Try to extract from title first (e.g., "Executive Order 14001 of January 20, 2021")
    const titleMatch = doc.title.match(/by President (\w+\s+\w+)/i);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Determine by signing date ranges
    const signingDate = new Date(doc.signing_date || doc.publication_date);

    if (signingDate >= new Date('2025-01-20')) {
      return 'Donald Trump';
    } else if (signingDate >= new Date('2021-01-20')) {
      return 'Joe Biden';
    } else if (signingDate >= new Date('2017-01-20')) {
      return 'Donald Trump';
    } else if (signingDate >= new Date('2009-01-20')) {
      return 'Barack Obama';
    } else if (signingDate >= new Date('2001-01-20')) {
      return 'George W. Bush';
    } else {
      return 'Unknown President'; // Fallback
    }
  }

  /**
   * Convert Federal Register document to ExecutiveOrder format
   */
  async convertToExecutiveOrder(doc: FederalRegisterDocument): Promise<ExecutiveOrder> {
    // Extract executive order number from title (e.g., "Executive Order 14001")
    const numberMatch = doc.title.match(/Executive Order (\d+)/i);
    const number = numberMatch ? numberMatch[1] : null;

    // Generate unique ID
    const id = `us-eo-${number || doc.document_number}`;

    // Extract PDF text if available
    let fullText: string | null = null;
    if (doc.pdf_url) {
      fullText = await this.extractPdfText(doc.pdf_url);
    }

    // Extract topics from agencies and existing topics with null checks
    const topics: string[] = [];

    // Add topics if they exist and are an array
    if (doc.topics && Array.isArray(doc.topics)) {
      topics.push(...doc.topics.map(topic => topic.toLowerCase()));
    }

    // Add agency names if they exist and are an array
    if (doc.agencies && Array.isArray(doc.agencies)) {
      topics.push(...doc.agencies.map(agency => agency.name.toLowerCase()));
    }

    // Deduplicate topics
    const uniqueTopics = topics.filter((topic, index, arr) => arr.indexOf(topic) === index);

    return {
      id,
      state: 'United States',
      governor_or_president: this.extractPresidentName(doc), // Extract from data instead of hardcode
      title: doc.title,
      number,
      date_signed: new Date(doc.signing_date || doc.publication_date),
      full_text_url: doc.html_url,
      summary: doc.abstract || null,
      topics: uniqueTopics,
      createdAt: new Date(),
      full_text: fullText,
      source_type: 'federal_register',
      raw_data: doc
    };
  }
}

/**
 * Main function to fetch and store federal executive orders
 */
export async function fetchFederalExecutiveOrders(daysBack: number = 7): Promise<void> {
  console.log('Starting Federal Register executive order fetch...');

  const client = new FederalRegisterClient();

  try {
    const documents = await client.fetchExecutiveOrders(daysBack);

    let processed = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        const executiveOrder = await client.convertToExecutiveOrder(doc);
        await upsertExecutiveOrder(executiveOrder);
        processed++;

        // Add small delay to avoid overwhelming the PDF extraction
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing document ${doc.document_number}:`, error);
        errors++;
      }
    }

    console.log(`Federal Register fetch completed: ${processed} processed, ${errors} errors`);
  } catch (error) {
    console.error('Error fetching from Federal Register:', error);
    throw error;
  }
}
