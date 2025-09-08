import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { upsertVotingRecord } from '@/services/votingRecordService';
import * as cheerio from 'cheerio';
import { VotingRecord, MemberVote } from '@/types/legislation';
import { parseStringPromise } from 'xml2js';
import {config} from 'dotenv';
const yaml = require('js-yaml');

config({ path: require('path').resolve(__dirname, '../../.env') });


const API_KEY = process.env.US_CONGRESS_API_KEY || '';
const BASE_URL = 'https://api.congress.gov/v3';
const CONGRESS = 119;
const SESSION = 1; // 1 or 2
const OUTPUT_FILE = `house_voting_records_${CONGRESS}.json`;
const SENATE_XML_URL = 'https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_1.xml';
const SENATE_OUTPUT_FILE = `senate_voting_records_${CONGRESS}.json`;
interface SenateMemberVote {
  name: string;
  state: string;
  party: string;
  vote: string;
}

interface SenateRollCallVote {
  voteNumber: string;
  date: string;
  question: string;
  result: string;
  billNumber?: string;
  memberVotes: SenateMemberVote[];
}

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildSenateBioguideIdMap(yamlPath: string) {
  const file = fs.readFileSync(yamlPath, 'utf8');
  const legislators = yaml.load(file) as any[];
  const map = new Map<string, string>();
  for (const leg of legislators) {
    if (!leg.terms) continue;
    const currentSenTerm = leg.terms.find((t: any) => t.type === 'sen' && (!t.end || new Date(t.end) >= new Date()));
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
}



// Scrape the HTML roll call menu for all vote links
async function fetchSenateRollCallVoteLinks(): Promise<{url: string, voteNumber: string, date?: string, question?: string}[]> {
  console.log('Fetching Senate roll call votes HTML menu...');
  const res = await fetch('https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_119_1.htm');
  if (!res.ok) throw new Error(`Failed to fetch Senate HTML menu: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const links: {url: string, voteNumber: string, date?: string, question?: string}[] = [];
  // Find all links to roll call votes
  $('a').each((_: number, el: any) => {
    const href = $(el).attr('href');
    const text = $(el).text();
    if (href && href.includes('/legislative/LIS/roll_call_votes/vote1191/vote_119_1_')) {
      // Extract vote number from text, e.g. "503 (83-13)"
      const match = text.match(/(\d+)/);
      if (match) {
        links.push({ url: 'https://www.senate.gov' + href, voteNumber: match[1] });
      }
    }
  });
  console.log(`Found ${links.length} Senate roll call vote links.`);
  return links;
}



async function fetchHouseRollCallVotes(congress: number, session: number): Promise<any[]> {
  let votes: any[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  while (hasMore) {
    const url = `https://api.congress.gov/v3/house-vote/${congress}?api_key=${API_KEY}&offset=${offset}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch roll call votes: ${res.status}`);
    const data: any = await res.json();
    if (data.houseRollCallVotes && data.houseRollCallVotes.length > 0) {
      votes.push(...data.houseRollCallVotes);
      offset += limit;
      hasMore = data.houseRollCallVotes.length === limit;
      console.log(`Fetched ${votes.length} House roll call votes so far...`);
    } else {
      hasMore = false;
    }
  }
  return votes;
}

async function fetchMemberVotes(congress: number, session: number, voteNumber: number): Promise<MemberVote[]> {
  const url = `${BASE_URL}/house-vote/${congress}/${session}/${voteNumber}/members?api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch member votes for ${congress}/${session}/${voteNumber}: ${res.status}`);
  const data: any = await res.json();
  if (!data.houseRollCallVoteMemberVotes || !data.houseRollCallVoteMemberVotes.results) return [];
  return data.houseRollCallVoteMemberVotes.results.map((item: any) => ({
    bioguideId: item.bioguideID, // Map bioguideID to bioguideId
    firstName: item.firstName,
    lastName: item.lastName,
    voteCast: item.voteCast,
    voteParty: item.voteParty,
    voteState: item.voteState,
  }));
}


async function fetchAndUpsertHouseVotes() {
  for (const session of [1]) {
    console.log(`Fetching House roll call votes for Congress ${CONGRESS}, Session ${session}...`);
    const votes = await fetchHouseRollCallVotes(CONGRESS, session);
    for (const vote of votes) {
      const identifier = vote.identifier;
      let memberVotes: MemberVote[] = [];
      try {
        memberVotes = await fetchMemberVotes(CONGRESS, session, vote.rollCallNumber);
        console.log(`Fetched House vote ${vote.rollCallNumber} (${memberVotes.length} member votes)`);
      } catch (err) {
        const e = err as any;
        console.warn(`Skipping House vote ${vote.rollCallNumber} (identifier: ${identifier}) due to error:`, e?.message || e);
      }
      if (!memberVotes || memberVotes.length === 0) {
        console.warn(`No member votes found for House vote ${vote.rollCallNumber} (identifier: ${identifier})`);
      }
      const votingRecord: VotingRecord = {
        identifier,
        rollCallNumber: vote.rollCallNumber,
        legislationType: vote.legislationType,
        legislationNumber: vote.legislationNumber,
        bill_id: `congress-bill-${CONGRESS}-${vote.legislationType}-${vote.legislationNumber}`.toLowerCase(),
        voteQuestion: vote.voteQuestion,
        result: vote.result,
        date: vote.startDate,
        memberVotes,
        congress: CONGRESS,
        session,
        chamber: 'US House',
      };
      await upsertVotingRecord(votingRecord);
      console.log(`Upserted voting record for House vote ${vote.rollCallNumber} (identifier: ${identifier})`);
    }
  }
  console.log(`Done! Saved House votes to MongoDB collection 'voting_records'`);
}

