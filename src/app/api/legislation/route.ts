// src/app/api/legislation/route.ts
        import { NextResponse } from 'next/server';
        import {
          addLegislation,
          getAllLegislation
        } from '@/services/legislationService';
        // Handler for POST /api/legislation (Create)
        export async function POST(request: Request) {
          try {
            const body = await request.json();
            // TODO: Add validation for the body here (zod or manual)
            const newLegislation = await addLegislation(body);
            return NextResponse.json(newLegislation, { status: 201 });
          } catch (error) {
            console.error('Error creating legislation:', error);
            return NextResponse.json({ message: 'Error creating legislation', error: (error as Error).message }, { status: 500 });
          }
        }

        // Handler for GET /api/legislation (Read all)
        export async function GET(request: Request) {
          try {
            const { searchParams } = new URL(request.url);

            // Parse pagination parameters
            const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100', 10) : 100;
            const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0', 10) : 0;

            // Parse sorting parameters
            const sortField = searchParams.get('sortBy');
            const sortDirection = searchParams.get('sortDir');

            let sort: Record<string, 1 | -1> = {};
            if (sortField) {
              sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
            } else {
              // Default sort if not provided
              sort = { updatedAt: -1 };
            }

            // Parse filtering parameters
            const filter: Record<string, any> = {};
            // Full text search
            const searchValue = searchParams.get('search');
            if (searchValue) {
              filter.$or = [
                { title: { $regex: searchValue, $options: 'i' } },
                { summary: { $regex: searchValue, $options: 'i' } },
                { identifier: { $regex: searchValue, $options: 'i' } },
                { classification: searchValue },
                { classification: { $regex: searchValue, $options: 'i' } },
                { subjects: searchValue },
                { subjects: { $regex: searchValue, $options: 'i' } }
              ];
            }
            // Common filters
            if (searchParams.get('session')) {
              filter.session = searchParams.get('session');
            }
            if (searchParams.get('identifier')) {
              filter.identifier = searchParams.get('identifier');
            }
            if (searchParams.get('jurisdiction')) {
              filter.jurisdictionId = searchParams.get('jurisdiction');
            }
            // Handle Congress vs State filtering
            const showCongressParam = searchParams.get('showCongress');
            if (showCongressParam === 'true') {
              console.log('[API] Filtering for ALL Congress sessions');

              // For Congress bills, we need to handle multiple scenarios:
              // 1. Bills with explicit jurisdictionName (older format)
              // 2. Bills without jurisdictionName (newer format like 119th Congress)

              const congressJurisdictions = [
                "United States",
                "United States of America",
                "US",
                "USA",
                "Federal",
                "Congress",
                "U.S. Congress",
                "US Congress",
                "117th Congress",
                "118th Congress",
                "119th Congress",
                "United States Congress",
                "U.S. Federal Government"
              ];

              const congressFilter = {
                $or: [
                  // Has Congress-related jurisdictionName
                  { jurisdictionName: { $in: congressJurisdictions } },
                  // No jurisdictionName but has Congress indicators
                  {
                    $and: [
                      // No jurisdictionName field (or null/empty)
                      {
                        $or: [
                          { jurisdictionName: { $exists: false } },
                          { jurisdictionName: null },
                          { jurisdictionName: "" }
                        ]
                      },
                      // Has Congress-like characteristics
                      {
                        $or: [
                          // Has history entries with federal actors
                          { "history.actor": { $in: ["House", "Senate", "President of the United States", "Congress"] } },
                          // Title references United States Code or federal law
                          { title: { $regex: "United States Code|Public Law|Congress", $options: "i" } },
                          // Has federal-style identifiers (H.R., S., H.J.Res, S.J.Res, etc.)
                          { identifier: { $regex: "^(H\\.|S\\.|H\\.R\\.|S\\.|H\\.J\\.Res|S\\.J\\.Res)", $options: "i" } }
                        ]
                      }
                    ]
                  }
                ]
              };

              // If a search filter already exists, combine it with the congress filter
              if (filter.$or) {
                filter.$and = [
                  { $or: filter.$or }, // The existing search filter
                  congressFilter      // The new congress filter
                ];
                delete filter.$or; // Remove the original $or to avoid conflicts
              } else {
                // Otherwise, just use the congress filter
                Object.assign(filter, congressFilter);
              }

              console.log('[API] Applied comprehensive Congress filter:', JSON.stringify(filter, null, 2));

            } else if (searchParams.get('jurisdictionName')) {
              const jurisdictionNameParam = searchParams.get('jurisdictionName');
              // console.log('[API] Filtering by single jurisdictionName:', jurisdictionNameParam);

              // Use exact match instead of regex to prevent partial matches
              filter.jurisdictionName = jurisdictionNameParam;

              // console.log('[API] Applied single jurisdiction filter:', JSON.stringify(filter));
            }
            if (searchParams.get('subject')) {
              filter.subjects = searchParams.get('subject');
            }
            if (searchParams.get('chamber')) {
              filter.chamber = searchParams.get('chamber');
            }
            if (searchParams.get('classification')) {
              filter.classification = searchParams.get('classification');
            }
            if (searchParams.get('statusText')) {
              filter.statusText = searchParams.get('statusText');
            }
            if (searchParams.get('sponsor')) {
              filter['sponsors.name'] = searchParams.get('sponsor');
            }
            // Date range filters (e.g., firstActionAt_gte, firstActionAt_lte)
            const firstActionAtGte = searchParams.get('firstActionAt_gte');
            const firstActionAtLte = searchParams.get('firstActionAt_lte');
            if (firstActionAtGte || firstActionAtLte) {
              filter.firstActionAt = {};
              if (firstActionAtGte) filter.firstActionAt.$gte = new Date(firstActionAtGte);
              if (firstActionAtLte) filter.firstActionAt.$lte = new Date(firstActionAtLte);
            }
            // Add more filters as needed

            // console.log('[API] GET /api/legislation filter:', JSON.stringify(filter));
            // Debug: log a sample document matching the filter
            const legislationCollection = (await import('@/lib/mongodb')).getCollection ? await (await import('@/lib/mongodb')).getCollection('legislation') : null;
            if (legislationCollection) {
              const sample = await (await legislationCollection).findOne(filter);
              // console.log('[API] Sample matching document:', sample);
            }
            // Debug: log a sample document from the collection with no filter
            if (legislationCollection) {
              const sampleAny = await (await legislationCollection).findOne();
              // console.log('[API] Sample ANY document:', sampleAny);
            }

            // Get legislation with the constructed parameters
            const legislations = await getAllLegislation({
              limit,
              skip,
              sort,
              filter,
              // Pass showCongress to the service layer
              showCongress: showCongressParam === 'true'
            });
            return NextResponse.json(legislations, { status: 200 });
          } catch (error: any) {
            console.error('Error fetching all legislation:', error);
            return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
          }
        }