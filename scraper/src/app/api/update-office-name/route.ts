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
  let officeId: string | undefined;
  let modifiedName: string | undefined;
  
  try {
    const body = await request.json();
    officeId = body.officeId;
    modifiedName = body.modifiedName;

    if (!officeId || !modifiedName) {
      return NextResponse.json(
        { error: 'Office ID and modified name are required' },
        { status: 400 }
      );
    }

    console.log(`Starting office name update for ${officeId}...`);

    // Use optimized search with early termination
    console.log('Using optimized manual search method...');
    const countries = ['latvia', 'spain'];
    let updated = false;

    // Search in parallel for better performance
    const searchPromises = countries.map(async (country) => {
      try {
        const countryRef = db.collection(country);
        const citiesSnapshot = await countryRef.get();

        for (const cityDoc of citiesSnapshot.docs) {
          // Get all category subcollections for this city
          const categoryCollections = await cityDoc.ref.listCollections();
          
          for (const categoryCollection of categoryCollections) {
            // Use a query to find the office directly instead of getting all documents
            const officeQuery = categoryCollection.where('uniqueId', '==', officeId).limit(1);
            const officeSnapshot = await officeQuery.get();
            
            if (!officeSnapshot.empty) {
              const officeDoc = officeSnapshot.docs[0];
              // Update the office with modified name
              await officeDoc.ref.update({
                modifiedName: modifiedName,
                modifiedAt: admin.firestore.Timestamp.now()
              });

              console.log(`Updated office name for ${officeId} in ${country}/${cityDoc.id}/${categoryCollection.id}/${officeDoc.id}`);
              return true; // Found and updated
            }
          }
        }
        return false; // Not found in this country
      } catch (error) {
        console.error(`Error searching in ${country}:`, error);
        return false;
      }
    });

    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    updated = results.some(result => result === true);

    if (!updated) {
      return NextResponse.json(
        { error: 'Office not found' },
        { status: 404 }
      );
    }

    console.log(`Office name update completed for ${officeId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating office name:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      officeId,
      modifiedName
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
