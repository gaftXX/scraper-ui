import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

const db = admin.firestore();

export async function POST(request: NextRequest) {
  try {
    const { officeId, modifiedName } = await request.json();

    if (!officeId || !modifiedName) {
      return NextResponse.json(
        { error: 'Office ID and modified name are required' },
        { status: 400 }
      );
    }

    // Find the office document across all countries and cities
    const countries = ['latvia', 'spain'];
    let updated = false;

    for (const country of countries) {
      const countryRef = db.collection(country);
      const citiesSnapshot = await countryRef.get();

      for (const cityDoc of citiesSnapshot.docs) {
        const cityRef = countryRef.doc(cityDoc.id);
        
        // Get all category subcollections for this city
        const categoryCollections = await cityDoc.ref.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const categorySnapshot = await categoryCollection.get();
          
          for (const officeDoc of categorySnapshot.docs) {
            const officeData = officeDoc.data();
            
            if (officeData && officeData.uniqueId === officeId) {
              // Update the office with modified name
              await officeDoc.ref.update({
                modifiedName: modifiedName,
                modifiedAt: admin.firestore.Timestamp.now()
              });

              updated = true;
              console.log(`Updated office name for ${officeId} in ${country}/${cityDoc.id}/${categoryCollection.id}/${officeDoc.id}`);
              break;
            }
          }
          if (updated) break;
        }
        if (updated) break;
      }
      if (updated) break;
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Office not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating office name:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
