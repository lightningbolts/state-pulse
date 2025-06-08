// src/app/api/legislation/[id]/route.ts
import { NextResponse } from 'next/server';
import {
  getLegislationById,
  updateLegislation,
  deleteLegislation
} from '@/services/legislationService'; // Corrected path
import type { Legislation } from '@/types/legislation'; // Corrected path

// Note: GET is used for fetching data, ensure proper authorization in production
// Handler for GET /api/legislation/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    const legislation = await getLegislationById(id);
    if (!legislation) {
      return NextResponse.json({ message: 'Legislation not found' }, { status: 404 });
    }
    return NextResponse.json(legislation, { status: 200 });
  } catch (error) {
    console.error(`Error fetching legislation ${id}:`, error);
    return NextResponse.json({ message: 'Error fetching legislation', error: (error as Error).message }, { status: 500 });
  }
}

// Note: PUT is used for updates, ensure proper validation and authorization in production
// Handler for PUT /api/legislation/[id] (Edit)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    const body = await request.json() as Partial<Legislation>; // Or a specific update DTO
    // Add validation for the body here
    const updatedLegislation = await updateLegislation(id, body);
    if (!updatedLegislation) {
      return NextResponse.json({ message: 'Legislation not found or update failed' }, { status: 404 });
    }
    return NextResponse.json(updatedLegislation, { status: 200 });
  } catch (error) {
    console.error(`Error updating legislation ${id}:`, error);
    return NextResponse.json({ message: 'Error updating legislation', error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ message: 'POST method not allowed for this endpoint' }, { status: 405 });
}

// Note: DELETE is a destructive operation, ensure proper authorization and checks in production
// Handler for DELETE /api/legislation/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    await deleteLegislation(id);
    return NextResponse.json({ message: 'Legislation deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting legislation ${id}:`, error);
    return NextResponse.json({ message: 'Error deleting legislation', error: (error as Error).message }, { status: 500 });
  }
}