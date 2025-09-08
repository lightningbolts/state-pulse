import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { upsertVotingRecord } from '../services/votingRecordService';
import * as cheerio from 'cheerio';
import { VotingRecord, MemberVote } from '../types/legislation';
import { config } from 'dotenv';
const yaml = require('js-yaml');

// Load environment variables
config({ path: require('path').resolve(__dirname, '../../.env') });

const API_KEY = process.env.US_CONGRESS_API_KEY || '';
const BASE_URL = 'https://api.congress.gov/v3';
const CONGRESS = 119;
const SESSION = 1;

if (!API_KEY) {
  console.error('US_CONGRESS_API_KEY environment variable is required');
  process.exit(1);
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function isWithinLastDay(dateString: string): boolean {
  if (!dateString) return false;
  
  const voteDate = new Date(dateString);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  return voteDate >= oneDayAgo;
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

async function fetchSenateRollCallVoteLinks(): Promise<{url: string, voteNumber: string}[]> {
  try {
    log('Fetching Senate roll call votes...');
    const res = await fetch(`https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${SESSION}.htm`);
    
    if (!res.ok) {
      log(`Failed to fetch Senate HTML menu: ${res.status}`);
      return [];
    }
    
    const html = await res.text();
    const $ = cheerio.load(html);
    const links: {url: string, voteNumber: string}[] = [];
    
    $('a').each((_: number, el: any) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if (href && href.includes(`/legislative/LIS/roll_call_votes/vote${CONGRESS}${SESSION}/vote_${CONGRESS}_${SESSION}_`)) {
        const match = text.match(/(\d+)/);
        if (match) {
          links.push({ 
            url: 'https://www.senate.gov' + href, 
            voteNumber: match[1] 
          });
        }
      }
    });
    
    log(`Found ${links.length} Senate roll call vote links`);
    return links;
  } catch (error) {
    log(`Error fetching Senate vote links: ${error}`);
    return [];
  }
}

async function fetchHouseRollCallVotes(): Promise<any[]> {
  try {
    let votes: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    // Add date filtering for last day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const fromDate = formatDateForAPI(oneDayAgo);
    
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
        // Filter votes to only include those from the last day
        const recentVotes = data.houseRollCallVotes.filter((vote: any) => 
          isWithinLastDay(vote.startDate)
        );
        
        votes.push(...recentVotes);
        offset += limit;
        hasMore = data.houseRollCallVotes.length === limit;
        
        // If we're getting older votes, we can stop
        if (recentVotes.length === 0 && data.houseRollCallVotes.length > 0) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    log(`Fetched ${votes.length} House roll call votes from last day`);
    return votes;
  } catch (error) {
    log(`Error fetching House votes: ${error}`);
    return [];
  }
}

async function fetchMemberVotes(voteNumber: number): Promise<MemberVote[]> {
  try {
    const url = `${BASE_URL}/house-vote/${CONGRESS}/${SESSION}/${voteNumber}/members?api_key=${API_KEY}`;
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

async function processHouseVotes(): Promise<number> {
  let processedCount = 0;
  
  try {
    const votes = await fetchHouseRollCallVotes();
    
    for (const vote of votes) {
      try {
        const memberVotes = await fetchMemberVotes(vote.rollCallNumber);
        
        const votingRecord: VotingRecord = {
          identifier: vote.identifier,
          rollCallNumber: vote.rollCallNumber,
          legislationType: vote.legislationType,
          legislationNumber: vote.legislationNumber,
          bill_id: `congress-bill-${CONGRESS}-${vote.legislationType}-${vote.legislationNumber}`.toLowerCase(),
          voteQuestion: vote.voteQuestion,
          result: vote.result,
          date: vote.startDate,
          memberVotes,
          congress: CONGRESS,
          session: SESSION,
          chamber: 'US House',
        };
        
        await upsertVotingRecord(votingRecord);
        processedCount++;
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

async function processSenateVotes(): Promise<number> {
  let processedCount = 0;
  let filteredCount = 0;
  
  try {
    const yamlPath = path.resolve(__dirname, 'legislators-current.yaml');
    const bioguideMap = buildSenateBioguideIdMap(yamlPath);
    const senateVoteLinks = await fetchSenateRollCallVoteLinks();

    log(`Processing ${senateVoteLinks.length} Senate vote links...`);

    for (const link of senateVoteLinks) {
      try {
        const res = await fetch(link.url);
        if (!res.ok) continue;
        
        const html = await res.text();
        const $ = cheerio.load(html);
        const summaryText = $('.contenttext').first().text().replace(/\s+/g, ' ').trim();

        // Extract metadata
        const voteQuestionMatch = summaryText.match(/Question: (.*?)(?= Vote Number:| Vote Date:| Required For Majority:| Vote Result:| Measure Number:| Measure Title:|$)/);
        const resultMatch = summaryText.match(/(?:Vote Result|Result): (.*?)(?= Measure Number:| Measure Title:|$)/);
        const dateMatch = summaryText.match(/Vote Date: (.*?)(?= Required For Majority:| Vote Result:|$)/);
        const measureMatch = summaryText.match(/(?:Measure Number|Bill Number): (.*?)(?= Measure Title:|$)/);

        const voteQuestion = voteQuestionMatch ? voteQuestionMatch[1].trim() : '';
        const result = resultMatch ? resultMatch[1].trim() : '';
        const dateText = dateMatch ? dateMatch[1].trim() : '';
        const date = dateText ? new Date(dateText).toISOString() : '';
        const measureText = measureMatch ? measureMatch[1].trim() : '';

        // Skip votes that are not from the last day
        if (!isWithinLastDay(date)) {
          filteredCount++;
          continue;
        }

        let legislationNumber = '';
        let legislationType = '';
        let bill_id: string | undefined = undefined;

        if (measureText) {
          const measureMatch = measureText.match(/([A-Za-z\.]+)\s*(\d+)/);
          if (measureMatch) {
            legislationType = measureMatch[1].replace(/\./g, '').trim();
            legislationNumber = measureMatch[2].trim();
            bill_id = `congress-bill-${CONGRESS}-${legislationType.toLowerCase()}-${legislationNumber}`;
          }
        }

        // Parse member votes
        let memberVotes: MemberVote[] = [];
        const bodyText = $('body').text();
        const groupedByStateSectionMatch = bodyText.match(/Grouped by Home State\s+([\s\S]*?)(Vote Summary|$)/);
        
        if (groupedByStateSectionMatch) {
          const votesText = groupedByStateSectionMatch[1];
          const lines = votesText.trim().split('\n');
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || /^[A-Za-z ]+:$/.test(trimmedLine)) continue;

            const m = trimmedLine.match(/^(.*?) \((\w)-(\w{2})\), (Yea|Nay|Not Voting|Present|Absent|Paired|Excused|No|Yes)$/);
            if (!m) continue;
            
            const name = m[1].trim();
            const party = m[2];
            const state = m[3];
            const voteCast = m[4];
            const [lastName, firstName = ''] = name.split(',').map(s => s.trim());
            const key = `${normalizeName(lastName.toLowerCase())}|${state}`;
            const bioguideId = bioguideMap.get(key) || '';
            
            memberVotes.push({
              bioguideId,
              firstName,
              lastName,
              voteCast,
              voteParty: party,
              voteState: state,
            });
          }
        }

        const votingRecord: VotingRecord = {
          identifier: `senate-${CONGRESS}-${link.voteNumber}`,
          rollCallNumber: Number(link.voteNumber),
          legislationType,
          legislationNumber,
          bill_id,
          voteQuestion,
          result,
          date,
          memberVotes,
          congress: CONGRESS,
          session: SESSION,
          chamber: 'US Senate',
        };
        
        await upsertVotingRecord(votingRecord);
        processedCount++;
      } catch (error) {
        log(`Error processing Senate vote ${link.voteNumber}: ${error}`);
      }
    }
    
    log(`Senate votes processed: ${processedCount}, filtered (too old): ${filteredCount}`);
  } catch (error) {
    log(`Error in processSenateVotes: ${error}`);
  }
  
  return processedCount;
}

async function fetchVotingRecords() {
  const startTime = Date.now();
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  log('Starting daily voting records fetch...');
  log(`Fetching voting records from ${formatDateForAPI(oneDayAgo)} onwards`);
  
  try {
    const [houseCount, senateCount] = await Promise.all([
      processHouseVotes(),
      processSenateVotes()
    ]);
    
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
  const result = await fetchVotingRecords();
  
  if (result.success) {
    log('Daily voting records fetch completed successfully');
    process.exit(0);
  } else {
    log('Daily voting records fetch failed');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { fetchVotingRecords };
