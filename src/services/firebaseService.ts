import admin from 'firebase-admin';
import { ArchitectureOffice, SearchResult } from '../types';

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  databaseURL?: string;
}

export class FirebaseService {
  private db!: admin.firestore.Firestore;
  private initialized = false;

  constructor(config?: FirebaseConfig) {
    if (config) {
      this.initializeWithConfig(config);
    } else {
      this.initializeWithDefaultCredentials();
    }
  }

  private initializeWithConfig(config: FirebaseConfig): void {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.projectId,
          privateKey: config.privateKey.replace(/\\n/g, '\n'),
          clientEmail: config.clientEmail
        }),
        databaseURL: config.databaseURL
      });
      
      this.db = admin.firestore();
      this.initialized = true;
      console.log('✅ Firebase initialized with custom config');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase with config:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  private initializeWithDefaultCredentials(): void {
    try {
      // Try to initialize with default credentials (service account key file)
      admin.initializeApp();
      this.db = admin.firestore();
      this.initialized = true;
      console.log('✅ Firebase initialized with default credentials');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase with default credentials:', error);
      throw new Error('Firebase initialization failed. Please provide service account credentials.');
    }
  }

  /**
   * Save a single search result to Firestore
   */
  async saveSearchResult(result: SearchResult): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const docRef = this.db.collection('architecture_searches').doc();
      
      await docRef.set({
        city: result.city,
        searchQuery: result.searchQuery,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(result.timestamp)),
        totalFound: result.totalFound,
        scrapedAt: admin.firestore.Timestamp.now()
      });

      // Save individual offices as subcollection
      const batch = this.db.batch();
      result.offices.forEach((office, index) => {
        const officeRef = docRef.collection('offices').doc(`office_${index}`);
        batch.set(officeRef, {
          ...office
        });
      });

      await batch.commit();
      console.log(`✅ Saved ${result.offices.length} offices for ${result.city} to Firestore`);
    } catch (error) {
      console.error(`❌ Error saving ${result.city} to Firestore:`, error);
      throw error;
    }
  }

  /**
   * Save multiple search results to Firestore
   */
  async saveSearchResults(results: SearchResult[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    console.log(`📤 Saving ${results.length} search results to Firestore...`);
    
    for (const result of results) {
      await this.saveSearchResult(result);
    }

    // Save summary document
    await this.saveSummary(results);
  }

  /**
   * Save a summary document with metadata
   */
  private async saveSummary(results: SearchResult[]): Promise<void> {
    const totalOffices = results.reduce((sum, result) => sum + result.offices.length, 0);
    
    const summaryDoc = {
      scrapedAt: admin.firestore.Timestamp.now(),
      totalCities: results.length,
      totalOffices: totalOffices,
      cities: results.map(r => ({
        name: r.city,
        officeCount: r.offices.length,
        totalFound: r.totalFound,
        timestamp: admin.firestore.Timestamp.fromDate(new Date(r.timestamp))
      }))
    };

    await this.db.collection('scraping_summaries').add(summaryDoc);
    console.log('✅ Summary saved to Firestore');
  }

  /**
   * Get all architecture offices from Firestore
   */
  async getAllOffices(): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      const searchesSnapshot = await this.db.collection('architecture_searches').get();
      
      for (const searchDoc of searchesSnapshot.docs) {
        const officesSnapshot = await searchDoc.ref.collection('offices').get();
        
        officesSnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
          const data = officeDoc.data();
          
          offices.push({
            ...data
          } as ArchitectureOffice);
        });
      }
      
      return offices;
    } catch (error) {
      console.error('❌ Error fetching offices from Firestore:', error);
      throw error;
    }
  }

  /**
   * Get offices by city from Firestore
   */
  async getOfficesByCity(city: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      const searchesSnapshot = await this.db
        .collection('architecture_searches')
        .where('city', '==', city)
        .get();
      
      for (const searchDoc of searchesSnapshot.docs) {
        const officesSnapshot = await searchDoc.ref.collection('offices').get();
        
        officesSnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
          const data = officeDoc.data();
          
          offices.push({
            ...data
          } as ArchitectureOffice);
        });
      }
      
      return offices;
    } catch (error) {
      console.error(`❌ Error fetching offices for ${city} from Firestore:`, error);
      throw error;
    }
  }

  /**
   * Get the latest scraping summary
   */
  async getLatestSummary(): Promise<any> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const summarySnapshot = await this.db
        .collection('scraping_summaries')
        .orderBy('scrapedAt', 'desc')
        .limit(1)
        .get();
      
      if (summarySnapshot.empty) {
        return null;
      }
      
      return summarySnapshot.docs[0].data();
    } catch (error) {
      console.error('❌ Error fetching summary from Firestore:', error);
      throw error;
    }
  }

  /**
   * Delete all data from Firestore (use with caution!)
   */
  async clearAllData(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    console.log('🗑️  Clearing all data from Firestore...');
    
    try {
      // Delete all searches and their subcollections
      const searchesSnapshot = await this.db.collection('architecture_searches').get();
      const batch = this.db.batch();
      
      for (const searchDoc of searchesSnapshot.docs) {
        // Delete offices subcollection
        const officesSnapshot = await searchDoc.ref.collection('offices').get();
        officesSnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
          batch.delete(officeDoc.ref);
        });
        
        // Delete search document
        batch.delete(searchDoc.ref);
      }
      
      await batch.commit();
      
      // Delete summaries
      const summariesSnapshot = await this.db.collection('scraping_summaries').get();
      const summaryBatch = this.db.batch();
      
      summariesSnapshot.docs.forEach((summaryDoc: admin.firestore.DocumentSnapshot) => {
        summaryBatch.delete(summaryDoc.ref);
      });
      
      await summaryBatch.commit();
      
      console.log('✅ All data cleared from Firestore');
    } catch (error) {
      console.error('❌ Error clearing data from Firestore:', error);
      throw error;
    }
  }
} 