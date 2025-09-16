import admin from 'firebase-admin';
import { ArchitectureOffice, SearchResult, ScrapingTiming, SearchCategory, ProjectData, ProjectCollection, OfficeAnalysis, WebsiteClick, ClickTrackingStats } from '../types';

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
      // Use provided configuration
      this.initializeWithConfig(config);
      console.log('Firebase initialized with custom config');
          } else {
        // Use environment variables
        this.initializeWithDefaultCredentials();
        console.log('Firebase initialized with default credentials');
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
        console.log('Using existing Firebase app');
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
        console.log('Firebase initialized with custom config');
      }
      
      this.db = admin.firestore(app);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Firebase with config:', error);
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
        console.log('Using existing Firebase app with default credentials');
      } catch (error) {
        // If no default app exists, create a new one
        app = admin.initializeApp();
        console.log('Firebase initialized with default credentials');
      }
      
      this.db = admin.firestore(app);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Firebase with default credentials:', error);
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
   * Save a single search result to Firestore with proper hierarchy: country > city > category > office
   */
  async saveSearchResult(result: SearchResult, category?: string, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      // Determine category name - prioritize explicit parameter, then result.category, then parse from search query
      const categoryName = category || result.category || this.getCollectionName(result.searchQuery);
      
      // Use country as main collection, city as document, category as subcollection
      const countryCollection = country || 'latvia'; // Default to latvia for backward compatibility
      const cityDocRef = this.db.collection(countryCollection).doc(result.city);
      
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
          if (office.uniqueId) cleanOfficeData.uniqueId = office.uniqueId;
          
          // Preserve custom data and metadata
          if (office.modifiedName) cleanOfficeData.modifiedName = office.modifiedName;
          if (office.customData) {
            cleanOfficeData.customData = {
              ...office.customData,
              lastModified: office.customData.lastModified ? admin.firestore.Timestamp.fromDate(office.customData.lastModified) : admin.firestore.Timestamp.now()
            };
          }
          if (office.metadata) {
            cleanOfficeData.metadata = {
              ...office.metadata,
              scrapedAt: office.metadata.scrapedAt ? admin.firestore.Timestamp.fromDate(office.metadata.scrapedAt) : admin.firestore.Timestamp.now(),
              lastUpdated: office.metadata.lastUpdated ? admin.firestore.Timestamp.fromDate(office.metadata.lastUpdated) : admin.firestore.Timestamp.now()
            };
          }

          batch.set(officeRef, cleanOfficeData);
        });

        await batch.commit();
        console.log(`Saved ${offices.length} offices for ${result.city} to latvia/${result.city}/${categoryKey}/ using office names as document IDs`);
      }
    } catch (error) {
      console.error(`Error saving ${result.city} to Firestore:`, error);
      throw error;
    }
  }

  /**
   * Check for duplicate offices based on name and address
   */
  private async findDuplicateOffices(offices: ArchitectureOffice[], country?: string): Promise<ArchitectureOffice[]> {
    console.log(`Checking ${offices.length} offices for duplicates...`);
    
    try {
      const existingOffices = await this.getAllOffices(country);
      const resultOffices: ArchitectureOffice[] = [];
      let duplicatesFound = 0;
      let newOfficesFound = 0;

      for (const office of offices) {
        const existingOffice = existingOffices.find(existing => {
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

        if (existingOffice) {
          // This is a duplicate - preserve the existing office with its custom data
          duplicatesFound++;
          console.log(`Duplicate found: ${office.name} - ${office.address}`);
          
          // Preserve the existing office data (including customData and modifiedName) but update scraped fields
          resultOffices.push({
            ...existingOffice, // Keep existing data including customData and modifiedName
            ...office, // Update with fresh scraped data
            modifiedName: existingOffice.modifiedName, // Explicitly preserve modifiedName
            customData: existingOffice.customData, // Explicitly preserve customData
            metadata: {
              ...existingOffice.metadata,
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: (existingOffice.metadata?.dataVersion || 0) + 1,
              customDataExists: !!existingOffice.customData
            },
            existedInDatabase: true
          });
        } else {
          // This is a new office
          newOfficesFound++;
          resultOffices.push({ 
            ...office, 
            existedInDatabase: false,
            metadata: {
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: 1,
              customDataExists: false
            }
          });
        }
      }

      console.log(`Duplicate check complete: ${newOfficesFound} new, ${duplicatesFound} duplicates (preserved with modifiedName)`);
      return resultOffices;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Check for duplicate offices within a specific category
   */
  private async findDuplicateOfficesInCategory(offices: ArchitectureOffice[], category: string, country?: string): Promise<ArchitectureOffice[]> {
    console.log(`Checking ${offices.length} offices for duplicates in ${category} category...`);
    
    try {
      const existingOffices = await this.getAllOfficesInCategory(category, country);
      const resultOffices: ArchitectureOffice[] = [];
      let duplicatesFound = 0;
      let newOfficesFound = 0;

      for (const office of offices) {
        const existingOffice = existingOffices.find(existing => {
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

        if (existingOffice) {
          // This is a duplicate - preserve the existing office with its custom data
          duplicatesFound++;
          console.log(`Duplicate found in ${category}: ${office.name} - ${office.address}`);
          
          // Preserve the existing office data (including customData and modifiedName) but update scraped fields
          resultOffices.push({
            ...existingOffice, // Keep existing data including customData and modifiedName
            ...office, // Update with fresh scraped data
            modifiedName: existingOffice.modifiedName, // Explicitly preserve modifiedName
            customData: existingOffice.customData, // Explicitly preserve customData
            metadata: {
              ...existingOffice.metadata,
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: (existingOffice.metadata?.dataVersion || 0) + 1,
              customDataExists: !!existingOffice.customData
            },
            existedInDatabase: true
          });
        } else {
          // This is a new office
          newOfficesFound++;
          resultOffices.push({ 
            ...office, 
            existedInDatabase: false,
            metadata: {
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: 1,
              customDataExists: false
            }
          });
        }
      }

      console.log(`Duplicate check complete for ${category}: ${newOfficesFound} new, ${duplicatesFound} duplicates (preserved with modifiedName)`);
      return resultOffices;
    } catch (error) {
      console.error(`Error checking for duplicates in ${category}:`, error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Mark offices as existing or new in database
   */
  async markOfficesExistenceInDatabase(offices: ArchitectureOffice[], country?: string): Promise<ArchitectureOffice[]> {
    console.log(`Checking ${offices.length} offices against database...`);
    
    try {
      const existingOffices = await this.getAllOffices(country);
      const markedOffices: ArchitectureOffice[] = [];
      let duplicatesFound = 0;
      let newOfficesFound = 0;

      for (const office of offices) {
        const existingOffice = existingOffices.find(existing => {
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

        if (existingOffice) {
          // This is a duplicate - preserve the existing office with its custom data
          duplicatesFound++;
          console.log(`Duplicate found: ${office.name} - ${office.address} (preserving custom data: ${existingOffice.customData ? 'yes' : 'no'})`);
          
          // Preserve the existing office data (including customData and modifiedName) but update scraped fields
          markedOffices.push({
            ...existingOffice, // Keep existing data including customData and modifiedName
            ...office, // Update with fresh scraped data
            modifiedName: existingOffice.modifiedName, // Explicitly preserve modifiedName
            customData: existingOffice.customData, // Explicitly preserve customData
            metadata: {
              ...existingOffice.metadata,
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: (existingOffice.metadata?.dataVersion || 0) + 1,
              customDataExists: !!existingOffice.customData
            },
            existedInDatabase: true
          });
        } else {
          // This is a new office
          newOfficesFound++;
          markedOffices.push({ 
            ...office, 
            existedInDatabase: false,
            metadata: {
              scrapedAt: new Date(),
              lastUpdated: new Date(),
              dataVersion: 1,
              customDataExists: false
            }
          });
        }
      }

      console.log(`Database existence check complete: ${newOfficesFound} new, ${duplicatesFound} duplicates (preserved with modifiedName)`);
      return markedOffices;
    } catch (error) {
      console.error('Error checking database existence:', error);
      // If error occurs, return all offices marked as not existing in database
      return offices.map(office => ({ ...office, existedInDatabase: false }));
    }
  }

  /**
   * Save multiple search results to Firestore with duplicate checking and category separation
   */
  async saveSearchResults(results: SearchResult[], country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    console.log(`Saving ${results.length} search results to Firestore...`);
    
    // Group results by category
    const resultsByCategory = new Map<string, SearchResult[]>();
    
    for (const result of results) {
      const category = this.getCollectionName(result.searchQuery, result.category);
      
      if (!resultsByCategory.has(category)) {
        resultsByCategory.set(category, []);
      }
      
      resultsByCategory.get(category)!.push(result);
    }

    console.log(`Results grouped into ${resultsByCategory.size} categories:`);
    for (const [category, categoryResults] of resultsByCategory) {
      const totalOffices = categoryResults.reduce((sum, result) => sum + result.offices.length, 0);
              console.log(`   ${category}: ${totalOffices} offices across ${categoryResults.length} cities`);
    }

    let totalNewOffices = 0;

    // Process each category separately
    for (const [category, categoryResults] of resultsByCategory) {
      console.log(`\nProcessing category: ${category}`);
      
      // Flatten all offices from category results
      const allOffices = categoryResults.flatMap(result => result.offices);
      console.log(`Total offices in ${category}: ${allOffices.length}`);

      // Check for duplicates within this category
      const processedOffices = await this.findDuplicateOfficesInCategory(allOffices, category, country);
      
      if (processedOffices.length === 0) {
        console.log(`No offices to process in ${category}`);
        continue;
      }

      // Create new results with processed offices (both new and existing with preserved modifiedName)
      const newResults: SearchResult[] = [];
      
      for (const result of categoryResults) {
        const cityProcessedOffices = processedOffices.filter(office => {
          // Try to match offices back to their original cities
          return result.offices.some(originalOffice => 
            originalOffice.name === office.name && originalOffice.address === office.address
          );
        });

        if (cityProcessedOffices.length > 0) {
          newResults.push({
            ...result,
            offices: cityProcessedOffices,
            totalFound: cityProcessedOffices.length
          });
        }
      }

      // Save processed offices for this category (both new and existing with preserved modifiedName)
      for (const result of newResults) {
        await this.saveSearchResult(result, category, country);
      }
      
      const newOfficesCount = processedOffices.filter(office => !office.existedInDatabase).length;
      totalNewOffices += newOfficesCount;
      console.log(`Saved ${processedOffices.length} offices to ${category} collection (${newOfficesCount} new, ${processedOffices.length - newOfficesCount} existing with preserved modifiedName)`);
    }
    
    console.log(`\nSuccessfully saved ${totalNewOffices} new offices across ${resultsByCategory.size} category collections`);
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

      console.log(`Saved timing data for intensity level ${timing.intensity} and categories: ${timing.categories.join(', ')}`);
    } catch (error) {
      console.error('Error saving timing data:', error);
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
      console.error('Error getting average completion time:', error);
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
  async getAllOffices(country?: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get all city documents from specified country collection (default to latvia)
      const countryCollection = country || 'latvia';
      const countrySnapshot = await this.db.collection(countryCollection).get();
      
      for (const cityDoc of countrySnapshot.docs) {
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
                category: data.category || categoryCollection.id,
                uniqueId: data.uniqueId,
                modifiedName: data.modifiedName,
                modifiedAt: data.modifiedAt,
                customData: data.customData ? {
                  ...data.customData,
                  lastModified: data.customData.lastModified?.toDate()
                } : undefined,
                metadata: data.metadata ? {
                  ...data.metadata,
                  scrapedAt: data.metadata.scrapedAt?.toDate(),
                  lastUpdated: data.metadata.lastUpdated?.toDate()
                } : undefined
              });
            }
          });
        }
      }
      
      return offices;
    } catch (error) {
      console.error('Error fetching offices from Firestore:', error);
      throw error;
    }
  }

  /**
   * Get all architecture offices from a specific category across all cities
   */
  async getAllOfficesInCategory(category: string, country?: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get all city documents from specified country collection (default to latvia)
      const countryCollection = country || 'latvia';
      const countrySnapshot = await this.db.collection(countryCollection).get();
      
      for (const cityDoc of countrySnapshot.docs) {
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
              category: category,
              uniqueId: data.uniqueId,
              modifiedName: data.modifiedName,
              modifiedAt: data.modifiedAt
            });
          }
        });
      }
      
      return offices;
    } catch (error) {
      console.error(`Error fetching offices from ${category} category:`, error);
      throw error;
    }
  }

  /**
   * Get offices by city from Firestore (all categories)
   */
  async getOfficesByCity(city: string, country?: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get the specific city document from specified country collection (default to latvia)
      const countryCollection = country || 'latvia';
      const cityDocRef = this.db.collection(countryCollection).doc(city);
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
                category: data.category || categoryCollection.id,
                uniqueId: data.uniqueId
              });
            }
          });
        }
      }
      
      return offices;
    } catch (error) {
      console.error(`Error fetching offices for ${city} from Firestore:`, error);
      throw error;
    }
  }

  /**
   * Get offices by city and category from Firestore
   */
  async getOfficesByCityAndCategory(city: string, category: string, country?: string): Promise<ArchitectureOffice[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const offices: ArchitectureOffice[] = [];
      
      // Get the specific city document from specified country collection (default to latvia)
      const countryCollection = country || 'latvia';
      const cityDocRef = this.db.collection(countryCollection).doc(city);
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
              category: category,
              uniqueId: data.uniqueId
            });
          }
        });
      }
      
      return offices;
    } catch (error) {
      console.error(`Error fetching offices for ${city} in ${category} from Firestore:`, error);
      throw error;
    }
  }



  /**
   * Delete all data from Firestore (use with caution!)
   */
  async clearAllData(country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    const countryCollection = country || 'latvia';
    console.log(`Clearing all data from ${countryCollection} collection in Firestore...`);
    
    try {
      // Delete all cities and their subcollections from specified country collection
      const countrySnapshot = await this.db.collection(countryCollection).get();
      
      for (const cityDoc of countrySnapshot.docs) {
        console.log(`Clearing ${cityDoc.id} city data...`);
        
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
                      console.log(`${cityDoc.id}/${categoryCollection.id} cleared`);
        }
        
        // Delete the city document itself
        await cityDoc.ref.delete();
                  console.log(`${cityDoc.id} city document deleted`);
      }
      
              console.log('All data cleared from latvia collection');
    } catch (error) {
      console.error('Error clearing data from Firestore:', error);
      throw error;
    }
  }

  // **PROJECT DATA MANAGEMENT METHODS**

  /**
   * Save project data for an architecture office
   */
  async saveProjectData(project: ProjectData, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const projectRef = this.db
        .collection(countryCollection)
        .doc('projects')
        .collection('offices')
        .doc(project.officeId)
        .collection('projects')
        .doc(project.id);

      const projectData = {
        ...project,
        createdAt: admin.firestore.Timestamp.fromDate(project.createdAt),
        updatedAt: admin.firestore.Timestamp.fromDate(project.updatedAt)
      };

      await projectRef.set(projectData, { merge: true });
      console.log(`Saved project data for office ${project.officeId}: ${project.name}`);
    } catch (error) {
      console.error('Error saving project data:', error);
      throw error;
    }
  }

  /**
   * Get all projects for a specific architecture office
   */
  async getProjectsForOffice(officeId: string, country?: string): Promise<ProjectData[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const projectsSnapshot = await this.db
        .collection(countryCollection)
        .doc('projects')
        .collection('offices')
        .doc(officeId)
        .collection('projects')
        .get();

      const projects: ProjectData[] = [];
      projectsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        projects.push({
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as ProjectData);
      });

      return projects;
    } catch (error) {
      console.error('Error getting projects for office:', error);
      throw error;
    }
  }

  /**
   * Update custom data for an architecture office
   */
  async updateOfficeCustomData(officeId: string, customData: any, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      
      // Find the office document across all cities and categories
      const countrySnapshot = await this.db.collection(countryCollection).get();
      
      for (const cityDoc of countrySnapshot.docs) {
        const categoryCollections = await cityDoc.ref.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const officeSnapshot = await categoryCollection
            .where('uniqueId', '==', officeId)
            .limit(1)
            .get();

          if (!officeSnapshot.empty) {
            const officeDoc = officeSnapshot.docs[0];
            const officeRef = officeDoc.ref;
            
            const updateData = {
              customData: {
                ...customData,
                lastModified: admin.firestore.Timestamp.now()
              },
              metadata: {
                lastUpdated: admin.firestore.Timestamp.now(),
                customDataExists: true
              }
            };

            await officeRef.update(updateData);
            console.log(`Updated custom data for office ${officeId}`);
            return;
          }
        }
      }
      
      throw new Error(`Office with ID ${officeId} not found`);
    } catch (error) {
      console.error('Error updating office custom data:', error);
      throw error;
    }
  }

  /**
   * Get office by unique ID with all custom data
   */
  async getOfficeById(officeId: string, country?: string): Promise<ArchitectureOffice | null> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const countrySnapshot = await this.db.collection(countryCollection).get();
      
      for (const cityDoc of countrySnapshot.docs) {
        const cityName = cityDoc.id;
        const categoryCollections = await cityDoc.ref.listCollections();
        
        for (const categoryCollection of categoryCollections) {
          const officeSnapshot = await categoryCollection
            .where('uniqueId', '==', officeId)
            .limit(1)
            .get();

          if (!officeSnapshot.empty) {
            const officeDoc = officeSnapshot.docs[0];
            const data = officeDoc.data();
            
            return {
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
              category: data.category || categoryCollection.id,
              uniqueId: data.uniqueId,
              modifiedName: data.modifiedName,
              modifiedAt: data.modifiedAt,
              customData: data.customData ? {
                ...data.customData,
                lastModified: data.customData.lastModified?.toDate()
              } : undefined,
              metadata: data.metadata ? {
                ...data.metadata,
                scrapedAt: data.metadata.scrapedAt?.toDate(),
                lastUpdated: data.metadata.lastUpdated?.toDate()
              } : undefined
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting office by ID:', error);
      throw error;
    }
  }

  /**
   * Delete project data
   */
  async deleteProjectData(officeId: string, projectId: string, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const projectRef = this.db
        .collection(countryCollection)
        .doc('projects')
        .collection('offices')
        .doc(officeId)
        .collection('projects')
        .doc(projectId);

      await projectRef.delete();
      console.log(`Deleted project ${projectId} for office ${officeId}`);
    } catch (error) {
      console.error('Error deleting project data:', error);
      throw error;
    }
  }

  /**
   * Get all project collections for an office
   */
  async getProjectCollectionsForOffice(officeId: string, country?: string): Promise<ProjectCollection[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const collectionsSnapshot = await this.db
        .collection(countryCollection)
        .doc('projects')
        .collection('offices')
        .doc(officeId)
        .collection('collections')
        .get();

      const collections: ProjectCollection[] = [];
      for (const doc of collectionsSnapshot.docs) {
        const data = doc.data();
        const projects = await this.getProjectsForOffice(officeId, country);
        
        collections.push({
          ...data,
          projects: projects,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as ProjectCollection);
      }

      return collections;
    } catch (error) {
      console.error('Error getting project collections:', error);
      throw error;
    }
  }

  // **INPUT ANALYSIS METHODS**

  /**
   * Merge analysis data with feedback tracking
   */
  private mergeAnalysisDataWithFeedback(existingData: any, newAnalysis: any, newAnalysisId: string): { mergedAnalysis: any; feedback: any } {
    if (!existingData) {
      // No existing data, return new analysis with feedback
      return {
        mergedAnalysis: newAnalysis,
        feedback: {
          isNewAnalysis: true,
          projects: {
            added: newAnalysis.projects || [],
            blocked: [],
            updated: []
          },
          team: { updated: !!newAnalysis.team },
          relations: { updated: !!newAnalysis.relations },
          funding: { updated: !!newAnalysis.funding },
          clients: { updated: !!newAnalysis.clients },
          summary: {
            totalProjectsAdded: (newAnalysis.projects || []).length,
            totalProjectsBlocked: 0,
            totalProjectsUpdated: 0
          }
        }
      };
    }

    console.log('Merging analysis data with feedback tracking...');
    console.log('Existing projects:', existingData.projects?.length || 0);
    console.log('New projects:', newAnalysis.projects?.length || 0);

    // Initialize feedback tracking
    const feedback = {
      isNewAnalysis: false,
      projects: {
        added: [] as any[],
        blocked: [] as any[],
        updated: [] as any[]
      },
      team: { updated: false },
      relations: { updated: false },
      funding: { updated: false },
      clients: { updated: false },
      summary: {
        totalProjectsAdded: 0,
        totalProjectsBlocked: 0,
        totalProjectsUpdated: 0
      }
    };

    // Merge projects with feedback tracking
    const projectMergeResult = this.mergeProjectsWithFeedback(existingData.projects || [], newAnalysis.projects || []);
    feedback.projects.added = projectMergeResult.added;
    feedback.projects.blocked = projectMergeResult.blocked;
    feedback.projects.updated = projectMergeResult.updated;
    feedback.summary.totalProjectsAdded = projectMergeResult.added.length;
    feedback.summary.totalProjectsBlocked = projectMergeResult.blocked.length;
    feedback.summary.totalProjectsUpdated = projectMergeResult.updated.length;

    // Merge other data sections
    const mergedTeam = this.mergeTeamData(existingData.team || {}, newAnalysis.team || {});
    feedback.team.updated = Object.keys(newAnalysis.team || {}).length > 0;
    
    const mergedRelations = this.mergeRelationsData(existingData.relations || {}, newAnalysis.relations || {});
    feedback.relations.updated = Object.keys(newAnalysis.relations || {}).length > 0;
    
    const mergedFunding = this.mergeFundingData(existingData.funding || {}, newAnalysis.funding || {});
    feedback.funding.updated = Object.keys(newAnalysis.funding || {}).length > 0;
    
    const mergedClients = this.mergeClientsData(existingData.clients || {}, newAnalysis.clients || {});
    feedback.clients.updated = Object.keys(newAnalysis.clients || {}).length > 0;

    // Use highest confidence score
    const mergedConfidence = Math.max(existingData.confidence || 0, newAnalysis.confidence || 0);

    // Combine analysis notes
    const mergedNotes = this.mergeAnalysisNotes(existingData.analysisNotes || '', newAnalysis.analysisNotes || '');

    const mergedAnalysis = {
      projects: projectMergeResult.merged,
      team: mergedTeam,
      relations: mergedRelations,
      funding: mergedFunding,
      clients: mergedClients,
      confidence: mergedConfidence,
      analysisNotes: mergedNotes,
      // Preserve original language and translated text from new analysis
      originalLanguage: newAnalysis.originalLanguage || existingData.originalLanguage,
      translatedText: newAnalysis.translatedText || existingData.translatedText,
      // Keep track of merge history
      mergeHistory: [
        ...(existingData.mergeHistory || []),
        {
          analysisId: newAnalysisId,
          mergedAt: new Date(),
          newProjectsCount: newAnalysis.projects?.length || 0,
          totalProjectsAfterMerge: projectMergeResult.merged.length,
          feedback: feedback
        }
      ]
    };

    console.log('Merge completed with feedback. Total projects after merge:', projectMergeResult.merged.length);
    return { mergedAnalysis, feedback };
  }

  /**
   * Merge projects with detailed feedback tracking
   */
  private mergeProjectsWithFeedback(existingProjects: any[], newProjects: any[]): { merged: any[]; added: any[]; blocked: any[]; updated: any[] } {
    const merged = [...existingProjects];
    const added: any[] = [];
    const blocked: any[] = [];
    const updated: any[] = [];
    
    for (const newProject of newProjects) {
      if (!newProject.name?.trim()) {
        console.log('Skipping project without name');
        continue;
      }

      // Enhanced duplicate detection
      const duplicateInfo = this.findProjectDuplicate(merged, newProject);
      
      if (duplicateInfo.isDuplicate) {
        console.log(`Found duplicate project: ${newProject.name} - ${duplicateInfo.reason}`);
        
        if (duplicateInfo.exactMatch) {
          // Exact match - update existing project
          const existingProject = merged[duplicateInfo.index];
          
          // Capture previous values for detailed tracking
          const previousValues = {
            status: existingProject.status,
            description: existingProject.description,
            size: existingProject.size,
            location: existingProject.location,
            useCase: existingProject.useCase
          };
          
          merged[duplicateInfo.index] = {
            ...merged[duplicateInfo.index],
            ...newProject,
            name: newProject.name || merged[duplicateInfo.index].name,
            status: newProject.status || merged[duplicateInfo.index].status || 'planning'
          };
          
          updated.push({
            ...newProject,
            reason: 'exact match - updated existing project',
            previousStatus: previousValues.status,
            previousDescription: previousValues.description,
            previousSize: previousValues.size,
            previousLocation: previousValues.location,
            previousUseCase: previousValues.useCase
          });
          console.log(`Updated existing project: ${newProject.name} with status: ${newProject.status || 'planning'}`);
        } else {
          // Similar project detected - skip adding to prevent duplicates
          blocked.push({
            ...newProject,
            reason: duplicateInfo.reason,
            similarTo: merged[duplicateInfo.index].name
          });
          console.log(`Skipping similar project to prevent duplicate: ${newProject.name}`);
          continue;
        }
      } else {
        // No duplicate found - add new project
        const projectWithStatus = {
          ...newProject,
          status: newProject.status || 'planning'
        };
        merged.push(projectWithStatus);
        added.push(projectWithStatus);
        console.log(`Added new project: ${newProject.name} with status: ${newProject.status || 'planning'}`);
      }
    }
    
    return { merged, added, blocked, updated };
  }

  /**
   * Merge analysis data from existing and new analysis (legacy method for backward compatibility)
   */
  private mergeAnalysisData(existingData: any, newAnalysis: any, newAnalysisId: string): any {
    if (!existingData) {
      // No existing data, return new analysis
      return newAnalysis;
    }

    console.log('Merging analysis data...');
    console.log('Existing projects:', existingData.projects?.length || 0);
    console.log('New projects:', newAnalysis.projects?.length || 0);

    // Merge projects - combine and deduplicate
    const mergedProjects = this.mergeProjects(existingData.projects || [], newAnalysis.projects || []);
    
    // Merge team data - prefer new data but keep existing if new is empty
    const mergedTeam = this.mergeTeamData(existingData.team || {}, newAnalysis.team || {});
    
    // Merge relations data - combine arrays and deduplicate
    const mergedRelations = this.mergeRelationsData(existingData.relations || {}, newAnalysis.relations || {});
    
    // Merge funding data - prefer new data but keep existing if new is empty
    const mergedFunding = this.mergeFundingData(existingData.funding || {}, newAnalysis.funding || {});
    
    // Merge clients data - combine arrays and deduplicate
    const mergedClients = this.mergeClientsData(existingData.clients || {}, newAnalysis.clients || {});

    // Use highest confidence score
    const mergedConfidence = Math.max(existingData.confidence || 0, newAnalysis.confidence || 0);

    // Combine analysis notes
    const mergedNotes = this.mergeAnalysisNotes(existingData.analysisNotes || '', newAnalysis.analysisNotes || '');

    const merged = {
      projects: mergedProjects,
      team: mergedTeam,
      relations: mergedRelations,
      funding: mergedFunding,
      clients: mergedClients,
      confidence: mergedConfidence,
      analysisNotes: mergedNotes,
      // Preserve original language and translated text from new analysis
      originalLanguage: newAnalysis.originalLanguage || existingData.originalLanguage,
      translatedText: newAnalysis.translatedText || existingData.translatedText,
      // Keep track of merge history
      mergeHistory: [
        ...(existingData.mergeHistory || []),
        {
          analysisId: newAnalysisId,
          mergedAt: new Date(),
          newProjectsCount: newAnalysis.projects?.length || 0,
          totalProjectsAfterMerge: mergedProjects.length
        }
      ]
    };

    console.log('Merge completed. Total projects after merge:', mergedProjects.length);
    return merged;
  }

  /**
   * Merge projects arrays with enhanced duplicate detection
   */
  private mergeProjects(existingProjects: any[], newProjects: any[]): any[] {
    const merged = [...existingProjects];
    
    for (const newProject of newProjects) {
      if (!newProject.name?.trim()) {
        console.log('Skipping project without name');
        continue;
      }

      // Enhanced duplicate detection
      const duplicateInfo = this.findProjectDuplicate(merged, newProject);
      
      if (duplicateInfo.isDuplicate) {
        console.log(`Found duplicate project: ${newProject.name} - ${duplicateInfo.reason}`);
        
        if (duplicateInfo.exactMatch) {
          // Exact match - update existing project
          merged[duplicateInfo.index] = {
            ...merged[duplicateInfo.index],
            ...newProject,
            name: newProject.name || merged[duplicateInfo.index].name,
            status: newProject.status || merged[duplicateInfo.index].status || 'planning'
          };
          console.log(`Updated existing project: ${newProject.name} with status: ${newProject.status || 'planning'}`);
        } else {
          // Similar project detected - skip adding to prevent duplicates
          console.log(`Skipping similar project to prevent duplicate: ${newProject.name}`);
          continue;
        }
      } else {
        // No duplicate found - add new project
        merged.push({
          ...newProject,
          status: newProject.status || 'planning'
        });
        console.log(`Added new project: ${newProject.name} with status: ${newProject.status || 'planning'}`);
      }
    }
    
    return merged;
  }

  /**
   * Enhanced project duplicate detection with multi-factor analysis
   */
  private findProjectDuplicate(existingProjects: any[], newProject: any): { isDuplicate: boolean; exactMatch: boolean; reason: string; index: number } {
    const newName = newProject.name?.toLowerCase().trim() || '';
    const newDescription = newProject.description?.toLowerCase().trim() || '';
    const newLocation = newProject.location?.toLowerCase().trim() || '';
    const newUseCase = newProject.useCase?.toLowerCase().trim() || '';
    const newSize = newProject.size?.toLowerCase().trim() || '';

    for (let i = 0; i < existingProjects.length; i++) {
      const existing = existingProjects[i];
      const existingName = existing.name?.toLowerCase().trim() || '';
      const existingDescription = existing.description?.toLowerCase().trim() || '';
      const existingLocation = existing.location?.toLowerCase().trim() || '';
      const existingUseCase = existing.useCase?.toLowerCase().trim() || '';
      const existingSize = existing.size?.toLowerCase().trim() || '';

      // 1. Exact name match - only if ALL other factors are also identical
      if (newName === existingName && newName.length > 0) {
        // Check if this is truly the same project by comparing other factors
        const factorsMatch = this.compareProjectFactors(newProject, existing);
        if (factorsMatch.overallMatch > 0.9) { // 90% match across all factors
          return {
            isDuplicate: true,
            exactMatch: true,
            reason: 'exact name match with identical project factors',
            index: i
          };
        } else {
          // Same name but different project - don't merge
          console.log(`Same name but different projects: ${newName}. Factors match: ${Math.round(factorsMatch.overallMatch * 100)}%`);
          continue;
        }
      }

      // 2. Exact description match (if both have descriptions) - only if other factors align
      if (newDescription === existingDescription && newDescription.length > 10) {
        const factorsMatch = this.compareProjectFactors(newProject, existing);
        if (factorsMatch.overallMatch > 0.8) { // 80% match for description-based detection
          return {
            isDuplicate: true,
            exactMatch: true,
            reason: 'exact description match with aligned project factors',
            index: i
          };
        } else {
          console.log(`Same description but different projects. Factors match: ${Math.round(factorsMatch.overallMatch * 100)}%`);
          continue;
        }
      }

      // 3. Enhanced name similarity check with factor validation
      if (this.isSimilarProjectName(newName, existingName)) {
        const factorsMatch = this.compareProjectFactors(newProject, existing);
        
        // Only consider it a duplicate if the factors strongly suggest it's the same project
        if (factorsMatch.overallMatch > 0.85) { // 85% match required for similar names
          return {
            isDuplicate: true,
            exactMatch: false,
            reason: `similar project name with strong factor alignment (${Math.round(factorsMatch.overallMatch * 100)}%)`,
            index: i
          };
        } else {
          console.log(`Similar names but different projects: ${newName} vs ${existingName}. Factors match: ${Math.round(factorsMatch.overallMatch * 100)}%`);
          continue;
        }
      }

      // 4. Description similarity check with factor validation
      if (newDescription.length > 10 && existingDescription.length > 10) {
        const similarity = this.calculateDescriptionSimilarity(newDescription, existingDescription);
        if (similarity > 0.8) { // 80% similarity threshold
          const factorsMatch = this.compareProjectFactors(newProject, existing);
          
          // Only merge if factors also align
          if (factorsMatch.overallMatch > 0.75) { // 75% match required for description similarity
            return {
              isDuplicate: true,
              exactMatch: false,
              reason: `high description similarity (${Math.round(similarity * 100)}%) with factor alignment (${Math.round(factorsMatch.overallMatch * 100)}%)`,
              index: i
            };
          } else {
            console.log(`Similar descriptions but different projects. Description similarity: ${Math.round(similarity * 100)}%, Factors match: ${Math.round(factorsMatch.overallMatch * 100)}%`);
            continue;
          }
        }
      }

      // 5. Same location + use case combination - now with stricter requirements
      if (newLocation === existingLocation && newUseCase === existingUseCase && 
          newLocation.length > 0 && newUseCase.length > 0) {
        
        // Check if sizes are significantly different (different projects)
        const sizeDifference = this.compareProjectSizes(newSize, existingSize);
        if (sizeDifference.isSignificantlyDifferent) {
          console.log(`Same location/use case but significantly different sizes: ${newSize} vs ${existingSize}. Not merging.`);
          continue;
        }
        
        // Additional check: are the names somewhat related AND factors align?
        if (this.areNamesRelated(newName, existingName)) {
          const factorsMatch = this.compareProjectFactors(newProject, existing);
          if (factorsMatch.overallMatch > 0.8) { // 80% match required
            return {
              isDuplicate: true,
              exactMatch: false,
              reason: 'same location + use case with related names and aligned factors',
              index: i
            };
          } else {
            console.log(`Same location/use case with related names but different factors. Factors match: ${Math.round(factorsMatch.overallMatch * 100)}%`);
            continue;
          }
        }
      }
    }

    return {
      isDuplicate: false,
      exactMatch: false,
      reason: 'no duplicate found',
      index: -1
    };
  }

  /**
   * Compare multiple project factors to determine if they represent the same project
   */
  private compareProjectFactors(project1: any, project2: any): { overallMatch: number; factorScores: any } {
    const factors = {
      name: this.calculateNameSimilarity(project1.name || '', project2.name || ''),
      description: this.calculateDescriptionSimilarity(project1.description || '', project2.description || ''),
      location: this.calculateLocationSimilarity(project1.location || '', project2.location || ''),
      useCase: this.calculateUseCaseSimilarity(project1.useCase || '', project2.useCase || ''),
      size: this.calculateSizeSimilarity(project1.size || '', project2.size || ''),
      status: this.calculateStatusSimilarity(project1.status || '', project2.status || '')
    };

    // Weighted scoring - some factors are more important than others
    const weights = {
      name: 0.25,        // Name is important but not definitive
      description: 0.20,  // Description is very important
      location: 0.20,     // Location is very important
      useCase: 0.15,      // Use case is important
      size: 0.15,         // Size is important for distinguishing projects
      status: 0.05        // Status is least important (can change)
    };

    const overallMatch = Object.keys(factors).reduce((total, key) => {
      return total + (factors[key] * weights[key]);
    }, 0);

    return {
      overallMatch,
      factorScores: factors
    };
  }

  /**
   * Compare project sizes to detect significantly different projects
   */
  private compareProjectSizes(size1: string, size2: string): { isSignificantlyDifferent: boolean; difference: number } {
    if (!size1 || !size2) {
      return { isSignificantlyDifferent: false, difference: 0 };
    }

    // Extract numeric values from size strings
    const extractNumericSize = (size: string): number => {
      const match = size.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const num1 = extractNumericSize(size1);
    const num2 = extractNumericSize(size2);

    if (num1 === 0 || num2 === 0) {
      return { isSignificantlyDifferent: false, difference: 0 };
    }

    const difference = Math.abs(num1 - num2) / Math.max(num1, num2);
    
    // Consider significantly different if size difference is more than 50%
    const isSignificantlyDifferent = difference > 0.5;

    return {
      isSignificantlyDifferent,
      difference
    };
  }

  /**
   * Calculate name similarity with enhanced logic
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    if (!name1 || !name2) return 0;
    
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    if (n1 === n2) return 1.0;
    
    // Check for common variations
    const variations = [
      ['center', 'centre'],
      ['theater', 'theatre'],
      ['parking', 'park'],
      ['building', 'bldg'],
      ['street', 'st'],
      ['avenue', 'ave'],
      ['boulevard', 'blvd']
    ];
    
    let adjusted1 = n1;
    let adjusted2 = n2;
    
    variations.forEach(([a, b]) => {
      adjusted1 = adjusted1.replace(new RegExp(`\\b${a}\\b`, 'g'), b);
      adjusted2 = adjusted2.replace(new RegExp(`\\b${a}\\b`, 'g'), b);
    });
    
    if (adjusted1 === adjusted2) return 0.95;
    
    // Use Levenshtein distance for fuzzy matching
    return this.calculateLevenshteinSimilarity(n1, n2);
  }

  /**
   * Calculate location similarity
   */
  private calculateLocationSimilarity(loc1: string, loc2: string): number {
    if (!loc1 || !loc2) return 0;
    
    const l1 = loc1.toLowerCase().trim();
    const l2 = loc2.toLowerCase().trim();
    
    if (l1 === l2) return 1.0;
    
    // Check if one location contains the other (for different levels of detail)
    if (l1.includes(l2) || l2.includes(l1)) return 0.8;
    
    // Check for same city/area
    const city1 = l1.split(',')[0].trim();
    const city2 = l2.split(',')[0].trim();
    
    if (city1 === city2) return 0.7;
    
    return this.calculateLevenshteinSimilarity(l1, l2);
  }

  /**
   * Calculate use case similarity
   */
  private calculateUseCaseSimilarity(use1: string, use2: string): number {
    if (!use1 || !use2) return 0;
    
    const u1 = use1.toLowerCase().trim();
    const u2 = use2.toLowerCase().trim();
    
    if (u1 === u2) return 1.0;
    
    // Check for similar categories
    const categories = {
      residential: ['housing', 'apartment', 'home', 'residential'],
      commercial: ['office', 'business', 'commercial', 'retail'],
      cultural: ['museum', 'theater', 'theatre', 'cultural', 'art'],
      sports: ['sports', 'gym', 'fitness', 'pool', 'stadium'],
      educational: ['school', 'university', 'education', 'academic'],
      healthcare: ['hospital', 'clinic', 'medical', 'healthcare'],
      public: ['public', 'municipal', 'government', 'civic']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      const has1 = keywords.some(keyword => u1.includes(keyword));
      const has2 = keywords.some(keyword => u2.includes(keyword));
      
      if (has1 && has2) return 0.8;
    }
    
    return this.calculateLevenshteinSimilarity(u1, u2);
  }

  /**
   * Calculate size similarity
   */
  private calculateSizeSimilarity(size1: string, size2: string): number {
    if (!size1 || !size2) return 0;
    
    const s1 = size1.toLowerCase().trim();
    const s2 = size2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Extract numeric values and compare
    const extractNumericSize = (size: string): number => {
      const match = size.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const num1 = extractNumericSize(s1);
    const num2 = extractNumericSize(s2);

    if (num1 === 0 || num2 === 0) {
      return this.calculateLevenshteinSimilarity(s1, s2);
    }

    const difference = Math.abs(num1 - num2) / Math.max(num1, num2);
    
    // Return similarity based on size difference
    return Math.max(0, 1 - difference);
  }

  /**
   * Calculate status similarity
   */
  private calculateStatusSimilarity(status1: string, status2: string): number {
    if (!status1 || !status2) return 0;
    
    const s1 = status1.toLowerCase().trim();
    const s2 = status2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    
    // Status can change, so be more lenient
    const statusGroups = {
      active: ['completed', 'in-progress', 'active', 'ongoing'],
      planning: ['planning', 'design', 'proposed', 'planned'],
      inactive: ['cancelled', 'on-hold', 'suspended', 'inactive']
    };
    
    for (const [group, statuses] of Object.entries(statusGroups)) {
      const has1 = statuses.includes(s1);
      const has2 = statuses.includes(s2);
      
      if (has1 && has2) return 0.8;
    }
    
    return 0.5; // Default moderate similarity for different statuses
  }

  /**
   * Calculate Levenshtein similarity between two strings
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0;
    if (len2 === 0) return 0;
    
    // Create a matrix to store distances
    const matrix: number[][] = [];
    
    // Initialize first row and column
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    // Fill the matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    
    // Return similarity as a percentage (0-1)
    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Check if project names are similar (fuzzy matching)
   */
  private isSimilarProjectName(name1: string, name2: string): boolean {
    if (!name1 || !name2 || name1.length < 3 || name2.length < 3) {
      return false;
    }

    // Remove common words for comparison
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const cleanName1 = name1.split(' ').filter(word => !commonWords.includes(word)).join(' ');
    const cleanName2 = name2.split(' ').filter(word => !commonWords.includes(word)).join(' ');

    // Calculate similarity using simple word overlap
    const words1 = cleanName1.split(' ');
    const words2 = cleanName2.split(' ');
    
    if (words1.length === 0 || words2.length === 0) {
      return false;
    }

    const commonWordsCount = words1.filter(word => words2.includes(word)).length;
    const similarity = commonWordsCount / Math.max(words1.length, words2.length);
    
    return similarity > 0.7; // 70% word similarity
  }

  /**
   * Calculate description similarity using word overlap
   */
  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = new Set(desc1.split(/\s+/).filter(word => word.length > 2));
    const words2 = new Set(desc2.split(/\s+/).filter(word => word.length > 2));
    
    if (words1.size === 0 || words2.size === 0) {
      return 0;
    }

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Check if project names are related (for location + use case duplicates)
   */
  private areNamesRelated(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    
    // Extract key terms from names
    const extractKeyTerms = (name: string) => {
      return name.split(' ')
        .filter(word => word.length > 3)
        .map(word => word.toLowerCase())
        .filter(word => !['building', 'complex', 'center', 'tower', 'house', 'home', 'office'].includes(word));
    };

    const terms1 = extractKeyTerms(name1);
    const terms2 = extractKeyTerms(name2);
    
    if (terms1.length === 0 || terms2.length === 0) return false;
    
    const commonTerms = terms1.filter(term => terms2.includes(term));
    return commonTerms.length > 0;
  }

  /**
   * Merge team data, preferring new data but keeping existing if new is empty
   */
  private mergeTeamData(existingTeam: any, newTeam: any): any {
    const merged = { ...existingTeam };
    
    // Update with new team data if it has content
    if (newTeam.teamSize?.trim()) merged.teamSize = newTeam.teamSize;
    if (newTeam.numberOfPeople && newTeam.numberOfPeople > 0) merged.numberOfPeople = newTeam.numberOfPeople;
    
    // Merge specific architects arrays
    if (newTeam.specificArchitects?.length > 0) {
      const existingArchitects = merged.specificArchitects || [];
      const combined = [...existingArchitects, ...newTeam.specificArchitects];
      merged.specificArchitects = [...new Set(combined.map(arch => arch.toLowerCase().trim()))]
        .map(arch => existingArchitects.find(existing => existing.toLowerCase().trim() === arch) || arch);
    }
    
    // Merge roles arrays
    if (newTeam.roles?.length > 0) {
      const existingRoles = merged.roles || [];
      const combined = [...existingRoles, ...newTeam.roles];
      merged.roles = [...new Set(combined.map(role => role.toLowerCase().trim()))]
        .map(role => existingRoles.find(existing => existing.toLowerCase().trim() === role) || role);
    }
    
    return merged;
  }

  /**
   * Merge relations data, combining arrays and removing duplicates
   */
  private mergeRelationsData(existingRelations: any, newRelations: any): any {
    const merged = { ...existingRelations };
    
    // Merge construction companies
    if (newRelations.constructionCompanies?.length > 0) {
      const existing = merged.constructionCompanies || [];
      const combined = [...existing, ...newRelations.constructionCompanies];
      merged.constructionCompanies = [...new Set(combined.map(comp => comp.toLowerCase().trim()))]
        .map(comp => existing.find(existing => existing.toLowerCase().trim() === comp) || comp);
    }
    
    // Merge other architecture offices
    if (newRelations.otherArchOffices?.length > 0) {
      const existing = merged.otherArchOffices || [];
      const combined = [...existing, ...newRelations.otherArchOffices];
      merged.otherArchOffices = [...new Set(combined.map(office => office.toLowerCase().trim()))]
        .map(office => existing.find(existing => existing.toLowerCase().trim() === office) || office);
    }
    
    // Merge partners
    if (newRelations.partners?.length > 0) {
      const existing = merged.partners || [];
      const combined = [...existing, ...newRelations.partners];
      merged.partners = [...new Set(combined.map(partner => partner.toLowerCase().trim()))]
        .map(partner => existing.find(existing => existing.toLowerCase().trim() === partner) || partner);
    }
    
    // Merge collaborators
    if (newRelations.collaborators?.length > 0) {
      const existing = merged.collaborators || [];
      const combined = [...existing, ...newRelations.collaborators];
      merged.collaborators = [...new Set(combined.map(collab => collab.toLowerCase().trim()))]
        .map(collab => existing.find(existing => existing.toLowerCase().trim() === collab) || collab);
    }
    
    return merged;
  }

  /**
   * Merge funding data, preferring new data but keeping existing if new is empty
   */
  private mergeFundingData(existingFunding: any, newFunding: any): any {
    const merged = { ...existingFunding };
    
    if (newFunding.budget?.trim()) merged.budget = newFunding.budget;
    if (newFunding.financialInfo?.trim()) merged.financialInfo = newFunding.financialInfo;
    if (newFunding.investmentDetails?.trim()) merged.investmentDetails = newFunding.investmentDetails;
    
    // Merge funding sources
    if (newFunding.fundingSources?.length > 0) {
      const existing = merged.fundingSources || [];
      const combined = [...existing, ...newFunding.fundingSources];
      merged.fundingSources = [...new Set(combined.map(source => source.toLowerCase().trim()))]
        .map(source => existing.find(existing => existing.toLowerCase().trim() === source) || source);
    }
    
    return merged;
  }

  /**
   * Merge clients data, combining arrays and removing duplicates
   */
  private mergeClientsData(existingClients: any, newClients: any): any {
    const merged = { ...existingClients };
    
    // Merge past clients
    if (newClients.pastClients?.length > 0) {
      const existing = merged.pastClients || [];
      const combined = [...existing, ...newClients.pastClients];
      merged.pastClients = [...new Set(combined.map(client => client.toLowerCase().trim()))]
        .map(client => existing.find(existing => existing.toLowerCase().trim() === client) || client);
    }
    
    // Merge present clients
    if (newClients.presentClients?.length > 0) {
      const existing = merged.presentClients || [];
      const combined = [...existing, ...newClients.presentClients];
      merged.presentClients = [...new Set(combined.map(client => client.toLowerCase().trim()))]
        .map(client => existing.find(existing => existing.toLowerCase().trim() === client) || client);
    }
    
    // Merge client types
    if (newClients.clientTypes?.length > 0) {
      const existing = merged.clientTypes || [];
      const combined = [...existing, ...newClients.clientTypes];
      merged.clientTypes = [...new Set(combined.map(type => type.toLowerCase().trim()))]
        .map(type => existing.find(existing => existing.toLowerCase().trim() === type) || type);
    }
    
    // Merge client industries
    if (newClients.clientIndustries?.length > 0) {
      const existing = merged.clientIndustries || [];
      const combined = [...existing, ...newClients.clientIndustries];
      merged.clientIndustries = [...new Set(combined.map(industry => industry.toLowerCase().trim()))]
        .map(industry => existing.find(existing => existing.toLowerCase().trim() === industry) || industry);
    }
    
    return merged;
  }

  /**
   * Merge analysis notes
   */
  private mergeAnalysisNotes(existingNotes: string, newNotes: string): string {
    if (!existingNotes) return newNotes;
    if (!newNotes) return existingNotes;
    
    // Combine notes with separator if both exist
    return `${existingNotes}\n\n--- New Analysis ---\n${newNotes}`;
  }

  /**
   * Save office analysis data with merging and return feedback
   */
  async saveOfficeAnalysis(officeId: string, analysis: Omit<OfficeAnalysis, 'id'>, country?: string): Promise<{ success: boolean; feedback?: any }> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save as same level as cities: {country}/analyses/{officeId}
      const analysisRef = this.db
        .collection(countryCollection)
        .doc('analyses')
        .collection('offices')
        .doc(officeId);

      // Get existing analysis data
      const existingDoc = await analysisRef.get();
      let existingData: any = null;
      
      if (existingDoc.exists) {
        existingData = existingDoc.data();
        console.log(`Found existing analysis for office ${officeId}, merging data...`);
      } else {
        console.log(`No existing analysis found for office ${officeId}, creating new analysis...`);
      }

      // Merge the analysis data with feedback tracking
      const mergeResult = this.mergeAnalysisDataWithFeedback(existingData, analysis, analysisId);

      const analysisData = {
        ...mergeResult.mergedAnalysis,
        id: analysisId,
        officeId: officeId,
        country: countryCollection,
        analyzedAt: admin.firestore.Timestamp.fromDate(analysis.analyzedAt),
        lastUpdated: admin.firestore.Timestamp.now()
      };

      await analysisRef.set(analysisData);
      console.log(`Saved merged analysis for office ${officeId} to ${countryCollection}/analyses/offices/${officeId}: ${analysisId}`);

      return {
        success: true,
        feedback: mergeResult.feedback
      };
    } catch (error) {
      console.error('Error saving office analysis:', error);
      return {
        success: false,
        feedback: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get latest analysis for an office
   */
  async getLatestOfficeAnalysis(officeId: string, country?: string): Promise<OfficeAnalysis | null> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const analysisRef = this.db
        .collection(countryCollection)
        .doc('analyses')
        .collection('offices')
        .doc(officeId);
      
      const analysisDoc = await analysisRef.get();

      if (!analysisDoc.exists) {
        return null;
      }

      const data = analysisDoc.data();
      
      return {
        ...data,
        analyzedAt: data.analyzedAt?.toDate()
      } as OfficeAnalysis;
    } catch (error) {
      console.error('Error getting latest office analysis:', error);
      throw error;
    }
  }

  /**
   * Get all analyses for an office
   */
  async getAllOfficeAnalyses(officeId: string, country?: string): Promise<OfficeAnalysis[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const analysisRef = this.db
        .collection(countryCollection)
        .doc('analyses')
        .collection('offices')
        .doc(officeId);
      
      const analysisDoc = await analysisRef.get();

      if (!analysisDoc.exists) {
        return [];
      }

      const data = analysisDoc.data();
      return [{
          ...data,
          analyzedAt: data.analyzedAt?.toDate()
      } as OfficeAnalysis];
    } catch (error) {
      console.error('Error getting all office analyses:', error);
      throw error;
    }
  }

  /**
   * Delete analysis
   */
  async deleteOfficeAnalysis(officeId: string, analysisId: string, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const analysisRef = this.db
        .collection(countryCollection)
        .doc('analyses')
        .collection('offices')
        .doc(officeId);

      await analysisRef.delete();
      console.log(`Deleted analysis for office ${officeId} from ${countryCollection}/analyses/offices/${officeId}`);
    } catch (error) {
      console.error('Error deleting office analysis:', error);
      throw error;
    }
  }

  // **CLICK TRACKING METHODS**

  /**
   * Save website click data
   */
  async saveWebsiteClick(click: WebsiteClick, country?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      
      // Save individual click under scrape_timing folder: {country}/scrape_timing/web_tracking/clicks/{clickId}
      const clickRef = this.db
        .collection(countryCollection)
        .doc('scrape_timing')
        .collection('web_tracking')
        .doc('clicks')
        .collection('clicks')
        .doc(click.id);

      const clickData = {
        ...click,
        clickedAt: admin.firestore.Timestamp.fromDate(click.clickedAt)
      };

      await clickRef.set(clickData);

      // Update office click statistics
      await this.updateOfficeClickStats(click.officeId, click.officeName, click, country);

      console.log(`Saved website click for office ${click.officeId}: ${click.website}`);
    } catch (error) {
      console.error('Error saving website click:', error);
      throw error;
    }
  }

  /**
   * Update office click statistics
   */
  private async updateOfficeClickStats(officeId: string, officeName: string, click: WebsiteClick, country?: string): Promise<void> {
    try {
      const countryCollection = country || 'latvia';
      const statsRef = this.db
        .collection(countryCollection)
        .doc('scrape_timing')
        .collection('web_tracking')
        .doc('office_stats')
        .collection('office_stats')
        .doc(officeId);

      const statsDoc = await statsRef.get();
      
      if (statsDoc.exists) {
        // Update existing stats
        const currentStats = statsDoc.data();
        const clickHistory = currentStats?.clickHistory || [];
        
        // Add new click to history (keep last 100 clicks)
        const updatedHistory = [click, ...clickHistory].slice(0, 100);
        
        // Count unique sessions
        const uniqueSessions = new Set(updatedHistory.map(c => c.sessionId)).size;
        
        await statsRef.update({
          totalClicks: admin.firestore.FieldValue.increment(1),
          uniqueSessions: uniqueSessions,
          lastClickedAt: admin.firestore.Timestamp.fromDate(click.clickedAt),
          clickHistory: updatedHistory.map(c => ({
            ...c,
            clickedAt: admin.firestore.Timestamp.fromDate(c.clickedAt)
          }))
        });
      } else {
        // Create new stats
        await statsRef.set({
          officeId,
          officeName,
          totalClicks: 1,
          uniqueSessions: 1,
          lastClickedAt: admin.firestore.Timestamp.fromDate(click.clickedAt),
          clickHistory: [{
            ...click,
            clickedAt: admin.firestore.Timestamp.fromDate(click.clickedAt)
          }]
        });
      }
    } catch (error) {
      console.error('Error updating office click stats:', error);
      throw error;
    }
  }

  /**
   * Get click tracking statistics for an office
   */
  async getClickTrackingStats(officeId: string, country?: string): Promise<ClickTrackingStats | null> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const statsRef = this.db
        .collection(countryCollection)
        .doc('scrape_timing')
        .collection('web_tracking')
        .doc('office_stats')
        .collection('office_stats')
        .doc(officeId);

      const statsDoc = await statsRef.get();
      
      if (!statsDoc.exists) {
        return null;
      }

      const data = statsDoc.data();
      return {
        officeId: data?.officeId || officeId,
        officeName: data?.officeName || '',
        totalClicks: data?.totalClicks || 0,
        uniqueSessions: data?.uniqueSessions || 0,
        lastClickedAt: data?.lastClickedAt?.toDate() || new Date(),
        clickHistory: (data?.clickHistory || []).map((click: any) => ({
          ...click,
          clickedAt: click.clickedAt?.toDate() || new Date()
        }))
      };
    } catch (error) {
      console.error('Error getting click tracking stats:', error);
      throw error;
    }
  }

  /**
   * Get all click tracking statistics
   */
  async getAllClickTrackingStats(country?: string): Promise<ClickTrackingStats[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const statsSnapshot = await this.db
        .collection(countryCollection)
        .doc('scrape_timing')
        .collection('web_tracking')
        .doc('office_stats')
        .collection('office_stats')
        .orderBy('totalClicks', 'desc')
        .get();

      const stats: ClickTrackingStats[] = [];
      statsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        stats.push({
          officeId: data.officeId,
          officeName: data.officeName,
          totalClicks: data.totalClicks || 0,
          uniqueSessions: data.uniqueSessions || 0,
          lastClickedAt: data.lastClickedAt?.toDate() || new Date(),
          clickHistory: (data.clickHistory || []).map((click: any) => ({
            ...click,
            clickedAt: click.clickedAt?.toDate() || new Date()
          }))
        });
      });

      return stats;
    } catch (error) {
      console.error('Error getting all click tracking stats:', error);
      throw error;
    }
  }

  /**
   * Get recent clicks for an office
   */
  async getRecentClicksForOffice(officeId: string, limit: number = 10, country?: string): Promise<WebsiteClick[]> {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }

    try {
      const countryCollection = country || 'latvia';
      const clicksSnapshot = await this.db
        .collection(countryCollection)
        .doc('scrape_timing')
        .collection('web_tracking')
        .doc('clicks')
        .collection('clicks')
        .where('officeId', '==', officeId)
        .orderBy('clickedAt', 'desc')
        .limit(limit)
        .get();

      const clicks: WebsiteClick[] = [];
      clicksSnapshot.docs.forEach(doc => {
        const data = doc.data();
        clicks.push({
          ...data,
          clickedAt: data.clickedAt?.toDate() || new Date()
        } as WebsiteClick);
      });

      return clicks;
    } catch (error) {
      console.error('Error getting recent clicks for office:', error);
      throw error;
    }
  }
} 