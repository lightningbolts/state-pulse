import { NextResponse } from 'next/server';
import { getPolicyDiffusion } from '@/lib/policyDiffusionService';
import { CDN_CACHE, jsonWithCdnCache } from '@/lib/cdnCache';

export async function GET() {
  try {
    const data = await getPolicyDiffusion();
    return jsonWithCdnCache({
      success: true,
      data,
    }, CDN_CACHE.dashboard);
  } catch (error) {
    console.error('[Policy Diffusion API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch policy diffusion',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
