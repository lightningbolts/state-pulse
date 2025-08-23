import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { Legislation } from '@/types/legislation';
import { Representative } from '@/types/representative';

export async function GET() {
  try {
    // Fetch both random legislation and representative in parallel
    const [legislationCollection, representativesCollection] = await Promise.all([
      getCollection('legislation'),
      getCollection('representatives')
    ]);

    // Get random legislation and representative in parallel
    const [randomLegislationResult, randomRepresentativeResult] = await Promise.all([
      legislationCollection.aggregate([
        {
          $match: {
            title: { $exists: true, $nin: [null, ''] },
            statusText: { $exists: true, $ne: null },
            geminiSummary: { $exists: true, $nin: [null, ''] },
            $expr: { $gte: [ { $strLenCP: "$geminiSummary" }, 200 ] }
          }
        },
        { $sample: { size: 1 } }
      ]).toArray(),

      representativesCollection.aggregate([
        {
          $match: {
            name: { $exists: true, $nin: [null, ''] },
            $or: [
              { party: { $exists: true, $nin: [null, ''] } },
              { 'current_role.title': { $exists: true, $nin: [null, ''] } }
            ]
          }
        },
        { $sample: { size: 1 } }
      ]).toArray()
    ]);

    // Transform legislation data
    let formattedLegislation: Legislation | null = null;
    if (randomLegislationResult.length > 0) {
      const legislation = randomLegislationResult[0];
      formattedLegislation = {
        id: legislation.id || legislation._id?.toString(),
        identifier: legislation.identifier,
        title: legislation.title,
        session: legislation.session,
        jurisdictionId: legislation.jurisdictionId,
        jurisdictionName: legislation.jurisdictionName,
        chamber: legislation.chamber,
        classification: legislation.classification || [],
        subjects: legislation.subjects || [],
        statusText: legislation.statusText,
        sponsors: legislation.sponsors || [],
        history: legislation.history || [],
        versions: legislation.versions || [],
        sources: legislation.sources || [],
        abstracts: legislation.abstracts || [],
        openstatesUrl: legislation.openstatesUrl,
        firstActionAt: legislation.firstActionAt,
        latestActionAt: legislation.latestActionAt,
        latestActionDescription: legislation.latestActionDescription,
        latestPassageAt: legislation.latestPassageAt,
        createdAt: legislation.createdAt,
        updatedAt: legislation.updatedAt,
        stateLegislatureUrl: legislation.stateLegislatureUrl || '',
        fullText: legislation.fullText,
        geminiSummary: legislation.geminiSummary,
        summary: legislation.summary,
        extras: legislation.extras
      };
    }

    // Calculate bills sponsored this year for the representative
    let billsThisYearCount = 0;
    let formattedRepresentative: Representative | null = null;

    if (randomRepresentativeResult.length > 0) {
      const representative = randomRepresentativeResult[0];

      // Calculate start of current year
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1); // January 1st of current year

      // Count bills sponsored by this representative this year
      billsThisYearCount = await legislationCollection.countDocuments({
        $and: [
          {
            // Match bills with sponsors
            sponsors: {
              $exists: true,
              $ne: [],
              $not: { $size: 0 }
            }
          },
          {
            // Match bills from this year
            $or: [
              { firstActionAt: { $gte: startOfYear } },
              { latestActionAt: { $gte: startOfYear } },
              { createdAt: { $gte: startOfYear } }
            ]
          },
          {
            // Match representative by name in various sponsor formats
            $or: [
              // Direct string match in sponsors array
              { "sponsors": { $regex: new RegExp(representative.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
              // Object format with name field
              { "sponsors.name": { $regex: new RegExp(representative.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
              // Object format with person.name field
              { "sponsors.person.name": { $regex: new RegExp(representative.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } },
              // Match by representative ID if available
              ...(representative.id ? [
                { "sponsors.id": representative.id },
                { "sponsors.person.id": representative.id }
              ] : [])
            ]
          }
        ]
      });

      formattedRepresentative = {
        id: representative.id || representative._id?.toString(),
        name: representative.name,
        party: representative.party,
        current_role: representative.current_role ? {
          title: representative.current_role.title,
          org_classification: representative.current_role.org_classification,
          district: representative.current_role.district,
          division_id: representative.current_role.division_id
        } : undefined,
        jurisdiction: representative.jurisdiction ? {
          id: representative.jurisdiction.id,
          name: representative.jurisdiction.name,
          classification: representative.jurisdiction.classification
        } : undefined,
        given_name: representative.given_name,
        family_name: representative.family_name,
        image: representative.image,
        email: representative.email,
        gender: representative.gender,
        birth_date: representative.birth_date,
        death_date: representative.death_date,
        extras: representative.extras,
        created_at: representative.created_at,
        updated_at: representative.updated_at,
        openstates_url: representative.openstates_url,
        other_identifiers: representative.other_identifiers || [],
        other_names: representative.other_names || [],
        links: representative.links || [],
        sources: representative.sources || [],
        offices: representative.offices || [],
        // Legacy/derived fields for compatibility
        office: representative.office,
        district: representative.district,
        jurisdictionName: representative.jurisdictionName,
        phone: representative.phone,
        website: representative.website,
        photo: representative.photo,
        lat: representative.lat,
        lon: representative.lon,
        distance: representative.distance,
        addresses: representative.addresses,
        lastUpdated: representative.lastUpdated,
        // Add the calculated bills this year count
        recentBillsCount: billsThisYearCount
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        legislation: formattedLegislation,
        representative: formattedRepresentative
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching random examples:', error);
    return NextResponse.json({
      success: false,
      message: 'Error fetching random examples',
      error: (error as Error).message,
      data: {
        legislation: null,
        representative: null
      }
    }, { status: 500 });
  }
}
