// src/app/api/legislation/route.ts
        import { NextResponse } from 'next/server';
        import {
          addLegislation,
          getAllLegislation
        } from '@/services/legislationService'; // Corrected path
        // Handler for POST /api/legislation (Create)
        export async function POST(request: Request) {
          try {
            const body = await request.json(); // Use the correct input type
            // Add validation for the body here
            const newLegislation = await addLegislation(body); // Assuming addLegislation returns the created object with an ID
            return NextResponse.json(newLegislation, { status: 201 });
          } catch (error) {
            console.error('Error creating legislation:', error);
            return NextResponse.json({ message: 'Error creating legislation', error: (error as Error).message }, { status: 500 });
          }
        }

        // Handler for GET /api/legislation (Read all)
        export async function GET(request: Request) {
          try {
            // You might want to add query parameters for pagination, filtering, sorting
            const legislations = await getAllLegislation();
            return NextResponse.json(legislations, { status: 200 });
          } catch (error) {
            console.error('Error fetching all legislation:', error);
            return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
          }
        }