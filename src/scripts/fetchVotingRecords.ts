import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { buildCongressBillId } from '@/lib/congressBillId';
import { upsertVotingRecord } from '../services/votingRecordService';
import { VotingRecord, MemberVote } from '../types/legislation';
import { config } from 'dotenv';
const yaml = require('js-yaml');

// Load environment variables
config({ path: require('path').resolve(__dirname, '../../.env') });

const API_KEY = process.env.US_CONGRESS_API_KEY || '';
const BASE_URL = 'https://api.congress.gov/v3';
const CONGRESS = 119;
const SESSION = getCurrentCongressSession(CONGRESS);

function getCongressFirstYear(congress: number): number {
  return (congress - 1) * 2 + 1789;
}

function getCurrentCongressSession(congress: number): number {
  const firstYear = getCongressFirstYear(congress);
  const currentYear = new Date().getFullYear();
  return Math.min(Math.max(currentYear - firstYear + 1, 1), 2);
}

function getSessionsInRange(congress: number, since: Date): number[] {
  const firstYear = getCongressFirstYear(congress);
  const sinceSession = Math.min(Math.max(since.getFullYear() - firstYear + 1, 1), 2);
  const currentSession = getCurrentCongressSession(congress);
  const sessions: number[] = [];

  for (let session = sinceSession; session <= currentSession; session++) {
    sessions.push(session);
  }

  return sessions.length > 0 ? sessions : [currentSession];
}

