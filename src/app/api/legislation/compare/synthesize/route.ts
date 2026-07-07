import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { checkRateLimit } from '@/services/rateLimitService';

interface SynthesizeBill {
  jurisdictionName: string;
  identifier: string;
  title: string;
  geminiSummary?: string | null;
  enactedAt?: string | null;
  statusText?: string | null;
}

interface SynthesizeRequest {
  query: string;
  userState?: string;
  bills: SynthesizeBill[];
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]
    : request.headers.get('x-real-ip') || 'unknown';
  return `compare_synth_ip_${ip}`;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = getClientId(request);
    const rateLimit = await checkRateLimit(`compare_synthesis_${clientId}`);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          message: `Please wait ${rateLimit.timeUntilReset} seconds before generating another comparison.`,
          timeUntilReset: rateLimit.timeUntilReset,
        },
        { status: 429 },
      );
    }

    const body: SynthesizeRequest = await request.json();
    const { query, userState, bills } = body;

    if (!query?.trim() || !bills?.length || bills.length < 2) {
      return NextResponse.json(
        { message: 'At least two state bills are required to generate a comparison.' },
        { status: 400 },
      );
    }

    const context = bills
      .slice(0, 8)
      .map((bill) => {
        const status = bill.enactedAt ? 'Enacted' : bill.statusText || 'In progress';
        return `[${bill.jurisdictionName}, ${bill.identifier}, ${status}]: ${bill.geminiSummary || bill.title}`;
      })
      .join('\n\n');

    const prompt = `You are comparing state legislation. Based ONLY on the bill summaries below about "${query}", write a concise comparison (3-5 sentences).

Rules:
- Cite bill identifiers when mentioning a state (e.g. "California AB 1526")
- Note differences in approach, scope, or status
- If comparing to a user's state (${userState || 'not specified'}), mention how it differs
- Do not invent facts not present in the summaries
- Be factual and neutral

Bills:
${context}

Comparison:`;

    const response = await ai.generate({ prompt });
    const synthesis = response.text.trim();

    if (!synthesis) {
      return NextResponse.json(
        { message: 'Could not generate a comparison summary.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ synthesis }, { status: 200 });
  } catch (error) {
    console.error('Error generating comparison synthesis:', error);
    return NextResponse.json(
      { message: 'Error generating comparison', error: (error as Error).message },
      { status: 500 },
    );
  }
}
