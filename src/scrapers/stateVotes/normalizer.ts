import {
  aggregateCountsFromMembers,
  buildVoteId,
  buildVoteIdentifier,
  CanonicalMemberVote,
  CanonicalVoteRecord,
  deriveResultFromCounts,
  hashContent,
  normalizeVoteDate,
  normalizeVoteOption,
  RawVotePayload,
} from '@/types/voteRecord';

export function normalizeRawVote(payload: RawVotePayload): CanonicalVoteRecord {
  const memberVotes: CanonicalMemberVote[] = (payload.memberVotes ?? []).map(
    (mv) => ({
      name: mv.name.trim(),
      option: normalizeVoteOption(mv.option),
      party: mv.party,
      district: mv.district,
      externalId: mv.externalId,
    })
  );

  const counts =
    payload.counts && payload.counts.length > 0
      ? payload.counts.map((c) => ({
          option: typeof c.option === 'string' ? normalizeVoteOption(c.option) : c.option,
          value: c.value,
        }))
      : aggregateCountsFromMembers(memberVotes);

  const date = normalizeVoteDate(payload.date);
  const sourceId =
    payload.rollCallNumber ??
    `${date}-${payload.organization}-${payload.motionText.slice(0, 20)}`;

  const identifier = buildVoteIdentifier({
    jurisdiction: payload.jurisdiction,
    session: payload.session,
    organizationType: payload.organizationType,
    organization: payload.organization,
    rollCallNumber: payload.rollCallNumber,
    date,
    motionText: payload.motionText,
  });

  return {
    id: buildVoteId(payload.jurisdiction, sourceId),
    identifier,
    jurisdiction: payload.jurisdiction,
    session: payload.session,
    chamber: payload.chamber,
    organization: payload.organization,
    organizationType: payload.organizationType,
    committeeId: payload.committeeId,
    rollCallNumber: payload.rollCallNumber,
    motionText: payload.motionText,
    motionClassification: payload.motionClassification,
    date,
    result: deriveResultFromCounts(counts, payload.result),
    counts,
    memberVotes,
    billIdentifier: payload.billIdentifier,
    sources: payload.sources,
    provenance: {
      adapter: payload.adapter,
      scrapedAt: new Date().toISOString(),
      rawHash: payload.rawContent ? hashContent(payload.rawContent) : undefined,
    },
  };
}

export function reconcileCounts(record: CanonicalVoteRecord): boolean {
  if (!record.memberVotes.length) return true;
  const sum = record.counts.reduce((acc, c) => acc + c.value, 0);
  return sum === record.memberVotes.length;
}
