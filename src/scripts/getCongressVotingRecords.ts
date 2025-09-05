import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { upsertVotingRecord } from '@/services/votingRecordService';
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
      const key = `${lastName}|${state}`;
      if (leg.id && leg.id.bioguide) {
        map.set(key, leg.id.bioguide);
      }
    }
  }
  return map;
}


async function fetchSenateRollCallVotes(): Promise<SenateRollCallVote[]> {
  console.log('Fetching Senate roll call votes XML...');
  const res = await fetch(SENATE_XML_URL);
  if (!res.ok) throw new Error(`Failed to fetch Senate XML: ${res.status}`);
  const xml = await res.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  if (!parsed.vote_menu || !parsed.vote_menu.vote) {
    console.warn('Senate XML structure unexpected or empty:', JSON.stringify(parsed, null, 2));
    return [];
  }
  const votes = parsed.vote_menu.vote;
  const results: SenateRollCallVote[] = [];
  for (const vote of Array.isArray(votes) ? votes : [votes]) {
    // Each vote has a link to the detailed XML for member votes
    const detailUrl = vote.vote_document_url;
    if (!detailUrl) continue;
    try {
      const detailRes = await fetch(detailUrl);
      if (!detailRes.ok) continue;
      const detailXml = await detailRes.text();
      const detailParsed = await parseStringPromise(detailXml, { explicitArray: false });
      const members = detailParsed.roll_call_vote.members.member;
      const memberVotes: SenateMemberVote[] = Array.isArray(members)
        ? members.map((m: any) => ({
            name: `${m.last_name}, ${m.first_name}`,
            state: m.state,
            party: m.party,
            vote: m.vote_cast,
          }))
        : [
            {
              name: `${members.last_name}, ${members.first_name}`,
              state: members.state,
              party: members.party,
              vote: members.vote_cast,
            },
          ];
      results.push({
        voteNumber: vote.vote_number,
        date: vote.vote_date,
        question: vote.vote_question,
        result: vote.vote_result,
        billNumber: vote.bill_number,
        memberVotes,
      });
      console.log(`Fetched Senate vote ${vote.vote_number} (${memberVotes.length} member votes)`);
    } catch (err) {
      console.warn(`Failed to parse Senate vote ${vote.vote_number}:`, err);
    }
  }
  return results;
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
  // Build the mapping from (lastName, state) => bioguideId
  const yamlPath = path.resolve(__dirname, 'legislators-current.yaml');
  const bioguideMap = buildSenateBioguideIdMap(yamlPath);
  const senateVotes = await fetchSenateRollCallVotes();
  for (const vote of senateVotes) {
    const identifier = `senate-${CONGRESS}-${vote.voteNumber}`;
    let bill_id: string | undefined = undefined;
    if (vote.billNumber) {
      bill_id = `congress-bill-${CONGRESS}-senate-${vote.billNumber}`.toLowerCase();
    }
    const memberVotes: MemberVote[] = vote.memberVotes.map((m: any) => {
      const [lastName, firstName] = m.name.split(',').map((s: string) => s.trim());
      const key = `${lastName.toLowerCase()}|${m.state}`;
      const bioguideId = bioguideMap.get(key) || '';
      if (!bioguideId) {
        console.warn(`No bioguideId found for senator: ${firstName} ${lastName} (${m.state})`);
      }
      return {
        bioguideId,
        firstName: firstName || '',
        lastName: lastName || '',
        voteCast: m.vote,
        voteParty: m.party,
        voteState: m.state,
      };
    });
    const votingRecord: VotingRecord = {
      identifier,
      rollCallNumber: Number(vote.voteNumber),
      legislationType: 'Senate',
      legislationNumber: vote.billNumber || '',
      voteQuestion: vote.question,
      result: vote.result,
      date: vote.date,
      memberVotes,
      congress: CONGRESS,
      session: 1,
      chamber: 'US Senate',
      ...(bill_id ? { bill_id } : {}),
    };
    await upsertVotingRecord(votingRecord);
    console.log(`Upserted voting record for Senate vote ${vote.voteNumber} (identifier: ${identifier})`);
  }
  console.log(`Done! Saved Senate votes to MongoDB collection 'voting_records'`);
}

async function main() {
//   await fetchAndUpsertHouseVotes();
  await fetchAndUpsertSenateVotes();
  await process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
