import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    // Default values
    let title = 'StatePulse';
    let subtitle = 'Stay Informed on U.S. State-Level Developments';
    let description = 'Track legislation, follow representatives, and stay engaged with state and federal politics.';

    // Handle different types of content
    if (type === 'bill' && id) {
      // Fetch bill data
      const billData = await fetchBillData(id);
      if (billData) {
        title = `${billData.identifier || 'Bill'}: ${billData.title || 'Legislation'}`;
        subtitle = `Latest Action: ${billData.latestActionDescription || 'No recent action'}`;
        description = `Sponsor: ${billData.primarySponsor || 'Unknown'}`;
      }
    } else if (type === 'rep' && id) {
      // Fetch representative data
      const repData = await fetchRepresentativeData(id);
      if (repData) {
        title = repData.name || 'Representative';
        subtitle = `${repData.office || repData.current_role?.title || 'Representative'} ${repData.party ? `(${repData.party})` : ''}`;
        description = repData.jurisdictionName || repData.jurisdiction?.name || 'Government Official';
      }
    } else if (type === 'map') {
      const location = searchParams.get('location') || id;
      if (location) {
        title = `${location} - Political Map`;
        subtitle = 'Explore legislation and representatives';
        description = `View political activity and district boundaries for ${location}`;
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8fafc 75%), linear-gradient(-45deg, transparent 75%, #f8fafc 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                backgroundColor: '#3b82f6',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '20px',
              }}
            >
              <div
                style={{
                  color: 'white',
                  fontSize: '32px',
                  fontWeight: 'bold',
                }}
              >
                SP
              </div>
            </div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#1f2937',
              }}
            >
              StatePulse
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              maxWidth: '800px',
              padding: '0 40px',
            }}
          >
            <h1
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#1f2937',
                marginBottom: '20px',
                lineHeight: '1.2',
              }}
            >
              {title}
            </h1>
            
            <h2
              style={{
                fontSize: '24px',
                color: '#6b7280',
                marginBottom: '16px',
                fontWeight: '500',
              }}
            >
              {subtitle}
            </h2>
            
            <p
              style={{
                fontSize: '18px',
                color: '#9ca3af',
                marginBottom: '40px',
              }}
            >
              {description}
            </p>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '16px',
              color: '#6b7280',
            }}
          >
            <div
              style={{
                marginRight: '8px',
              }}
            >
              🌐
            </div>
            statepulse.me
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error('Error generating OG image:', e);
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
}

async function fetchBillData(id: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/legislation/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching bill data:', error);
    return null;
  }
}

async function fetchRepresentativeData(id: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/representatives/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching representative data:', error);
    return null;
  }
}