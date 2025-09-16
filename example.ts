import 'dotenv/config';
import { GoogleMapsArchitectureScraper, DataOutput, FirebaseService } from './transactions/scraper-backend/index';

// Example 1: Basic usage - scrape all cities
async function example1() {
  console.log('📍 Example 1: Scraping all Latvian cities');
  
  const scraper = new GoogleMapsArchitectureScraper({
    headless: true,
    maxResults: 10, // Limit results for demo
    delayBetweenRequests: 3000
  });
  
  const dataOutput = new DataOutput();
  
  try {
    await scraper.initialize();
    const results = await scraper.scrapeAllCities();
    
    await dataOutput.saveToJson(results, 'example1_results');
    console.log(`✅ Found ${results.reduce((sum, r) => sum + r.offices.length, 0)} offices total`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.close();
  }
}

// Example 2: Single city scraping
async function example2() {
  console.log('📍 Example 2: Scraping only Rīga');
  
  const scraper = new GoogleMapsArchitectureScraper({
    headless: true,
    maxResults: 20,
    delayBetweenRequests: 2000
  });
  
  const dataOutput = new DataOutput();
  
  try {
    await scraper.initialize();
    const result = await scraper.searchArchitectureOffices('Rīga');
    
    await dataOutput.saveToJson([result], 'riga_architecture_offices');
    console.log(`✅ Found ${result.offices.length} offices in Rīga`);
    
    // Print first few results
    result.offices.slice(0, 3).forEach((office, index) => {
      console.log(`${index + 1}. ${office.name} - ${office.address}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.close();
  }
}

// Example 3: Custom configuration
async function example3() {
  console.log('📍 Example 3: Custom configuration for specific cities');
  
  const scraper = new GoogleMapsArchitectureScraper({
    headless: false, // Show browser for demonstration
    maxResults: 15,
    delayBetweenRequests: 4000,
    cities: ['Rīga', 'Daugavpils', 'Liepāja'], // Only major cities
    timeout: 45000
  });
  
  const dataOutput = new DataOutput();
  
  try {
    await scraper.initialize();
    const results = await scraper.scrapeAllCities();
    
    await dataOutput.saveToJson(results, 'major_cities_results');
    await dataOutput.saveToCsv(results, 'major_cities_results');
    
    console.log(dataOutput.generateSummary(results));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.close();
  }
}

// Example 4: Firebase Firestore integration
async function example4() {
  console.log('📍 Example 4: Save to Firebase Firestore');
  
  // Initialize Firebase service
  const firebaseService = new FirebaseService({
    projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id',
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'your-private-key',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'your-client-email'
  });
  
  const scraper = new GoogleMapsArchitectureScraper({
    headless: true,
    maxResults: 10,
    delayBetweenRequests: 3000,
    cities: ['Rīga'] // Only Rīga for demo
  });
  
  const dataOutput = new DataOutput('./output', firebaseService);
  
  try {
    await scraper.initialize();
    const results = await scraper.scrapeAllCities();
    
    // Save to Firestore
    await dataOutput.saveToFirestore(results);
    
    console.log('✅ Data saved to Firestore successfully!');
    console.log(dataOutput.generateSummary(results));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.close();
  }
}

// Run examples
async function runExamples() {
  console.log('🚀 Starting Google Maps Architecture Scraper Examples\n');
  
  // Uncomment the example you want to run:
  
  // await example1(); // Scrape all cities
  await example2(); // Scrape only Rīga
  // await example3(); // Custom configuration
  // await example4(); // Firebase Firestore integration
  
  console.log('\n✅ Examples completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
} 