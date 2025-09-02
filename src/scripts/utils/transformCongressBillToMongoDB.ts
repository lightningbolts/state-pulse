import { enactedPatterns } from "@/types/legislation";

function toMongoDate(
    dateInput: Date | { seconds: number; nanoseconds: number } | string | null | undefined
): Date | null {
    if (dateInput === null || typeof dateInput === 'undefined' || dateInput === '') {
        return null;
    }
    if (dateInput instanceof Date) {
        return isNaN(dateInput.getTime()) ? null : dateInput;
    }
    if (typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
        return new Date(dateInput.seconds * 1000);
    }
    if (typeof dateInput === 'string') {
        const date = new Date(dateInput.split(' ')[0]);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function detectEnactedDate(history: any[]): Date | null {
    if (!history || history.length === 0) return null;
    const sortedHistory = [...history].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    });
    for (const action of sortedHistory) {
        const actionText = (action.action || '').trim();
        if (!actionText) continue;
        for (const pattern of enactedPatterns) {
            if (pattern.test(actionText)) {
                return action.date ? new Date(action.date) : null;
            }
        }
    }
    return null;
}

export function transformCongressBillToMongoDB(congressBill: any): any {
  const now = new Date();
  const sponsors: Array<{
    name: string;
    id: string | null;
    entityType: string;
    primary: boolean;
    classification: string;
    personId: string | null;
    organizationId: string | null;
  }> = [];
  if (congressBill.sponsors && congressBill.sponsors.length > 0) {
    congressBill.sponsors.forEach((sponsor: any) => {
      sponsors.push({
        name: sponsor.fullName || `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim(),
        id: sponsor.bioguideId || null,
        entityType: 'person',
        primary: true,
        classification: 'sponsor',
        personId: sponsor.bioguideId || null,
        organizationId: null,
      });
    });
  }
  if (congressBill.cosponsors && congressBill.cosponsors.length > 0) {
    congressBill.cosponsors.forEach((cosponsor: any) => {
      sponsors.push({
        name: cosponsor.fullName || `${cosponsor.firstName || ''} ${cosponsor.lastName || ''}`.trim(),
        id: cosponsor.bioguideId || null,
        entityType: 'person',
        primary: false,
        classification: 'cosponsor',
        personId: cosponsor.bioguideId || null,
        organizationId: null,
      });
    });
  }
  const history = (congressBill.actions?.actions || [])
    .map((action: any) => {
      const eventDate = toMongoDate(action.actionDate);
      if (!eventDate) return null;
      return {
        date: eventDate,
        action: action.text,
        actor: action.sourceSystem?.name || 'Congress',
        classification: action.type ? [action.type] : [],
        order: action.actionCode || 0,
      };
    })
    .filter((h: any): h is NonNullable<typeof h> => h !== null);
  const versions = (congressBill.textVersions?.textVersions || [])
    .map((version: any) => {
      const versionDate = toMongoDate(version.date);
      if (!versionDate) return null;
      return {
        note: version.type,
        date: versionDate,
        classification: version.type || null,
        links: version.formats ? version.formats.map((format: any) => ({
          url: format.url,
          media_type: format.type || null,
        })) : [],
      };
    })
    .filter((v: any): v is NonNullable<typeof v> => v !== null);
  const sources = [{
    url: `https://www.congress.gov/bill/${congressBill.congress}th-congress/${congressBill.originChamber.toLowerCase()}-bill/${congressBill.number}`,
    note: 'Congress.gov',
  }];
  const summary = congressBill.summaries?.summaries?.[0]?.text ||
                 congressBill.title || null;
  const chamber = congressBill.originChamber === 'House' ? 'lower' :
                 congressBill.originChamber === 'Senate' ? 'upper' :
                 congressBill.originChamber?.toLowerCase();
  const enactedAt = detectEnactedDate(history);
  return {
    id: `congress-bill-${congressBill.congress}-${congressBill.type.toLowerCase()}-${congressBill.number}`,
    identifier: `${congressBill.type} ${congressBill.number}`,
    title: congressBill.title,
    session: `${congressBill.congress}th Congress`,
    jurisdictionId: 'ocd-jurisdiction/country:us/legislature',
    jurisdictionName: 'United States Congress',
    chamber: chamber,
    classification: [congressBill.type?.toLowerCase() || 'bill'],
    subjects: congressBill.policyArea ? [congressBill.policyArea.name] : [],
    statusText: congressBill.latestAction?.text || null,
    sponsors,
    history,
    versions: versions || [],
    sources: sources || [],
    abstracts: summary ? [{ abstract: summary, note: 'Congress.gov summary' }] : [],
    openstatesUrl: null,
    congressUrl: sources[0].url,
    firstActionAt: toMongoDate(congressBill.introducedDate),
    latestActionAt: toMongoDate(congressBill.latestAction?.actionDate),
    latestActionDescription: congressBill.latestAction?.text || null,
    latestPassageAt: null,
    createdAt: toMongoDate(congressBill.introducedDate) || now,
    updatedAt: toMongoDate(congressBill.updateDate) || now,
    summary: summary,
    extras: {
      congress: congressBill.congress,
      billType: congressBill.type,
      billNumber: congressBill.number,
      constitutionalAuthorityStatementText: congressBill.constitutionalAuthorityStatementText,
    },
    enactedAt: enactedAt,
  };
}
