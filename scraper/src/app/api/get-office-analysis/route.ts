import { NextRequest, NextResponse } from 'next/server';

// Initialize Firebase Admin if not already initialized
if (!global.firebaseAdminInitialized) {
  try {
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    
    global.firebaseAdminInitialized = true;
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { officeId, country } = await request.json();

    if (!officeId) {
      return NextResponse.json(
        { error: 'Office ID is required' },
        { status: 400 }
      );
    }

    const admin = require('firebase-admin');
    const db = admin.firestore();

    const countryCollection = country || 'latvia';
    const analysisRef = db
      .collection(countryCollection)
      .doc('analyses')
      .collection('offices')
      .doc(officeId);
    
    const analysisDoc = await analysisRef.get();

    if (!analysisDoc.exists) {
      return NextResponse.json({ analysis: null });
    }

    const data = analysisDoc.data();
    
    const analysis = {
      ...data,
      analyzedAt: data.analyzedAt?.toDate(),
      lastUpdated: data.lastUpdated?.toDate()
    };

    return NextResponse.json({ analysis });

  } catch (error) {
    console.error('Error getting office analysis:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
