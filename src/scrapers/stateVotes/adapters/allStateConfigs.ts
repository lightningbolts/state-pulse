import type { ChamberHtmlAdapterConfig } from './chamberHtml';

function ocd(state: string): string {
  return `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;
}

function chamberConfig(
  stateAbbr: string,
  voteIndexUrl: string,
  organization = 'House',
  linkPattern?: RegExp
): ChamberHtmlAdapterConfig {
  return {
    stateAbbr,
    jurisdictionOcdId: ocd(stateAbbr),
    adapterName: `${stateAbbr.toLowerCase()}-html`,
    voteIndexUrl,
    linkPattern,
    chamber: 'lower',
    organization,
  };
}

/** Chamber HTML configs for states not covered by dedicated adapters. */
export const REMAINING_STATE_CONFIGS: ChamberHtmlAdapterConfig[] = [
  chamberConfig('AL', 'https://alisondb.legislature.state.al.us/ALISON/HandHIndex.aspx', 'House', /vote/i),
  chamberConfig('AK', 'https://www.akleg.gov/basis/votes.asp', 'House', /vote/i),
  chamberConfig('AR', 'https://www.arkleg.state.ar.us/assembly/2025/R/Pages/Votes.aspx', 'House', /vote/i),
  chamberConfig('CT', 'https://www.cga.ct.gov/asp/menu/votes.asp', 'House', /vote/i),
  chamberConfig('DE', 'https://legis.delaware.gov/HouseRollCall', 'House', /roll/i),
  chamberConfig('HI', 'https://www.capitol.hawaii.gov/advreports/advreport.aspx?report=votes', 'House', /vote/i),
  chamberConfig('ID', 'https://legislature.idaho.gov/sessioninfo/voterecords/', 'House', /vote/i),
  chamberConfig('IL', 'https://www.ilga.gov/house/votes/default.asp', 'House', /vote/i),
  chamberConfig('IA', 'https://www.legis.iowa.gov/legislation/votes', 'House', /vote/i),
  chamberConfig('KS', 'https://www.kslegislature.org/li/b2025_26/votes/house/', 'House', /vote/i),
  chamberConfig('KY', 'https://apps.legislature.ky.gov/recordvotes', 'House', /vote/i),
  chamberConfig('LA', 'https://house.louisiana.gov/H_Votes/2025', 'House', /vote/i),
  chamberConfig('ME', 'https://www.mainelegislature.org/legis/votes/', 'House', /vote/i),
  chamberConfig('MA', 'https://malegislature.gov/RollCall/Search', 'House', /roll/i),
  chamberConfig('MS', 'https://billstatus.ls.state.ms.us/2025/pdf/votes/house/', 'House', /vote/i),
  chamberConfig('MT', 'https://leg.mt.gov/bills/votes/', 'House', /vote/i),
  chamberConfig('NE', 'https://nebraskalegislature.gov/floor_activity/vote_record_list.php', 'Legislature', /vote/i),
  chamberConfig('NV', 'https://www.leg.state.nv.us/App/NELIS/REL/82nd2025/Votes', 'Assembly', /vote/i),
  chamberConfig('NH', 'https://www.gencourt.state.nh.us/house/votes/', 'House', /vote/i),
  chamberConfig('NJ', 'https://www.njleg.state.nj.us/rolls/rolls.asp', 'Assembly', /roll/i),
  chamberConfig('NM', 'https://www.nmlegis.gov/Sessions/25%20Regular/votes/house', 'House', /vote/i),
  chamberConfig('ND', 'https://www.legis.nd.gov/assembly/69-2025/regular/votes/house', 'House', /vote/i),
  chamberConfig('OK', 'https://www.oklegislature.gov/House/Votes', 'House', /vote/i),
  chamberConfig('OR', 'https://olis.oregonlegislature.gov/liz/2025R1/Votes/House', 'House', /vote/i),
  chamberConfig('SD', 'https://www.sdlegislature.gov/House/Session/DailyJournal', 'House', /vote/i),
  chamberConfig('TX', 'https://capitol.texas.gov/Votes.aspx', 'House', /vote/i),
  chamberConfig('UT', 'https://le.utah.gov/asp/paVotes/paVotes.voteList', 'House', /vote/i),
  chamberConfig('VT', 'https://legislature.vermont.gov/bill/votes/2026/house', 'House', /vote/i),
  chamberConfig('WV', 'https://www.wvlegislature.gov/Votes/house/', 'House', /vote/i),
  chamberConfig('WY', 'https://wyoleg.gov/Legislation/Votes', 'House', /vote/i),
];

export const ALL_US_STATE_ABBRS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;
