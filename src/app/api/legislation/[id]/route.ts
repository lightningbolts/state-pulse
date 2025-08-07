import { NextResponse } from 'next/server';
import {
  getLegislationById,
  updateLegislation,
  deleteLegislation
} from '@/services/legislationService'; // Corrected path
import type { Legislation } from '@/types/legislation'; // Corrected path

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json() as Partial<Legislation>; // Or a specific update DTO
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
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ message: 'POST method not allowed for this endpoint' }, { status: 405 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ message: 'DELETE method not allowed for this endpoint' }, { status: 405 });
}