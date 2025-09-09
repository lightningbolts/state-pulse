
import fetch from 'node-fetch';
import { config } from 'dotenv';
import { upsertLegislation } from '@/services/legislationService';
import type { Legislation } from '@/types/legislation';

config({ path: require('path').resolve(__dirname, '../../.env') });

const API_KEY = process.env.US_CONGRESS_API_KEY || '';
const BASE_URL = 'https://api.congress.gov/v3';

if (!API_KEY) {
	console.error('US_CONGRESS_API_KEY environment variable is required');
	process.exit(1);
}

function usage() {
	console.log('Usage: tsx fetchOneCongressBill.ts <congress> <billType> <billNumber>');
	process.exit(1);
}


async function fetchAllFromUrl(url: string, key: string): Promise<any[]> {
	if (!url) return [];
	let results: any[] = [];
	let offset = 0;
	const limit = 100;
	let hasMore = true;
	while (hasMore) {
		const pagedUrl = url.includes('?') ? `${url}&offset=${offset}&limit=${limit}&api_key=${API_KEY}` : `${url}?offset=${offset}&limit=${limit}&api_key=${API_KEY}`;
		const res = await fetch(pagedUrl);
		if (!res.ok) break;
		const data: any = await res.json();
		let items = data[key] || data[key + 's'] || [];
		// Defensive: if items is not an array, try to convert or skip
		if (!Array.isArray(items)) {
			if (items && typeof items === 'object' && items.url) {
				// It's a nested object with a url, skip (avoid infinite loop)
				items = [];
			} else if (items && typeof items === 'object') {
				// Try to extract values if it's an object
				items = Object.values(items);
			} else {
				items = [];
			}
		}
		results.push(...items);
		if (items.length < limit) {
			hasMore = false;
		} else {
			offset += limit;
		}
	}
	return results;
}

function normalizeSponsor(s: any) {
	return {
		name: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
		id: s.bioguideId || s.id || null,
		entityType: 'person',
		primary: true,
	};
}

function normalizeCosponsor(s: any) {
	return {
		name: s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
		id: s.bioguideId || s.id || null,
		entityType: 'person',
		primary: false,
	};
}

async function normalizeBill(bill: any): Promise<Legislation> {
	// Fetch nested resources if only a URL/count is present
	let actions = Array.isArray(bill.actions) ? bill.actions : [];
	if (!actions.length && bill.actions?.url) {
		actions = await fetchAllFromUrl(bill.actions.url, 'actions');
	}

	let cosponsors = Array.isArray(bill.cosponsors) ? bill.cosponsors : [];
	if (!cosponsors.length && bill.cosponsors?.url) {
		cosponsors = await fetchAllFromUrl(bill.cosponsors.url, 'cosponsors');
	}

	let summaries = Array.isArray(bill.summaries) ? bill.summaries : [];
	if (!summaries.length && bill.summaries?.url) {
		summaries = await fetchAllFromUrl(bill.summaries.url, 'summaries');
	}

	let textVersions = Array.isArray(bill.textVersions) ? bill.textVersions : [];
	if (!textVersions.length && bill.textVersions?.url) {
		textVersions = await fetchAllFromUrl(bill.textVersions.url, 'textVersions');
	}

	let subjects = Array.isArray(bill.subjects) ? bill.subjects : [];
	if (!subjects.length && bill.subjects?.url) {
		subjects = await fetchAllFromUrl(bill.subjects.url, 'subjects');
		subjects = subjects.map((s: any) => s.name || s.subject || s);
	}

	// Sponsors
	let sponsors = Array.isArray(bill.sponsors) ? bill.sponsors.map(normalizeSponsor) : [];
	if (cosponsors.length) {
		sponsors = sponsors.concat(cosponsors.map(normalizeCosponsor));
	}

	// Sources
	const sources = [
		{ url: bill.legislationUrl || bill.congressdotgovUrl || bill.url, note: 'Congress.gov' }
	];

	// Abstracts (summaries)
	const abstracts = summaries.map((s: any) => ({ abstract: s.text || s.summary || s, note: 'Congress.gov summary' }));

	// Status text
	let statusText = bill.latestAction?.text || bill.statusText || bill.status || '';

	// Dates
	const firstActionAt = actions.length ? new Date(actions[0].actionDate || actions[0].date) : (bill.introducedDate ? new Date(bill.introducedDate) : undefined);
	const latestActionAt = actions.length ? new Date(actions[actions.length - 1].actionDate || actions[actions.length - 1].date) : undefined;
	const latestActionDescription = actions.length ? (actions[actions.length - 1].text || actions[actions.length - 1].action) : statusText;

	// Compose Legislation
	return {
		id: bill.billId || bill.id || `congress-bill-${bill.congress || ''}-${bill.type?.toLowerCase() || ''}-${bill.number || ''}`,
		identifier: bill.billNumber || bill.identifier || `${bill.type || ''} ${bill.number || ''}`.trim(),
		title: bill.title || bill.titleText || bill.shortTitle,
		session: bill.congress ? `${bill.congress}th Congress` : undefined,
		jurisdictionId: 'ocd-jurisdiction/country:us/legislature',
		jurisdictionName: 'United States Congress',
		chamber: bill.originChamber?.toLowerCase() || bill.chamber?.toLowerCase() || undefined,
		classification: [bill.type?.toLowerCase() || bill.billType?.toLowerCase() || ''],
		subjects,
		statusText,
		sponsors,
		sources,
		abstracts,
		openstatesUrl: undefined,
		congressUrl: bill.legislationUrl || bill.congressdotgovUrl || bill.url,
		firstActionAt,
		latestActionAt,
		latestActionDescription,
		latestPassageAt: undefined,
		createdAt: bill.introducedDate ? new Date(bill.introducedDate) : new Date(),
		updatedAt: new Date(),
		stateLegislatureUrl: '',
		fullText: undefined,
		geminiSummary: undefined,
		longGeminiSummary: undefined,
		geminiSummarySource: undefined,
		summary: abstracts.length ? abstracts[0].abstract : undefined,
		extras: bill,
	};
}

async function main() {
	const [,, congress, billType, billNumber] = process.argv;
	if (!congress || !billType || !billNumber) usage();

	const url = `${BASE_URL}/bill/${congress}/${billType}/${billNumber}?api_key=${API_KEY}`;
	console.log(`Fetching: ${url}`);
	try {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Failed to fetch bill: ${res.status} ${res.statusText}`);
		}
		const data: any = await res.json();
		const bill = data.bill || data.bills?.[0] || data;
		if (!bill) throw new Error('No bill data found in response');

		const legislation = await normalizeBill(bill);
		await upsertLegislation(legislation);
		console.log('Upserted bill to MongoDB:', legislation.id);
	} catch (err) {
		console.error('Error:', err);
		process.exit(1);
	}
}

main();
