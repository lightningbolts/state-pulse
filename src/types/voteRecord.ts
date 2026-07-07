export type VoteOption = 'yea' | 'nay' | 'present' | 'not_voting' | 'absent' | 'other';

export type VoteChamber = 'upper' | 'lower' | 'unicameral';

export type VoteResult = 'pass' | 'fail' | 'unknown';

export type OrganizationType = 'chamber' | 'committee';

export interface VoteCount {
  option: VoteOption;
  value: number;
}

export interface CanonicalMemberVote {
  personId?: string;
  externalId?: string;
  name: string;
  option: VoteOption;
  party?: string;
  district?: string;
}

export interface VoteSource {
  url: string;
  note?: string;
}

export interface VoteProvenance {
  adapter: string;
  scrapedAt: string;
  rawHash?: string;
}

export interface CanonicalVoteRecord {
  id: string;
  identifier: string;
  bill_id?: string;
  pendingBillLink?: string;
  jurisdiction: string;
  session: string;
  chamber: VoteChamber;
  organization: string;
  organizationType: OrganizationType;
  committeeId?: string;
  rollCallNumber?: string;
  motionText: string;
  motionClassification?: string[];
  date: string;
  result: VoteResult;
  counts: VoteCount[];
  memberVotes: CanonicalMemberVote[];
  sources: VoteSource[];
  provenance: VoteProvenance;
  /** Parsed bill identifier before DB link (e.g. HB 1234) */
  billIdentifier?: string;
}

export interface RawMemberVote {
  name: string;
  option: string;
  party?: string;
  district?: string;
  externalId?: string;
}

export interface RawVotePayload {
  adapter: string;
  jurisdiction: string;
  session: string;
  chamber: VoteChamber;
  organization: string;
  organizationType: OrganizationType;
  committeeId?: string;
  rollCallNumber?: string;
  motionText: string;
  motionClassification?: string[];
  date: string;
  result?: VoteResult;
  counts?: VoteCount[];
  memberVotes?: RawMemberVote[];
  billIdentifier?: string;
  sources: VoteSource[];
  rawContent?: string;
  sourceUrl?: string;
}

export interface DiscoveredVote {
  sourceId: string;
  sourceUrl: string;
  date?: string;
  rollCallNumber?: string;
  billIdentifier?: string;
  organization?: string;
  organizationType?: OrganizationType;
  metadata?: Record<string, string>;
}

export interface ScrapeContext {
  session: string;
  since: Date;
  rateLimiter: RateLimiter;
  httpClient: HttpClient;
}

export interface HttpClient {
  get(url: string, options?: RequestInit): Promise<string>;
  getBuffer?(url: string, options?: RequestInit): Promise<Buffer>;
  post?(url: string, body: string, options?: RequestInit): Promise<string>;
}

export interface RateLimiter {
  wait(): Promise<void>;
}

export interface StateVoteAdapter {
  stateAbbr: string;
  jurisdictionOcdId: string;
  adapterName: string;
  discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote>;
  fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload>;
  resolveBillLink?(vote: RawVotePayload): Promise<string | null>;
}

export interface VoteCoverageRecord {
  state: string;
  jurisdiction: string;
  floorVotes: 'full' | 'partial' | 'tally_only' | 'none';
  committeeVotes: 'full' | 'partial' | 'tally_only' | 'none';
  freshness: string;
  adapter: string;
  lastScrapedAt?: string;
  lastVoteCount?: number;
  updatedAt: string;
}

export interface IngestionStats {
  discovered: number;
  ingested: number;
  skipped: number;
  errors: number;
  unresolvedMembers: number;
}

const YEA_OPTIONS = new Set([
  'yea', 'yes', 'aye', 'y', 'affirmative', 'in favor', 'for',
]);
const NAY_OPTIONS = new Set([
  'nay', 'no', 'against', 'opposed',
]);
const PRESENT_OPTIONS = new Set(['present', 'p']);
const NOT_VOTING_OPTIONS = new Set([
  'nv', 'not voting', 'not voted', 'excused', 'abstain', 'abstained',
]);
const ABSENT_OPTIONS = new Set(['absent', 'a']);

export function normalizeVoteOption(raw: string): VoteOption {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (YEA_OPTIONS.has(key)) return 'yea';
  if (NAY_OPTIONS.has(key)) return 'nay';
  if (PRESENT_OPTIONS.has(key)) return 'present';
  if (NOT_VOTING_OPTIONS.has(key)) return 'not_voting';
  if (ABSENT_OPTIONS.has(key)) return 'absent';
  return 'other';
}

export function voteOptionToDisplay(option: VoteOption): string {
  switch (option) {
    case 'yea':
      return 'Yea';
    case 'nay':
      return 'Nay';
    case 'present':
      return 'Present';
    case 'not_voting':
      return 'Not Voting';
    case 'absent':
      return 'Absent';
    default:
      return 'Other';
  }
}

export function normalizeVoteDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return raw;
}

export function aggregateCountsFromMembers(
  memberVotes: CanonicalMemberVote[]
): VoteCount[] {
  const tally = new Map<VoteOption, number>();
  for (const vote of memberVotes) {
    tally.set(vote.option, (tally.get(vote.option) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([option, value]) => ({ option, value }));
}

export function deriveResultFromCounts(
  counts: VoteCount[],
  explicit?: VoteResult
): VoteResult {
  if (explicit && explicit !== 'unknown') return explicit;
  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;
  if (yea > nay) return 'pass';
  if (nay > yea) return 'fail';
  return 'unknown';
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildVoteIdentifier(params: {
  jurisdiction: string;
  session: string;
  organizationType: OrganizationType;
  organization: string;
  rollCallNumber?: string;
  date: string;
  motionText: string;
}): string {
  const jurisdictionKey = params.jurisdiction.replace(/^ocd-jurisdiction\//, '');
  const orgSlug = slugify(params.organization);
  const rollKey =
    params.rollCallNumber ??
    `${params.date}-${slugify(params.motionText).slice(0, 32)}`;
  return `${jurisdictionKey}:${params.session}:${params.organizationType}:${orgSlug}:${rollKey}`;
}

export function buildVoteId(
  jurisdiction: string,
  sourceId: string
): string {
  const jKey = jurisdiction.replace(/^ocd-jurisdiction\//, '');
  return `ocd-vote/${jKey}/${sourceId}`;
}

export function dedupeVoteRecords(
  records: CanonicalVoteRecord[]
): CanonicalVoteRecord[] {
  const seen = new Map<string, CanonicalVoteRecord>();
  for (const record of records) {
    const key = [
      record.jurisdiction,
      record.session,
      record.rollCallNumber ?? '',
      record.organization,
      record.date,
    ].join('|');
    if (!seen.has(key)) {
      seen.set(key, record);
    }
  }
  return Array.from(seen.values());
}

export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
