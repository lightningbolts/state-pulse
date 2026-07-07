import * as cheerio from 'cheerio';
import type { VoteCount } from '@/types/voteRecord';

export interface TableIndexRow {
  rollCallNumber: string;
  billIdentifier?: string;
  motionText: string;
  date: string;
  detailUrl?: string;
  yea: number;
  nay: number;
  present?: number;
  notVoting?: number;
  total?: number;
  result: 'pass' | 'fail' | 'unknown';
}

export interface TableIndexParserConfig {
  /** Regex to match detail links in the vote index table */
  detailLinkPattern: RegExp;
  /** Column index (0-based) for date cell */
  dateColumn?: number;
  /** Column indices for yea/nay tallies (summed when multiple party columns) */
  yeaColumns?: number[];
  nayColumns?: number[];
  /** Column index for pass/fail text */
  resultColumn?: number;
  /** Column index for bill identifier */
  billColumn?: number;
  /** Column index for motion / subject */
  motionColumn?: number;
}

const DEFAULT_CONFIG: TableIndexParserConfig = {
  detailLinkPattern: /KEY=/i,
  dateColumn: 3,
  yeaColumns: [5, 6],
  nayColumns: [7, 8],
  resultColumn: 12,
  billColumn: 1,
  motionColumn: 2,
};

function parseScDate(raw: string): string {
  const m = raw.match(/(\d{2}\/\d{2}\/\d{4})/);
  return m?.[1] ?? raw.trim();
}

function parseResult(text: string): 'pass' | 'fail' | 'unknown' {
  const t = text.toLowerCase();
  if (t.includes('pass')) return 'pass';
  if (t.includes('fail')) return 'fail';
  return 'unknown';
}

function sumColumns(cells: cheerio.Cheerio, indices: number[]): number {
  return indices.reduce((sum, i) => {
    const n = parseInt(cells.eq(i).text().replace(/\D/g, ''), 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export function parseTableIndexVotes(
  html: string,
  baseUrl: string,
  config: Partial<TableIndexParserConfig> = {}
): TableIndexRow[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const $ = cheerio.load(html);
  const rows: TableIndexRow[] = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 8) return;

    const link = cells.first().find('a[href]').first();
    const href = link.attr('href');
    if (!href || !cfg.detailLinkPattern.test(href)) return;

    const rollCallNumber =
      link.text().replace(/[\[\]]/g, '').trim() ||
      href.match(/KEY=(\d+)/i)?.[1] ||
      'unknown';

    const billIdentifier = cfg.billColumn
      ? cells.eq(cfg.billColumn).text().replace(/\s+/g, ' ').trim() || undefined
      : undefined;

    const motionText = cfg.motionColumn
      ? cells
          .eq(cfg.motionColumn)
          .text()
          .replace(/\s+/g, ' ')
          .trim() || 'Roll call vote'
      : 'Roll call vote';

    const dateRaw = cfg.dateColumn ? cells.eq(cfg.dateColumn).text() : '';
    const date = parseScDate(dateRaw);

    const yea = sumColumns(cells, cfg.yeaColumns ?? [5, 6]);
    const nay = sumColumns(cells, cfg.nayColumns ?? [7, 8]);

    const resultText = cfg.resultColumn
      ? cells.eq(cfg.resultColumn).text()
      : yea >= nay
        ? 'Passed'
        : 'Failed';

    const detailUrl = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    rows.push({
      rollCallNumber,
      billIdentifier,
      motionText,
      date,
      detailUrl,
      yea,
      nay,
      total: yea + nay,
      result: parseResult(resultText),
    });
  });

  return rows;
}

export function tableRowToCounts(row: TableIndexRow): VoteCount[] {
  const counts: VoteCount[] = [
    { option: 'yea', value: row.yea },
    { option: 'nay', value: row.nay },
  ];
  if (row.present) counts.push({ option: 'present', value: row.present });
  if (row.notVoting) counts.push({ option: 'not_voting', value: row.notVoting });
  return counts;
}
