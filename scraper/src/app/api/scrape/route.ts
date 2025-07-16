import { NextRequest, NextResponse } from 'next/server';
import { ScraperConfig, SearchCategory, ArchitectureOffice, getSearchTermsForCategories, SEARCH_CATEGORIES, getIntensityLevel } from '../../types';

// Import the backend scraper functions
import { GoogleMapsArchitectureScraper } from '../../../../scraper-backend/scraper';
import { DataOutput } from '../../../../scraper-backend/utils/dataOutput';
import { FirebaseService } from '../../../../scraper-backend/services/firebaseService';

export async function POST(request: NextRequest) {
  try {
    const config: ScraperConfig = await request.json();
    
    // Create a readable stream for server-sent events
    const stream = new ReadableStream({
      start(controller) {
        runScraper(config, controller);
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function runScraper(config: ScraperConfig, controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  let controllerClosed = false;
  let scraper: GoogleMapsArchitectureScraper | null = null;
  const startTime = Date.now();
  
  const sendEvent = (type: string, data: any) => {
    try {
      if (!controllerClosed) {
        const message = `data: ${JSON.stringify({ type, ...data })}\n\n`;
        controller.enqueue(encoder.encode(message));
        
        // Debug logging for critical events
        if (type === 'complete') {
          console.log(`Successfully sent '${type}' event to frontend with ${data.results?.results?.length || 0} result sets`);
        }
      } else {
        console.log(`Attempted to send '${type}' event but controller is closed`);
      }
    } catch (error) {
      // Controller is already closed, mark it as closed to prevent further attempts
      controllerClosed = true;
      console.error(`Error sending '${type}' event:`, error);
    }
  };
  
  // Capture all console output and stream to frontend
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  
  // Override console.log to capture and stream all messages
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Send to frontend only if controller is still open
    if (!controllerClosed) {
      sendEvent('log', { message });
    }
    
    // Also call original console.log for server logs
    originalConsoleLog(...args);
  };
  
  // Override console.error to capture and stream all error messages
  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    // Send to frontend with error styling only if controller is still open
    if (!controllerClosed) {
      sendEvent('log', { message: `ERROR: ${message}` });
    }
    
    // Also call original console.error for server logs
    originalConsoleError(...args);
  };
  
  // Initialize Firebase service and data output outside try block for broader scope
  let firebaseService: FirebaseService | undefined;
  if (config.firebaseConfig) {
    firebaseService = new FirebaseService(config.firebaseConfig);
  }
  
  const dataOutput = new DataOutput(undefined, firebaseService);

  try {
    // Initialize scraper with category-aware configuration and progress callback
    const scraperConfig = {
      ...config,
      onProgress: (progress: any) => {
        sendEvent('progress', { progress });
      }
    };
    scraper = new GoogleMapsArchitectureScraper(scraperConfig);
    
    // Reset scraper state for fresh start
    scraper.reset();
    
    // **CATEGORY-BASED SEARCH TERMS LOGGING**
    const selectedCategories = config.searchCategories || ['architecture-only', 'construction'];
    
    console.log(`Selected categories: ${selectedCategories.join(', ')}`);
    console.log(`Selected cities: ${config.cities?.join(', ') || 'None'}`);
    console.log(`Search terms that will be used:`);
    
    // Show search terms for each category
    selectedCategories.forEach(categoryId => {
      const category = SEARCH_CATEGORIES.find(c => c.id === categoryId);
      if (category) {
        const searchTermCount = (categoryId === 'architecture-only' || categoryId === 'construction' || categoryId === 'interior-design') ? 1 : 4;
        const searchTerms = getSearchTermsForCategories([categoryId], true, searchTermCount);
        console.log(`\n   ${category.name} (${searchTerms.length} terms):`);
        searchTerms.forEach((term, index) => {
          console.log(`      ${index + 1}. "${term}"`);
        });
      }
    });
    
    console.log(`\nData will be saved to separate collections for each category`);
    console.log(`Starting scraping process...\n`);

    // Send initial progress with category information
    sendEvent('progress', {
      progress: {
        currentCity: '',
        cityIndex: 0,
        totalCities: config.cities?.length || 0,
        currentCategory: '',
        categoryIndex: 0,
        totalCategories: selectedCategories.length,
        currentTerms: ['Starting...'],
        currentBatch: 0,
        totalBatches: 0,
        termIndex: 0,
        totalTerms: 1, // Dynamic based on category - will be updated per category
        officesFound: 0,
        status: 'running',
        phase: 'starting'
      }
    });
    
    // Initialize scraper with retry logic
    let initializationAttempts = 0;
    const maxInitializationAttempts = 3;
    
    while (initializationAttempts < maxInitializationAttempts) {
      try {
        await scraper.initialize();
        break;
      } catch (initError) {
        initializationAttempts++;
        console.error(`Initialization attempt ${initializationAttempts}/${maxInitializationAttempts} failed:`, initError);
        
        if (initializationAttempts >= maxInitializationAttempts) {
          throw new Error(`Failed to initialize scraper after ${maxInitializationAttempts} attempts`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000 * initializationAttempts));
      }
    }
    
    // Run scraper on selected cities and categories
    const cities = config.cities || [];
    const results: any[] = [];
    let totalOfficesFound = 0;
    
    // Loop through each category
    for (let catIndex = 0; catIndex < selectedCategories.length; catIndex++) {
      const category = selectedCategories[catIndex];
      console.log(`Processing category: ${category}`);
      
      // Get dynamic term count for this category
      const termCount = (category === 'architecture-only' || category === 'construction' || category === 'interior-design') ? 1 : 4;
      
      // Loop through each city for this category
      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        
        console.log(`Scraping ${city} for ${category}...`);
        
        try {
          const result = await scraper.searchArchitectureOffices(city, i, cities.length, category);
          results.push(result);
          totalOfficesFound += result.offices.length;
          
          console.log(`Found ${result.offices.length} ${category} offices in ${city}`);
          
          
          // Update progress with completion
          sendEvent('progress', {
            progress: {
              currentCity: city,
              cityIndex: i + 1,
              totalCities: cities.length,
              currentCategory: category,
              categoryIndex: catIndex + 1,
              totalCategories: selectedCategories.length,
              currentTerms: ['Completed'],
              currentBatch: 0,
              totalBatches: 0,
              termIndex: termCount,
              totalTerms: termCount,
              officesFound: totalOfficesFound,
              status: 'running',
              phase: 'completed'
            }
          });
          
          // Add minimal delay between cities for speed
          if (i < cities.length - 1 || catIndex < selectedCategories.length - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.min(config.delayBetweenRequests || 1000, 1000)));
          }
          
        } catch (error) {
          console.error(`Error scraping ${city} for ${category}:`, error);
          // Continue with next city instead of failing completely
        }
      }
    }
    
    // Check if offices already exist in database
    console.log('Checking offices against database...');
    
    try {
      if (firebaseService) {
        // Mark all offices with their existence status in the database
        for (const result of results) {
          if (result.offices && result.offices.length > 0) {
            result.offices = await firebaseService.markOfficesExistenceInDatabase(result.offices);
          }
        }
        console.log('Database existence check completed');
      } else {
        // If no Firebase service, mark all as not existing in database
        for (const result of results) {
          if (result.offices && result.offices.length > 0) {
            result.offices = result.offices.map((office: any) => ({
              ...office,
              existedInDatabase: false
            }));
          }
        }
      }
    } catch (checkError) {
      console.error('Error checking database existence:', checkError);
      // Mark all as not existing if error occurs
      for (const result of results) {
        if (result.offices && result.offices.length > 0) {
          result.offices = result.offices.map((office: any) => ({
            ...office,
            existedInDatabase: false
          }));
        }
      }
    }
    
    // Prepare final results
    console.log('Preparing final results for frontend...');
    
    const finalResults = {
      totalOffices: totalOfficesFound,
      totalCities: cities.length,
      results: results,
      summary: dataOutput.generateSummary(results)
    };
    
    console.log(`Final results prepared: ${totalOfficesFound} offices from ${cities.length} cities`);
    
    // Send final results to frontend FIRST (critical for UI)
    console.log('Sending results to frontend...');
    sendEvent('complete', { results: finalResults });
    console.log('Results sent to frontend successfully');
    
    // Save results to Firebase (secondary - don't let this block frontend results)
    console.log('Saving results to Firebase...');
    
    try {
      if (firebaseService) {
        await dataOutput.saveToFirestore(results);
        console.log('Results successfully saved to Firebase with duplicate checking');

        // Save timing data
        const intensity = getIntensityLevel(config.maxResults || 20, config.searchRadius || 20);
        const timingData = {
          intensity,
          maxResults: config.maxResults || 20,
          searchRadius: config.searchRadius || 20,
          completionTime: Math.floor((Date.now() - startTime) / 1000),
          citiesScraped: cities.length,
          categoriesScraped: selectedCategories.length,
          officesFound: totalOfficesFound,
          timestamp: new Date(),
          categories: selectedCategories,
          categoryKey: '' // This will be set by the FirebaseService
        };

        await firebaseService.saveScrapeTimingData(timingData);
        console.log('Scraping timing data saved to Firebase');
      } else {
        console.log('Firebase not configured - results not saved');
      }
    } catch (saveError) {
      console.error('Error saving results to Firebase:', saveError);
      // Don't let Firebase errors prevent frontend results - they're already sent
    }
    
    console.log(`Scraping completed! Found ${totalOfficesFound} offices across ${cities.length} cities and ${selectedCategories.length} categories`);
    
    // Close scraper
    if (scraper) {
      await scraper.close();
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent('error', { error: errorMessage });
    console.error(`Scraping failed:`, error);
  } finally {
    // Close scraper if it exists
    if (scraper) {
      try {
        await scraper.close();
      } catch (closeError) {
        console.error('Error closing scraper:', closeError);
      }
    }
    
    // Mark controller as closed to prevent further attempts
    controllerClosed = true;
    
    // Restore original console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    try {
      controller.close();
    } catch (error) {
      // Controller already closed, ignore
    }
  }
} 