async function fetchAndUpsertSenateVotes() {
  const yamlPath = path.resolve(__dirname, 'legislators-current.yaml');
  const bioguideMap = buildSenateBioguideIdMap(yamlPath);
  const senateVoteLinks = await fetchSenateRollCallVoteLinks();

  for (const link of senateVoteLinks) {
    try {
      const res = await fetch(link.url);
      if (!res.ok) {
        console.warn(`Failed to fetch vote page: ${link.url}`);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      const summaryText = $('.contenttext').first().text().replace(/\s+/g, ' ').trim();

      const extractMetadata = (text: string) => {
        const voteQuestionMatch = text.match(/Question: (.*?)(?= Vote Number:| Vote Date:| Required For Majority:| Vote Result:| Measure Number:| Measure Title:|$)/);
        const resultMatch = text.match(/(?:Vote Result|Result): (.*?)(?= Measure Number:| Measure Title:|$)/);
        const dateMatch = text.match(/Vote Date: (.*?)(?= Required For Majority:| Vote Result:|$)/);
        const measureMatch = text.match(/(?:Measure Number|Bill Number): (.*?)(?= Measure Title:|$)/);

        const voteQuestion = voteQuestionMatch ? voteQuestionMatch[1].trim() : '';
        const result = resultMatch ? resultMatch[1].trim() : '';
        const dateText = dateMatch ? dateMatch[1].trim() : '';
        const date = dateText ? new Date(dateText).toISOString() : '';
        const measureText = measureMatch ? measureMatch[1].trim() : '';

        return { voteQuestion, result, date, measureText };
      };

      const { voteQuestion, result, date, measureText } = extractMetadata(summaryText);

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
          if (!m) {
            console.warn(`Could not parse member vote line: "${trimmedLine}"`);
            continue;
          }
          const name = m[1].trim();
          const party = m[2];
          const state = m[3];
          const voteCast = m[4];
          const [lastName, firstName = ''] = name.split(',').map(s => s.trim());
          const key = `${normalizeName(lastName.toLowerCase())}|${state}`;
          const bioguideId = bioguideMap.get(key) || '';
          if (!bioguideId) {
            console.warn(`No bioguideId found for senator: ${firstName} ${lastName} (${state})`);
          }
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

      if (memberVotes.length === 0) {
        console.warn(`Falling back to parsing 'Alphabetical by Senator Name' section for vote ${link.voteNumber}`);
        const sectionMatch = bodyText.match(/Alphabetical by Senator Name\s+([\s\S]*?)(Grouped By Vote Position|Grouped by Home State|Vote Summary|$)/);
        if (sectionMatch) {
          const memberRegex = /(.*?)(?: \((\w)-(\w{2})\), (Yea|Nay|Not Voting|Present|Absent|Paired|Excused|No|Yes))/g;
          let match;
          while ((match = memberRegex.exec(sectionMatch[1])) !== null) {
            const name = match[1].trim();
            const party = match[2];
            const state = match[3];
            const voteCast = match[4];
            const [lastName, firstName = ''] = name.split(',').map(s => s.trim());
            const key = `${normalizeName(lastName.toLowerCase())}|${state}`;
            const bioguideId = bioguideMap.get(key) || '';
            if (!bioguideId) {
              console.warn(`No bioguideId found for senator: ${firstName} ${lastName} (${state})`);
            }
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
      }

      const identifier = `senate-${CONGRESS}-${link.voteNumber}`;
      const votingRecord: VotingRecord = {
        identifier,
        rollCallNumber: Number(link.voteNumber),
        legislationType,
        legislationNumber,
        bill_id,
        voteQuestion,
        result,
        date,
        memberVotes,
        congress: CONGRESS,
        session: 1,
        chamber: 'US Senate',
      };
      await upsertVotingRecord(votingRecord);
      console.log(`Upserted voting record for Senate vote ${link.voteNumber} (identifier: ${identifier})`);
    } catch (err) {
      console.error(`Error processing Senate vote ${link.voteNumber}:`, err);
    }
  }
  console.log(`Done! Saved Senate votes to MongoDB collection 'voting_records'`);
}

async function main() {
  await fetchAndUpsertHouseVotes();
  await fetchAndUpsertSenateVotes();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
