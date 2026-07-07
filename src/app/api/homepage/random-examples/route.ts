import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getCollection } from '@/lib/mongodb';
import type { Legislation } from '@/types/legislation';
import type { Representative } from '@/types/representative';

async function fetchRandomExamplesFromDb() {
  const [legislationCollection, representativesCollection] = await Promise.all([
    getCollection('legislation'),
    getCollection('representatives'),
  ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const [randomLegislationResult, randomRepresentativeResult] = await Promise.all([
    legislationCollection
      .aggregate([
        {
          $match: {
            title: { $exists: true, $nin: [null, ''] },
            statusText: { $exists: true, $ne: null },
            geminiSummary: { $exists: true, $nin: [null, ''] },
            latestActionAt: { $gte: thirtyDaysAgo },
          },
        },
        { $sample: { size: 1 } },
        {
          $project: {
            fullText: 0,
            longGeminiSummary: 0,
            rawHtml: 0,
            embedding: 0,
            embeddings: 0,
          },
        },
      ])
      .toArray(),

    representativesCollection
      .aggregate([
        {
          $match: {
            name: { $exists: true, $nin: [null, ''] },
            $or: [
              { party: { $exists: true, $nin: [null, ''] } },
              { 'current_role.title': { $exists: true, $nin: [null, ''] } },
            ],
          },
        },
        { $sample: { size: 1 } },
      ])
      .toArray(),
  ]);

  let formattedLegislation: Legislation | null = null;
  if (randomLegislationResult.length > 0) {
    const legislation = randomLegislationResult[0];
    const { _id, fullText: _ft, ...rest } = legislation;
    formattedLegislation = {
      ...rest,
      id: legislation.id || legislation._id?.toString(),
      classification: legislation.classification || [],
      subjects: legislation.subjects || [],
      sponsors: legislation.sponsors || [],
      history: legislation.history || [],
      versions: legislation.versions || [],
      sources: legislation.sources || [],
      abstracts: legislation.abstracts || [],
      stateLegislatureUrl: legislation.stateLegislatureUrl || '',
    } as Legislation;
  }

  let billsThisYearCount = 0;
  let formattedRepresentative: Representative | null = null;

  if (randomRepresentativeResult.length > 0) {
    const representative = randomRepresentativeResult[0];
    const repId = representative.id || representative._id?.toString();

    const sponsorFilter = repId
      ? {
          $or: [
            { 'sponsors.id': repId },
            { 'sponsors.person.id': repId },
            { 'sponsors.id': repId.replace(/^ocd-person_/, 'ocd-person/').replace(/_/g, '-') },
          ],
        }
      : {
          'sponsors.name': {
            $regex: new RegExp(
              String(representative.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              'i',
            ),
          },
        };

    billsThisYearCount = await legislationCollection.countDocuments({
      $and: [
        sponsorFilter,
        {
          $or: [
            { firstActionAt: { $gte: startOfYear } },
            { latestActionAt: { $gte: startOfYear } },
            { createdAt: { $gte: startOfYear } },
          ],
        },
      ],
    });

    formattedRepresentative = {
      id: repId,
      name: representative.name,
      party: representative.party,
      current_role: representative.current_role
        ? {
            title: representative.current_role.title,
            org_classification: representative.current_role.org_classification,
            district: representative.current_role.district,
            division_id: representative.current_role.division_id,
          }
        : undefined,
      jurisdiction: representative.jurisdiction
        ? {
            id: representative.jurisdiction.id,
            name: representative.jurisdiction.name,
            classification: representative.jurisdiction.classification,
          }
        : undefined,
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
      recentBillsCount: billsThisYearCount,
    };
  }

  return {
    legislation: formattedLegislation,
    representative: formattedRepresentative,
  };
}

const getCachedRandomExamples = unstable_cache(
  fetchRandomExamplesFromDb,
  ['homepage-random-examples'],
  { revalidate: 300 },
);

export async function GET() {
  try {
    const data = await getCachedRandomExamples();

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching random examples:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching random examples',
        error: (error as Error).message,
        data: {
          legislation: null,
          representative: null,
        },
      },
      { status: 500 },
    );
  }
}
