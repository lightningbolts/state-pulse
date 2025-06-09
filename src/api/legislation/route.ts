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
            // Add validation for the body here
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

            // Common filters
            if (searchParams.get('session')) {
              filter.session = searchParams.get('session');
            }

            if (searchParams.get('jurisdiction')) {
              filter.jurisdictionId = searchParams.get('jurisdiction');
            }

            if (searchParams.get('subject')) {
              filter.subjects = searchParams.get('subject');
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