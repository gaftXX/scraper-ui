const { GoogleMapsArchitectureScraper } = require('./scraper.ts');

async function testAllCategories() {
  console.log('🧪 Testing all categories to create Firebase collections...\n');
  
  // All current categories
  const categories = [
    'architecture-only',
    'construction', 
    'interior-design',
    'property-development'
  ];
  
  const config = {
    headless: true,
    maxResults: 3, // Very small number just to create collections
    delayBetweenRequests: 0,
    timeout: 30000,
    outputFormat: 'firestore',
    cities: ['Rīga'], // Only Riga for testing
    searchRadius: 20,
    humanBehavior: false, // Disable for speed
    stealthMode: false, // Disable for speed
    firebaseConfig: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id',
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || 'your-private-key',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'your-client-email',
      databaseURL: process.env.FIREBASE_DATABASE_URL
    }
  };
  
  for (const category of categories) {
    console.log(`\n🔍 Testing category: ${category}`);
    console.log(`📁 This will create collection: latvia/Rīga/${category}`);
    
    try {
      const scraper = new GoogleMapsArchitectureScraper(config);
      
      // Run scraper for this specific category
      const result = await scraper.searchArchitectureOffices('Rīga', 0, 1, category);
      
      console.log(`✅ ${category}: Found ${result.offices.length} offices`);
      console.log(`   Collection path: latvia/Rīga/${category}`);
      
      // Clean up
      await scraper.cleanup();
      
    } catch (error) {
      console.error(`❌ Error testing ${category}:`, error.message);
    }
    
    // Small delay between categories
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🎉 All categories tested! Check Firebase to see collection structure.');
  console.log('\nExpected Firebase structure:');
  console.log('latvia/');
  console.log('  └── Rīga/');
  console.log('      ├── architecture-only/');
  console.log('      ├── construction/');
  console.log('      ├── interior-design/');
  console.log('      └── property-development/');
}

testAllCategories().catch(console.error); 