import { NextRequest, NextResponse } from 'next/server';

interface ClickTrackingRequest {
  officeId: string;
  officeName: string;
  website: string;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { officeId, officeName, website, sessionId }: ClickTrackingRequest = await request.json();

    if (!officeId || !officeName || !website) {
      return NextResponse.json(
        { error: 'Missing required fields: officeId, officeName, and website' },
        { status: 400 }
      );
    }

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwardedFor || realIp || 'unknown';

    // Create click data
    const clickData = {
      id: `click_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      officeId,
      officeName,
      website,
      clickedAt: new Date(),
      userAgent,
      ipAddress,
      referrer,
      sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Save to Firebase
    try {
      const { FirebaseService } = await import('../../../../scraper-backend/services/firebaseService');
      
      const firebaseService = new FirebaseService({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL!,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });

      // Save the click data
      await firebaseService.saveWebsiteClick(clickData);

      console.log(`Website click tracked for office ${officeId}: ${website}`);

      return NextResponse.json({
        success: true,
        clickId: clickData.id,
        message: 'Click tracked successfully'
      });

    } catch (firebaseError) {
      console.error('Error saving click to Firebase:', firebaseError);
      return NextResponse.json(
        { error: 'Failed to save click data', details: firebaseError instanceof Error ? firebaseError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Click tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track click', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve click statistics for an office
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get('officeId');

    if (!officeId) {
      return NextResponse.json(
        { error: 'Missing required parameter: officeId' },
        { status: 400 }
      );
    }

    try {
      const { FirebaseService } = await import('../../../../scraper-backend/services/firebaseService');
      
      const firebaseService = new FirebaseService({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL!,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });

      // Get click statistics for the office
      const clickStats = await firebaseService.getClickTrackingStats(officeId);

      return NextResponse.json({
        success: true,
        stats: clickStats
      });

    } catch (firebaseError) {
      console.error('Error getting click stats from Firebase:', firebaseError);
      return NextResponse.json(
        { error: 'Failed to get click statistics', details: firebaseError instanceof Error ? firebaseError.message : 'Unknown error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Get click stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get click statistics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
