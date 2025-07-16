import 'dotenv/config';
import { GoogleMapsArchitectureScraper } from './scraper';
import { DataOutput } from './utils/dataOutput';
import { ScraperConfig } from './types';
import { FirebaseService } from './services/firebaseService';

class ScraperApp {
  private scraper: GoogleMapsArchitectureScraper;
  private dataOutput: DataOutput;
  private firebaseService?: FirebaseService;
  
  constructor(config: ScraperConfig = {}) {
    this.scraper = new GoogleMapsArchitectureScraper(config);
    
    // Initialize Firebase if needed
    if (config.outputFormat === 'firestore' || config.firebaseConfig) {
      this.firebaseService = new FirebaseService(config.firebaseConfig);
    }
    
    this.dataOutput = new DataOutput('./output', this.firebaseService);
  }

  async run(): Promise<void> {
    let initializationAttempts = 0;
    const maxInitializationAttempts = 3;
    
    try {
      console.log('🚀 Starting Google Maps Architecture Scraper for Latvia...\n');
      
      // Initialize the scraper with retry logic
      while (initializationAttempts < maxInitializationAttempts) {
        try {
          await this.scraper.initialize();
          break; // Success, exit retry loop
        } catch (initError) {
          initializationAttempts++;
          console.error(`❌ Initialization attempt ${initializationAttempts}/${maxInitializationAttempts} failed:`, initError);
          
          if (initializationAttempts >= maxInitializationAttempts) {
            throw new Error(`Failed to initialize scraper after ${maxInitializationAttempts} attempts: ${initError instanceof Error ? initError.message : String(initError)}`);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 3000 * initializationAttempts));
        }
      }
      
      // Scrape all cities
      const results = await this.scraper.scrapeAllCities();
      
      // Check if we got any results
      if (results.length === 0) {
        console.log('⚠️  No results obtained from scraping. This might be due to connection issues.');
        return;
      }
      
      // Save results based on configuration
      if (this.firebaseService) {
        await this.dataOutput.saveToFirestore(results);
      } else {
        await this.dataOutput.saveToJson(results);
        await this.dataOutput.saveToCsv(results);
        await this.dataOutput.saveSummary(results);
      }
      
      // Display summary
      console.log(this.dataOutput.generateSummary(results));
      
    } catch (error) {
      console.error('❌ Error during scraping:', error);
      
      // Check if it's a connection error and provide helpful advice
      if (this.isConnectionError(error)) {
        console.log(`
💡 Connection Error Help:
   - This might be due to network issues or Google Maps blocking
   - Try running the scraper again in a few minutes
   - Consider using a VPN or different network
   - Make sure you have a stable internet connection
        `);
      }
      
      throw error;
    } finally {
      // Clean up
      await this.scraper.close();
    }
  }

  private isConnectionError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes('socket hang up') || 
           errorMessage.includes('ECONNRESET') || 
           errorMessage.includes('detached') || 
           errorMessage.includes('closed') ||
           errorMessage.includes('disconnected') ||
           errorMessage.includes('Connection closed') ||
           errorMessage.includes('Browser connection lost');
  }
}

// Example usage with different configurations
export async function runBasicScraper(): Promise<void> {
  const app = new ScraperApp({
    headless: true,
    maxResults: 20,
    delayBetweenRequests: 3000,
    outputFormat: 'json'
  });
  
  await app.run();
}

export async function runFirestoreScraper(): Promise<void> {
  const app = new ScraperApp({
    headless: true,
    maxResults: 20,
    delayBetweenRequests: 3000,
    outputFormat: 'firestore',
    firebaseConfig: {
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
    }
  });
  
  await app.run();
}

export async function runAdvancedScraper(): Promise<void> {
  const app = new ScraperApp({
    headless: false, // Show browser for debugging
    maxResults: 50,
    delayBetweenRequests: 2000,
    outputFormat: 'csv',
    cities: ['Rīga', 'Daugavpils', 'Liepāja'] // Only major cities
  });
  
  await app.run();
}

export async function runSingleCityScraper(city: string, useFirestore: boolean = false): Promise<void> {
  const scraper = new GoogleMapsArchitectureScraper({
    headless: true,
    maxResults: 30,
    delayBetweenRequests: 2000
  });
  
  let firebaseService: FirebaseService | undefined;
  if (useFirestore) {
    firebaseService = new FirebaseService({
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || ''
    });
  }
  
  const dataOutput = new DataOutput('./output', firebaseService);
  
  try {
    await scraper.initialize();
    const result = await scraper.searchArchitectureOffices(city);
    
    if (useFirestore) {
      await dataOutput.saveToFirestore([result]);
    } else {
      await dataOutput.saveToJson([result], `${city.toLowerCase()}_architecture_offices`);
      await dataOutput.saveToCsv([result], `${city.toLowerCase()}_architecture_offices`);
    }
    
    console.log(`✅ Scraping completed for ${city}`);
    console.log(`📊 Found ${result.offices.length} architecture offices`);
    
  } catch (error) {
    console.error(`❌ Error scraping ${city}:`, error);
    throw error;
  } finally {
    await scraper.close();
  }
}

// Error handling utility
export class ScraperError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'ScraperError';
  }
}

export function handleScraperError(error: any): void {
  if (error instanceof ScraperError) {
    console.error(`❌ Scraper Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error('Details:', error.details);
    }
  } else if (error instanceof Error) {
    console.error(`❌ Unexpected Error: ${error.message}`);
    console.error('Stack:', error.stack);
  } else {
    console.error('❌ Unknown error:', error);
  }
}

// Export the main classes for external use
export { GoogleMapsArchitectureScraper } from './scraper';
export { DataOutput } from './utils/dataOutput';
export { FirebaseService } from './services/firebaseService';
export * from './types';

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  try {
    if (args.length === 0) {
      console.log('🏢 Running basic scraper for all Latvian cities...');
      await runBasicScraper();
    } else if (args[0] === '--city' && args[1]) {
      const useFirestore = args.includes('--firestore');
      console.log(`🏢 Running scraper for ${args[1]}${useFirestore ? ' with Firestore' : ''}...`);
      await runSingleCityScraper(args[1], useFirestore);
    } else if (args[0] === '--advanced') {
      console.log('🏢 Running advanced scraper...');
      await runAdvancedScraper();
    } else if (args[0] === '--firestore') {
      console.log('🏢 Running scraper with Firestore...');
      await runFirestoreScraper();
    } else {
      console.log(`
🏢 Google Maps Architecture Scraper for Latvia

Usage:
  npm start                           # Run basic scraper for all cities
  npm start --city <cityName>         # Run scraper for specific city
  npm start --city <cityName> --firestore  # Run scraper for specific city with Firestore
  npm start --advanced                # Run advanced scraper with custom settings
  npm start --firestore               # Run scraper with Firestore for all cities

Examples:
  npm start --city "Rīga"
  npm start --city "Daugavpils" --firestore
  npm start --advanced
  npm start --firestore

Environment Variables (for Firestore):
  FIREBASE_PROJECT_ID    # Your Firebase project ID
  FIREBASE_PRIVATE_KEY   # Your Firebase private key
  FIREBASE_CLIENT_EMAIL  # Your Firebase client email

Supported cities:
  Rīga, Daugavpils, Liepāja, Jelgava, Jūrmala, Ventspils, Rēzekne, Valmiera, Jēkabpils, Cēsis
      `);
    }
  } catch (error) {
    handleScraperError(error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
} 