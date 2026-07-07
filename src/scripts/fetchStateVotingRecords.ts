import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createDefaultRegistry } from '@/scrapers/stateVotes';
import { VoteIngestionOrchestrator } from '@/scrapers/stateVotes/orchestrator';
import {
  createVoteCoverageIndexes,
  createVotingRecordIndexes,
} from '@/services/voteCoverageService';

config({ path: path.resolve(__dirname, '../../.env') });

const WATERMARK_PATH = path.resolve(__dirname, './state-vote-watermarks.json');

interface WatermarkStore {
  [state: string]: string;
}

function loadWatermarks(): WatermarkStore {
  if (!fs.existsSync(WATERMARK_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(WATERMARK_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveWatermarks(watermarks: WatermarkStore): void {
  fs.writeFileSync(WATERMARK_PATH, JSON.stringify(watermarks, null, 2));
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  const statesArg = process.argv.find((a) => a.startsWith('--states='));
  const states = statesArg
    ? statesArg.replace('--states=', '').split(',').map((s) => s.trim())
    : undefined;

  const sinceDays = parseInt(
    process.argv.find((a) => a.startsWith('--since-days='))?.replace('--since-days=', '') ?? '7',
    10
  );

  const watermarks = loadWatermarks();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  log('Creating indexes...');
  await createVoteCoverageIndexes();
  await createVotingRecordIndexes();

  const registry = createDefaultRegistry();
  const orchestrator = new VoteIngestionOrchestrator({
    registry,
    states,
    since,
    openStatesApiKey: process.env.OPENSTATES_API_KEY,
    onProgress: log,
  });

  log(`Starting state vote ingestion${states ? ` for ${states.join(', ')}` : ''}...`);
  const results = await orchestrator.run();

  for (const result of results) {
    watermarks[result.state] = new Date().toISOString();
    log(
      `${result.state}: discovered=${result.discovered} ingested=${result.ingested} errors=${result.errors} unresolved=${result.unresolvedMembers}`
    );
  }

  saveWatermarks(watermarks);
  log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
