import { NextRequest, NextResponse } from 'next/server';
import { FirebaseService } from '../../../../../scraper-backend/services/firebaseService';
import { SearchCategory } from '../../../types';

export async function POST(request: NextRequest) {
  try {
    const { intensity, categories } = await request.json();
    
    if (!intensity || !categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const firebaseConfig = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY || '',
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || '',
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };

    const firebaseService = new FirebaseService(firebaseConfig);
    const averageCompletionTime = await firebaseService.getAverageCompletionTime(intensity, categories as SearchCategory[]);

    return NextResponse.json({ averageCompletionTime });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 