const SENATE_MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseSenateMenuDate(dateText: string, congressYear: number): Date | null {
  const shortMatch = dateText.match(/^(\d{1,2})-([A-Za-z]{3})$/);
  if (shortMatch) {
    const month = SENATE_MONTHS[shortMatch[2]];
    if (month === undefined) return null;
    return new Date(congressYear, month, Number(shortMatch[1]));
  }

  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface SenateVoteLink {
  url: string;
  voteNumber: string;
  voteDate: Date;
  session: number;
}

interface FetchOptions {
  since: Date;
  chamber: 'house' | 'senate' | 'both';
  isBackfill: boolean;
}

function parseCliArgs(): FetchOptions {
  const args = process.argv.slice(2);
  let since: Date | null = null;
  let chamber: FetchOptions['chamber'] = 'both';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--since' && args[i + 1]) {
      since = parseSinceArg(args[++i]);
    } else if (arg === '--chamber' && args[i + 1]) {
      chamber = parseChamberArg(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!since) {
    return { since: getDefaultSince(), chamber: 'both', isBackfill: false };
  }

  return { since, chamber, isBackfill: true };
}

function parseSinceArg(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    console.error(`Invalid --since date: ${value}. Use YYYY-MM-DD.`);
    process.exit(1);
  }

  return startOfDay(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function parseChamberArg(value: string): FetchOptions['chamber'] {
  const normalized = value.toLowerCase();
  if (normalized === 'house' || normalized === 'senate' || normalized === 'both') {
    return normalized;
  }

  console.error(`Invalid --chamber value: ${value}. Use house, senate, or both.`);
  process.exit(1);
}

function printUsage() {
  console.log(`Usage: npx tsx fetchVotingRecords.ts [options]

Options:
  --since YYYY-MM-DD   Backfill votes on or after this date (default: yesterday)
  --chamber CHAMBER    house, senate, or both (default: both)
  -h, --help           Show this help message

Examples:
  npx tsx fetchVotingRecords.ts
  npx tsx fetchVotingRecords.ts --since 2025-12-01
  npx tsx fetchVotingRecords.ts --since 2026-01-01 --chamber senate`);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDefaultSince(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return startOfDay(date);
}

function requireApiKey(chamber: FetchOptions['chamber']) {
  if (chamber !== 'senate' && !API_KEY) {
    console.error('US_CONGRESS_API_KEY environment variable is required for House votes');
    process.exit(1);
  }
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function isOnOrAfter(dateString: string, since: Date): boolean {
  if (!dateString) return false;
  return startOfDay(new Date(dateString)) >= startOfDay(since);
}

function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildSenateBioguideIdMap(yamlPath: string): Map<string, string> {
  try {
    const file = fs.readFileSync(yamlPath, 'utf8');
    const legislators = yaml.load(file) as any[];
    const map = new Map<string, string>();
    
    for (const leg of legislators) {
      if (!leg.terms) continue;
      const currentSenTerm = leg.terms.find((t: any) => 
        t.type === 'sen' && (!t.end || new Date(t.end) >= new Date())
      );
      
      if (currentSenTerm) {
        const lastName = (leg.name && leg.name.last) ? leg.name.last.trim().toLowerCase() : '';
        const state = currentSenTerm.state;
        const key = `${normalizeName(lastName)}|${state}`;
        if (leg.id && leg.id.bioguide) {
          map.set(key, leg.id.bioguide);
        }
      }
    }
    
    return map;
  } catch (error) {
    log(`Warning: Could not load legislators file: ${error}`);
    return new Map();
  }
}

async function fetchSenateRollCallVoteLinks(since: Date): Promise<SenateVoteLink[]> {
  try {
    const sessions = getSessionsInRange(CONGRESS, since);
    log(`Fetching Senate roll call votes for session(s) ${sessions.join(', ')}...`);

    const links: SenateVoteLink[] = [];

    for (const session of sessions) {
      const menuUrl = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${session}.xml`;
      const res = await fetch(menuUrl);

      if (!res.ok) {
        log(`Failed to fetch Senate vote menu XML for session ${session}: ${res.status}`);
        continue;
      }

      const xml = await res.text();
      const congressYearMatch = xml.match(/<congress_year>(\d+)<\/congress_year>/);
      const congressYear = congressYearMatch
        ? Number(congressYearMatch[1])
        : getCongressFirstYear(CONGRESS) + session - 1;

      const voteBlocks = xml.match(/<vote>[\s\S]*?<\/vote>/g) ?? [];
      for (const block of voteBlocks) {
        const voteNumberMatch = block.match(/<vote_number>(\d+)<\/vote_number>/);
        const voteDateMatch = block.match(/<vote_date>(.*?)<\/vote_date>/);
        if (!voteNumberMatch || !voteDateMatch) continue;

        const voteNumber = String(Number(voteNumberMatch[1]));
        const voteDate = parseSenateMenuDate(voteDateMatch[1].trim(), congressYear);
        if (!voteDate) continue;

        const paddedVoteNumber = voteNumberMatch[1].padStart(5, '0');
        links.push({
          voteNumber,
          voteDate,
          session,
          url: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${session}/vote_${CONGRESS}_${session}_${paddedVoteNumber}.xml`,
        });
      }
    }

    links.sort((a, b) => b.voteDate.getTime() - a.voteDate.getTime());
    const recentLinks = links.filter((link) => startOfDay(link.voteDate) >= startOfDay(since));
    log(`Found ${recentLinks.length} Senate roll call votes since ${formatDateForAPI(since)} (${links.length} total in menu)`);
    return recentLinks;
  } catch (error) {
    log(`Error fetching Senate vote links: ${error}`);
    return [];
  }
}

function parseSenateVoteXml(
  xml: string,
  bioguideMap: Map<string, string>,
  session: number,
  voteNumber: string
): VotingRecord | null {
  const voteDateMatch = xml.match(/<vote_date>(.*?)<\/vote_date>/);
  const voteQuestionMatch =
    xml.match(/<vote_question_text>(.*?)<\/vote_question_text>/) ??
    xml.match(/<question>(.*?)<\/question>/);
  const resultMatch = xml.match(/<vote_result>(.*?)<\/vote_result>/);
  const documentTypeMatch = xml.match(/<document_type>(.*?)<\/document_type>/);
  const documentNumberMatch = xml.match(/<document_number>(.*?)<\/document_number>/);

  const dateText = voteDateMatch?.[1]?.trim() ?? '';
  const date = dateText ? new Date(dateText).toISOString() : '';
  const voteQuestion = voteQuestionMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const result = resultMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '';

  let legislationNumber = '';
  let legislationType = '';
  let bill_id: string | undefined;

  const documentType = documentTypeMatch?.[1]?.trim() ?? '';
  const documentNumber = documentNumberMatch?.[1]?.trim() ?? '';
  if (documentType && documentNumber && /^\d+$/.test(documentNumber)) {
    legislationType = documentType.replace(/\./g, '').trim();
    legislationNumber = documentNumber;
    bill_id = buildCongressBillId(CONGRESS, legislationType, legislationNumber);
  }

  const memberVotes: MemberVote[] = [];
  const memberBlocks = xml.match(/<member>[\s\S]*?<\/member>/g) ?? [];
  for (const block of memberBlocks) {
    const firstName = block.match(/<first_name>(.*?)<\/first_name>/)?.[1]?.trim() ?? '';
    const lastName = block.match(/<last_name>(.*?)<\/last_name>/)?.[1]?.trim() ?? '';
    const party = block.match(/<party>(.*?)<\/party>/)?.[1]?.trim() ?? '';
    const state = block.match(/<state>(.*?)<\/state>/)?.[1]?.trim() ?? '';
    const voteCast = block.match(/<vote_cast>(.*?)<\/vote_cast>/)?.[1]?.trim() ?? '';
    if (!lastName || !voteCast) continue;

    const key = `${normalizeName(lastName.toLowerCase())}|${state}`;
    memberVotes.push({
      bioguideId: bioguideMap.get(key) || '',
      firstName,
      lastName,
      voteCast,
      voteParty: party,
      voteState: state,
    });
  }

  return {
    identifier: `senate-${CONGRESS}-${voteNumber}`,
    rollCallNumber: Number(voteNumber),
    legislationType,
    legislationNumber,
    bill_id,
    voteQuestion,
    result,
    date,
    memberVotes,
    congress: CONGRESS,
    session,
    chamber: 'US Senate',
  };
}

async function fetchHouseRollCallVotes(since: Date): Promise<any[]> {
  try {
    let votes: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    const fromDate = formatDateForAPI(since);
    
    log(`Fetching House roll call votes from ${fromDate}...`);
    
    while (hasMore) {
      const url = `${BASE_URL}/house-vote/${CONGRESS}?api_key=${API_KEY}&offset=${offset}&limit=${limit}&fromDateTime=${fromDate}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        log(`Failed to fetch House votes: ${res.status}`);
        break;
      }
      
      const data: any = await res.json();
      if (data.houseRollCallVotes && data.houseRollCallVotes.length > 0) {
        const recentVotes = data.houseRollCallVotes.filter((vote: any) =>
          isOnOrAfter(vote.startDate, since)
        );
        
        votes.push(...recentVotes);
        offset += limit;
        hasMore = data.houseRollCallVotes.length === limit;
        
        if (recentVotes.length === 0 && data.houseRollCallVotes.length > 0) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    log(`Fetched ${votes.length} House roll call votes since ${fromDate}`);
    return votes;
  } catch (error) {
    log(`Error fetching House votes: ${error}`);
    return [];
  }
}

async function fetchMemberVotes(voteNumber: number, session: number): Promise<MemberVote[]> {
  try {
    const url = `${BASE_URL}/house-vote/${CONGRESS}/${session}/${voteNumber}/members?api_key=${API_KEY}`;
    const res = await fetch(url);
    
    if (!res.ok) return [];
    
    const data: any = await res.json();
    if (!data.houseRollCallVoteMemberVotes?.results) return [];
    
    return data.houseRollCallVoteMemberVotes.results.map((item: any) => ({
      bioguideId: item.bioguideID,
      firstName: item.firstName,
      lastName: item.lastName,
      voteCast: item.voteCast,
      voteParty: item.voteParty,
      voteState: item.voteState,
    }));
  } catch (error) {
    return [];
  }
}

function buildBillIdIfPresent(
  congress: number,
  type?: string,
  number?: string | number
): string | undefined {
  if (!type || number === undefined || number === null || String(number).trim() === '') {
    return undefined;
  }

  return buildCongressBillId(congress, type, number);
}

async function processHouseVotes(since: Date): Promise<number> {
  let processedCount = 0;
  
  try {
    const votes = await fetchHouseRollCallVotes(since);
    
    for (const vote of votes) {
      try {
        const voteSession = Number(vote.session ?? vote.sessionNumber ?? SESSION);
        const memberVotes = await fetchMemberVotes(vote.rollCallNumber, voteSession);
        
        const legislationType = vote.legislationType ?? '';
        const legislationNumber = vote.legislationNumber != null ? String(vote.legislationNumber) : '';

        const votingRecord: VotingRecord = {
          identifier: vote.identifier,
          rollCallNumber: vote.rollCallNumber,
          legislationType,
          legislationNumber,
          bill_id: buildBillIdIfPresent(CONGRESS, legislationType, legislationNumber),
          voteQuestion: vote.voteQuestion,
          result: vote.result,
          date: vote.startDate,
          memberVotes,
          congress: CONGRESS,
          session: voteSession,
          chamber: 'US House',
        };
        
        await upsertVotingRecord(votingRecord);
        processedCount++;

        if (processedCount % 25 === 0) {
          log(`House backfill progress: ${processedCount}/${votes.length}`);
        }
      } catch (error) {
        log(`Error processing House vote ${vote.rollCallNumber}: ${error}`);
      }
    }
  } catch (error) {
    log(`Error in processHouseVotes: ${error}`);
  }
  
  log(`House votes processed: ${processedCount}`);
  return processedCount;
}

async function processSenateVotes(since: Date): Promise<number> {
  let processedCount = 0;
  let skippedCount = 0;
  
  try {
    const yamlPath = path.resolve(__dirname, 'legislators-current.yaml');
    const bioguideMap = buildSenateBioguideIdMap(yamlPath);
    const senateVoteLinks = await fetchSenateRollCallVoteLinks(since);

    log(`Processing ${senateVoteLinks.length} Senate vote links...`);

    for (const link of senateVoteLinks) {
      try {
        const res = await fetch(link.url);
        if (!res.ok) {
          log(`Failed to fetch Senate vote ${link.voteNumber}: ${res.status}`);
          continue;
        }

        const votingRecord = parseSenateVoteXml(
          await res.text(),
          bioguideMap,
          link.session,
          link.voteNumber
        );
        if (!votingRecord) continue;

        if (!isOnOrAfter(votingRecord.date, since)) {
          skippedCount++;
          continue;
        }

        await upsertVotingRecord(votingRecord);
        processedCount++;

        if (processedCount % 25 === 0) {
          log(`Senate backfill progress: ${processedCount}/${senateVoteLinks.length}`);
        }
      } catch (error) {
        log(`Error processing Senate vote ${link.voteNumber}: ${error}`);
      }
    }
    
    log(`Senate votes processed: ${processedCount}, skipped (before since): ${skippedCount}`);
  } catch (error) {
    log(`Error in processSenateVotes: ${error}`);
  }
  
  return processedCount;
}

async function fetchVotingRecords(options?: FetchOptions) {
  const startTime = Date.now();
  const { since, chamber, isBackfill } = options ?? parseCliArgs();
  
  log(isBackfill ? 'Starting voting records backfill...' : 'Starting daily voting records fetch...');
  log(`Fetching ${chamber} voting records from ${formatDateForAPI(since)} onwards`);
  
  try {
    const tasks: Promise<number>[] = [];
    if (chamber === 'house' || chamber === 'both') {
      tasks.push(processHouseVotes(since));
    }
    if (chamber === 'senate' || chamber === 'both') {
      tasks.push(processSenateVotes(since));
    }

    const counts = await Promise.all(tasks);
    const houseCount = chamber === 'senate' ? 0 : counts[0] ?? 0;
    const senateCount = chamber === 'both' ? counts[1] ?? 0 : chamber === 'senate' ? counts[0] ?? 0 : 0;
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalProcessed = houseCount + senateCount;
    
    log(`Completed voting records fetch in ${duration}s`);
    log(`Processed ${totalProcessed} records (House: ${houseCount}, Senate: ${senateCount})`);
    
    return { success: true, houseCount, senateCount, totalProcessed };
  } catch (error) {
    log(`Error in fetchVotingRecords: ${error}`);
    return { success: false, error: String(error) };
  }
}

// Main execution
async function main() {
  const options = parseCliArgs();
  requireApiKey(options.chamber);
  const result = await fetchVotingRecords(options);
  
  if (result.success) {
    log(options.isBackfill ? 'Voting records backfill completed successfully' : 'Daily voting records fetch completed successfully');
    process.exit(0);
  } else {
    log('Voting records fetch failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { fetchVotingRecords, type FetchOptions };
