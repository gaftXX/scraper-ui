import { NextRequest, NextResponse } from 'next/server';
import { FirebaseService } from '../../../../../scraper-backend/services/firebaseService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'latvia'; // Default to latvia for backward compatibility
    
    const firebaseConfig = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY || '',
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || '',
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };

    const firebaseService = new FirebaseService(firebaseConfig);
    
    // Fetch all offices from all categories for the specified country
    const allOffices = await firebaseService.getAllOffices(country);
    
    console.log(`Fetched ${allOffices.length} offices from Firestore`);

    return NextResponse.json({ 
      offices: allOffices,
      totalOffices: allOffices.length
    });
  } catch (error) {
    console.error('Error fetching Firestore data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 