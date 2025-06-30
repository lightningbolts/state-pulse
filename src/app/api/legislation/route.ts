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
            let sort: Record<string, 1 | -1> = { updatedAt: -1 }; // Default sort
            const sortField = searchParams.get('sortBy');
            const sortDirection = searchParams.get('sortDir');
            if (sortField) {
              sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
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
              filter
            });
            return NextResponse.json(legislations, { status: 200 });
          } catch (error) {
            console.error('Error fetching all legislation:', error);
            return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
          }
        }