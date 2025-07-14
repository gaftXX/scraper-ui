import admin from 'firebase-admin';
import { ArchitectureOffice, SearchResult, ScrapingTiming, SearchCategory } from '../types';

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

  /**
   * Sanitize office name to create a valid Firestore document ID
   */
  private sanitizeDocumentId(name: string): string {
    if (!name || typeof name !== 'string') {
      return `office_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Replace special characters and spaces with underscores
    let sanitized = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
      .replace(/\s+/g, '_')      // Replace spaces with underscores
      .replace(/-+/g, '_')       // Replace hyphens with underscores
      .replace(/_+/g, '_')       // Replace multiple underscores with single underscore
      .replace(/^_|_$/g, '');    // Remove leading/trailing underscores

    // Ensure it's not empty and not too long
    if (!sanitized || sanitized.length === 0) {
      sanitized = `office_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if (sanitized.length > 100) {
      // Truncate if too long, but keep it readable
      sanitized = sanitized.substring(0, 100);
    }

    // Ensure it doesn't start with a period or be just periods
    if (sanitized.startsWith('.') || sanitized === '.' || sanitized === '..') {
      sanitized = `office_${sanitized}`;
    }

    return sanitized;
  }

  private initializeWithConfig(config: FirebaseConfig): void {
    try {
      // Check if Firebase app is already initialized
      let app: admin.app.App;
      
      try {
        // Try to get the default app first
        app = admin.app();
        console.log('✅ Using existing Firebase app');
      } catch (error) {
        // If no default app exists, create a new one
        app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.projectId,
            privateKey: config.privateKey.replace(/\\n/g, '\n'),
            clientEmail: config.clientEmail
          }),
          databaseURL: config.databaseURL
        });
        console.log('✅ Firebase initialized with custom config');
      }
      
      this.db = admin.firestore(app);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase with config:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  private initializeWithDefaultCredentials(): void {
    try {
      // Check if Firebase app is already initialized
      let app: admin.app.App;
      
      try {
        // Try to get the default app first
        app = admin.app();
        console.log('✅ Using existing Firebase app with default credentials');
      } catch (error) {
        // If no default app exists, create a new one
        app = admin.initializeApp();
        console.log('✅ Firebase initialized with default credentials');
      }
      
      this.db = admin.firestore(app);
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Firebase with default credentials:', error);
      throw new Error('Firebase initialization failed. Please provide service account credentials.');
    }
  }

  /**
   * Get collection name based on search categories
   */
  private getCollectionName(searchQuery: string, category?: string): string {
    // Use explicit category if provided
    if (category) {
      return category;
    }
    
    // Fall back to extracting category from search query (for backwards compatibility)
    if (searchQuery.includes('architecture-only') || searchQuery.includes('Pure Architecture')) {
      return 'architecture-only';
    } else if (searchQuery.includes('construction') || searchQuery.includes('Construction')) {
      return 'construction';
    } else if (searchQuery.includes('interior-design') || searchQuery.includes('Interior Design')) {
      return 'interior-design';
    } else if (searchQuery.includes('property-development') || searchQuery.includes('Property Development')) {
      return 'property-development';
    } else {
      // Default to architecture-only if category cannot be determined
      return 'architecture-only';
    }
  }

  /**
   * Save a single search result to Firestore with proper hierarchy: latvia > city > category > office
   */
  async saveSearchResult(result: SearchResult, category?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      // Determine category name - prioritize explicit parameter, then result.category, then parse from search query
      const categoryName = category || result.category || this.getCollectionName(result.searchQuery);
      
      // Use latvia as main collection, city as document, category as subcollection
      const cityDocRef = this.db.collection('latvia').doc(result.city);
      
      // Save city metadata
      await cityDocRef.set({
        city: result.city,
        lastUpdated: admin.firestore.Timestamp.now(),
        scrapedAt: admin.firestore.Timestamp.now()
      }, { merge: true }); // Use merge to avoid overwriting existing data

      // Group offices by category
      const officesByCategory = new Map<string, ArchitectureOffice[]>();
      
      result.offices.forEach((office) => {
        const officeCategory = office.category || categoryName;
        if (!officesByCategory.has(officeCategory)) {
          officesByCategory.set(officeCategory, []);
        }
        officesByCategory.get(officeCategory)!.push(office);
      });

      // Save offices to category subcollections
      for (const [categoryKey, offices] of officesByCategory) {
        const batch = this.db.batch();
        const usedDocIds = new Set<string>();
        
        offices.forEach((office, index) => {
          // Use sanitized office name as document ID
          let docId = this.sanitizeDocumentId(office.name);
          
          // Handle potential collisions by appending a number
          let counter = 1;
          const originalDocId = docId;
          while (usedDocIds.has(docId)) {
            docId = `${originalDocId}_${counter}`;
            counter++;
          }
          usedDocIds.add(docId);
          
          // Save office under latvia > city > category > office
          const officeRef = cityDocRef.collection(categoryKey).doc(docId);
          
          // Clean office data - remove undefined values and convert them to null or omit them
          const cleanOfficeData: any = {
            name: office.name || '',
            address: office.address || '',
            category: categoryKey,
            scrapedAt: admin.firestore.Timestamp.now()
          };

          // Only add fields that have actual values
          if (office.phone) cleanOfficeData.phone = office.phone;
          if (office.website) cleanOfficeData.website = office.website;
          if (office.email) cleanOfficeData.email = office.email;
          if (office.rating !== undefined) cleanOfficeData.rating = office.rating;
          if (office.reviews !== undefined) cleanOfficeData.reviews = office.reviews;
          if (office.hours) cleanOfficeData.hours = office.hours;
          if (office.description) cleanOfficeData.description = office.description;

          if (office.placeId) cleanOfficeData.placeId = office.placeId;
          


          batch.set(officeRef, cleanOfficeData);
        });

        await batch.commit();
        console.log(`✅ Saved ${offices.length} offices for ${result.city} to latvia/${result.city}/${categoryKey}/ using office names as document IDs`);
      }
    } catch (error) {
      console.error(`❌ Error saving ${result.city} to Firestore:`, error);
      throw error;
    }
  }

  /**
   * Check for duplicate offices based on name and address
   */
  private async findDuplicateOffices(offices: ArchitectureOffice[]): Promise<ArchitectureOffice[]> {
    console.log(`🔍 Checking ${offices.length} offices for duplicates...`);
    
    try {
      const existingOffices = await this.getAllOffices();
      const newOffices: ArchitectureOffice[] = [];
      let duplicatesFound = 0;

      for (const office of offices) {
        const isDuplicate = existingOffices.some(existing => {
          // Check for duplicates based on name and address
          const nameMatch = existing.name && office.name && 
                           existing.name.toLowerCase().trim() === office.name.toLowerCase().trim();
          
          const addressMatch = existing.address && office.address && 
                              existing.address.toLowerCase().trim() === office.address.toLowerCase().trim();
          
          // Also check by placeId if available
          const placeIdMatch = existing.placeId && office.placeId && 
                              existing.placeId === office.placeId;

          return placeIdMatch || (nameMatch && addressMatch);
        });

        if (!isDuplicate) {
          // Mark as new office (not existing in database)
          newOffices.push({ ...office, existedInDatabase: false });
        } else {
          duplicatesFound++;
          console.log(`⚠️  Duplicate found: ${office.name} - ${office.address}`);
        }
      }

      console.log(`✅ Duplicate check complete: ${newOffices.length} new, ${duplicatesFound} duplicates`);
      return newOffices;
    } catch (error) {
      console.error('❌ Error checking for duplicates:', error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Check for duplicate offices within a specific category
   */
  private async findDuplicateOfficesInCategory(offices: ArchitectureOffice[], category: string): Promise<ArchitectureOffice[]> {
    console.log(`🔍 Checking ${offices.length} offices for duplicates in ${category} category...`);
    
    try {
      const existingOffices = await this.getAllOfficesInCategory(category);
      const newOffices: ArchitectureOffice[] = [];
      let duplicatesFound = 0;

      for (const office of offices) {
        const isDuplicate = existingOffices.some(existing => {
          // Check for duplicates based on name and address
          const nameMatch = existing.name && office.name && 
                           existing.name.toLowerCase().trim() === office.name.toLowerCase().trim();
          
          const addressMatch = existing.address && office.address && 
                              existing.address.toLowerCase().trim() === office.address.toLowerCase().trim();
          
          // Also check by placeId if available
          const placeIdMatch = existing.placeId && office.placeId && 
                              existing.placeId === office.placeId;

          return placeIdMatch || (nameMatch && addressMatch);
        });

        if (!isDuplicate) {
          // Mark as new office (not existing in database)
          newOffices.push({ ...office, existedInDatabase: false });
        } else {
          duplicatesFound++;
          console.log(`⚠️  Duplicate found in ${category}: ${office.name} - ${office.address}`);
        }
      }

      console.log(`✅ Duplicate check complete for ${category}: ${newOffices.length} new, ${duplicatesFound} duplicates`);
      return newOffices;
    } catch (error) {
      console.error(`❌ Error checking for duplicates in ${category}:`, error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Mark offices as existing or new in database
   */
  async markOfficesExistenceInDatabase(offices: ArchitectureOffice[]): Promise<ArchitectureOffice[]> {
    console.log(`🔍 Checking ${offices.length} offices against database...`);
    
    try {
      const existingOffices = await this.getAllOffices();
      const markedOffices: ArchitectureOffice[] = [];

      for (const office of offices) {
        const existsInDatabase = existingOffices.some(existing => {
          // Check for existence based on name and address
          const nameMatch = existing.name && office.name && 
                           existing.name.toLowerCase().trim() === office.name.toLowerCase().trim();
          
          const addressMatch = existing.address && office.address && 
                              existing.address.toLowerCase().trim() === office.address.toLowerCase().trim();
          
          // Also check by placeId if available
          const placeIdMatch = existing.placeId && office.placeId && 
                              existing.placeId === office.placeId;

          return placeIdMatch || (nameMatch && addressMatch);
        });

        markedOffices.push({ ...office, existedInDatabase: existsInDatabase });
      }

      console.log(`✅ Database existence check complete: ${markedOffices.filter(o => o.existedInDatabase).length} existing, ${markedOffices.filter(o => !o.existedInDatabase).length} new`);
      return markedOffices;
    } catch (error) {
      console.error('❌ Error checking database existence:', error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Save multiple search results to Firestore with duplicate checking and category separation
   */
  async saveSearchResults(results: SearchResult[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    console.log(`📤 Saving ${results.length} search results to Firestore...`);
    
    // Group results by category
    const resultsByCategory = new Map<string, SearchResult[]>();
    
    for (const result of results) {
      const category = this.getCollectionName(result.searchQuery, result.category);
      
      if (!resultsByCategory.has(category)) {
        resultsByCategory.set(category, []);
      }
      
      resultsByCategory.get(category)!.push(result);
    }

    console.log(`📊 Results grouped into ${resultsByCategory.size} categories:`);
    for (const [category, categoryResults] of resultsByCategory) {
      const totalOffices = categoryResults.reduce((sum, result) => sum + result.offices.length, 0);
      console.log(`   🏷️  ${category}: ${totalOffices} offices across ${categoryResults.length} cities`);
    }

    let totalNewOffices = 0;

    // Process each category separately
    for (const [category, categoryResults] of resultsByCategory) {
      console.log(`\n🔄 Processing category: ${category}`);
      
      // Flatten all offices from category results
      const allOffices = categoryResults.flatMap(result => result.offices);
      console.log(`📊 Total offices in ${category}: ${allOffices.length}`);

      // Check for duplicates within this category
      const newOffices = await this.findDuplicateOfficesInCategory(allOffices, category);
      
      if (newOffices.length === 0) {
        console.log(`ℹ️  No new offices to save in ${category} (all were duplicates)`);
        continue;
      }

      // Create new results with only new offices
      const newResults: SearchResult[] = [];
      
      for (const result of categoryResults) {
        const cityNewOffices = newOffices.filter(office => {
          // Try to match offices back to their original cities
          return result.offices.some(originalOffice => 
            originalOffice.name === office.name && originalOffice.address === office.address
          );
        });

        if (cityNewOffices.length > 0) {
          newResults.push({
            ...result,
            offices: cityNewOffices,
            totalFound: cityNewOffices.length
          });
        }
      }

      // Save only new offices for this category
      for (const result of newResults) {
        await this.saveSearchResult(result, category);
      }
      
      totalNewOffices += newOffices.length;
      console.log(`✅ Saved ${newOffices.length} new offices to ${category} collection`);
    }
    
    console.log(`\n🎉 Successfully saved ${totalNewOffices} new offices across ${resultsByCategory.size} category collections`);
  }

  /**
   * Generate a unique key for categories combination
   */
  private generateCategoryKey(categories: SearchCategory[]): string {
    return categories.sort().join('_');
  }

  /**
   * Save scraping timing data to Firestore
   */
  async saveScrapeTimingData(timing: ScrapingTiming): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      // Create a unique key for this intensity + categories combination
      const categoryKey = this.generateCategoryKey(timing.categories);
      timing.categoryKey = categoryKey;

      const timingRef = this.db.collection('scrape_timing')
        .doc(timing.intensity.toString())
        .collection('categories')
        .doc(categoryKey);
      
      // Get the existing timings array or create a new one
      const doc = await timingRef.get();
      const timings = doc.exists ? doc.data()?.timings || [] : [];
      
      // Add new timing data
      timings.push({
        ...timing,
        timestamp: admin.firestore.Timestamp.fromDate(timing.timestamp)
      });

      // Keep only the last 10 timings for each intensity level and category combination
      const recentTimings = timings.slice(-10);
      
      await timingRef.set({
        intensity: timing.intensity,
        maxResults: timing.maxResults,
        searchRadius: timing.searchRadius,
        categories: timing.categories,
        categoryKey: categoryKey,
        timings: recentTimings,
        averageCompletionTime: this.calculateAverageTime(recentTimings),
        lastUpdated: admin.firestore.Timestamp.now()
      }, { merge: true });

      console.log(`✅ Saved timing data for intensity level ${timing.intensity} and categories: ${timing.categories.join(', ')}`);
    } catch (error) {
      console.error('❌ Error saving timing data:', error);
      throw error;
    }
  }

  /**
   * Get average completion time for a specific intensity level and categories
   */
  async getAverageCompletionTime(intensity: number, categories: SearchCategory[]): Promise<number | null> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const categoryKey = this.generateCategoryKey(categories);
      const timingRef = this.db.collection('scrape_timing')
        .doc(intensity.toString())
        .collection('categories')
        .doc(categoryKey);
      
      const doc = await timingRef.get();
      if (!doc.exists) {
        return null;
      }

      return doc.data()?.averageCompletionTime || null;
    } catch (error) {
      console.error('❌ Error getting average completion time:', error);
      return null;
    }
  }

  private calculateAverageTime(timings: ScrapingTiming[]): number {
    if (timings.length === 0) return 0;
    const sum = timings.reduce((acc, timing) => acc + timing.completionTime, 0);
    return Math.round(sum / timings.length);
  }


  /**
   * Get all architecture offices from Firestore (all categories and cities)
   */
  async getAllOffices(): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get all city documents from latvia collection
      const latviaSnapshot = await this.db.collection('latvia').get();
      
      for (const cityDoc of latviaSnapshot.docs) {
        const cityName = cityDoc.id;
        
        // Get all category subcollections for this city
        const categoryCollections = await cityDoc.ref.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const categorySnapshot = await categoryCollection.get();
          
          categorySnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
            const data = officeDoc.data();
            
            if (data) {
              offices.push({
                name: data.name || '',
                address: data.address || '',
                phone: data.phone,
                website: data.website,
                email: data.email,
                rating: data.rating,
                reviews: data.reviews,
                hours: data.hours,
                description: data.description,
                placeId: data.placeId,
                city: cityName,
                category: data.category || categoryCollection.id
              });
            }
          });
        }
      }
      
      return offices;
    } catch (error) {
      console.error('❌ Error fetching offices from Firestore:', error);
      throw error;
    }
  }

  /**
   * Get all architecture offices from a specific category across all cities
   */
  async getAllOfficesInCategory(category: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get all city documents from latvia collection
      const latviaSnapshot = await this.db.collection('latvia').get();
      
      for (const cityDoc of latviaSnapshot.docs) {
        const cityName = cityDoc.id;
        
        // Get the specific category subcollection for this city
        const categorySnapshot = await cityDoc.ref.collection(category).get();
        
        categorySnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
          const data = officeDoc.data();
          
          if (data) {
            offices.push({
              name: data.name || '',
              address: data.address || '',
              phone: data.phone,
              website: data.website,
              email: data.email,
              rating: data.rating,
              reviews: data.reviews,
              hours: data.hours,
              description: data.description,
              placeId: data.placeId,
              city: cityName,
              category: category
            });
          }
        });
      }
      
      return offices;
    } catch (error) {
      console.error(`❌ Error fetching offices from ${category} category:`, error);
      throw error;
    }
  }

  /**
   * Get offices by city from Firestore (all categories)
   */
  async getOfficesByCity(city: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get the specific city document from latvia collection
      const cityDocRef = this.db.collection('latvia').doc(city);
      const cityDoc = await cityDocRef.get();
      
      if (cityDoc.exists) {
        // Get all category subcollections for this city
        const categoryCollections = await cityDocRef.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const categorySnapshot = await categoryCollection.get();
          
          categorySnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
            const data = officeDoc.data();
            
            if (data) {
              offices.push({
                name: data.name || '',
                address: data.address || '',
                phone: data.phone,
                website: data.website,
                email: data.email,
                rating: data.rating,
                reviews: data.reviews,
                hours: data.hours,
                description: data.description,
                placeId: data.placeId,
                city: city,
                category: data.category || categoryCollection.id
              });
            }
          });
        }
      }
      
      return offices;
    } catch (error) {
      console.error(`❌ Error fetching offices for ${city} from Firestore:`, error);
      throw error;
    }
  }

  /**
   * Get offices by city and category from Firestore
   */
  async getOfficesByCityAndCategory(city: string, category: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get the specific city document from latvia collection
      const cityDocRef = this.db.collection('latvia').doc(city);
      const cityDoc = await cityDocRef.get();
      
      if (cityDoc.exists) {
        // Get the specific category subcollection for this city
        const categorySnapshot = await cityDocRef.collection(category).get();
        
        categorySnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
          const data = officeDoc.data();
          
          if (data) {
            offices.push({
              name: data.name || '',
              address: data.address || '',
              phone: data.phone,
              website: data.website,
              email: data.email,
              rating: data.rating,
              reviews: data.reviews,
              hours: data.hours,
              description: data.description,
              placeId: data.placeId,
              city: city,
              category: category
            });
          }
        });
      }
      
      return offices;
    } catch (error) {
      console.error(`❌ Error fetching offices for ${city} in ${category} from Firestore:`, error);
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
      // Delete all cities and their subcollections from latvia collection
      const latviaSnapshot = await this.db.collection('latvia').get();
      
      for (const cityDoc of latviaSnapshot.docs) {
        console.log(`🗑️  Clearing ${cityDoc.id} city data...`);
        
        // Get all category subcollections for this city
        const categoryCollections = await cityDoc.ref.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const categorySnapshot = await categoryCollection.get();
          const batch = this.db.batch();
          
          // Delete all offices in this category
          categorySnapshot.docs.forEach((officeDoc: admin.firestore.DocumentSnapshot) => {
            batch.delete(officeDoc.ref);
          });
          
          await batch.commit();
          console.log(`✅ ${cityDoc.id}/${categoryCollection.id} cleared`);
        }
        
        // Delete the city document itself
        await cityDoc.ref.delete();
        console.log(`✅ ${cityDoc.id} city document deleted`);
      }
      
      console.log('✅ All data cleared from latvia collection');
    } catch (error) {
      console.error('❌ Error clearing data from Firestore:', error);
      throw error;
    }
  }
} 