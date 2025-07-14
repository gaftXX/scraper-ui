import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  ArchitectureOffice, 
  ScraperConfig, 
  SearchResult, 
  LatvianCity, 
  LATVIAN_CITIES, 
  ARCHITECTURE_SEARCH_TERMS,
  getSearchTermsForCategories,
  SearchCategory,
  SEARCH_CATEGORIES
} from './types';

export class GoogleMapsArchitectureScraper {
  private browser: Browser | null = null;
  private config: ScraperConfig;
  private browserReconnectAttempts = 0;
  private maxBrowserReconnectAttempts = 3;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      maxResults: config.maxResults ?? 200, // Increased from 50 to handle more results from enhanced scrolling
      delayBetweenRequests: config.delayBetweenRequests ?? 3000,
      timeout: config.timeout ?? 45000,
      outputFormat: config.outputFormat ?? 'json',
      outputFile: config.outputFile ?? 'architecture_offices',
      cities: config.cities ?? LATVIAN_CITIES.map(city => city.name),
      searchRadius: config.searchRadius ?? 10,
      humanBehavior: config.humanBehavior ?? true,
      stealthMode: config.stealthMode ?? true,
      firebaseConfig: config.firebaseConfig
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Google Maps scraper...');
    
    // Add system diagnostics
    console.log('📊 System information:');
    console.log(`   - Platform: ${process.platform}`);
    console.log(`   - Node version: ${process.version}`);
    console.log(`   - Architecture: ${process.arch}`);
    console.log(`   - Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    
    try {
      // Much simpler browser launch for macOS
      const launchOptions = {
        headless: this.config.headless ? true : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--no-first-run',
          '--disable-default-apps'
        ],
        ignoreHTTPSErrors: true,
        timeout: 60000,
        // Add process management
        dumpio: false,
        pipe: false
      };
      
      console.log('🔧 Launching browser with simplified configuration...');
      this.browser = await puppeteer.launch(launchOptions);
      
      // Test browser connection immediately
      const pages = await this.browser.pages();
      console.log(`✅ Browser launched successfully with ${pages.length} initial pages`);
      
      // Add connection error handling
      this.browser.on('disconnected', () => {
        console.log('⚠️  Browser disconnected, will attempt to reconnect if needed');
        this.browser = null;
      });
      
      // Test creating a page to verify connection
      const testPage = await this.browser.newPage();
      await testPage.close();
      console.log('✅ Browser connection verified');
      
      console.log('✅ Browser initialized successfully');
      this.browserReconnectAttempts = 0;
      
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.slice(0, 500) + '...'
        });
      }
      
      throw new Error(`Browser initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 Browser closed');
      } catch (error) {
        console.log('⚠️  Browser close warning:', error);
      }
      this.browser = null;
    }
  }

  /**
   * Reset scraper state
   */
  reset(): void {
    // Reset browser reconnect attempts
    this.browserReconnectAttempts = 0;
    console.log('🔄 Scraper state reset');
  }

  private async ensureBrowserConnection(): Promise<void> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('🔄 Browser not connected, attempting to reconnect...');
      
      if (this.browserReconnectAttempts >= this.maxBrowserReconnectAttempts) {
        throw new Error('Maximum browser reconnection attempts exceeded');
      }
      
      this.browserReconnectAttempts++;
      
      // Close existing browser if it exists
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (error) {
          console.log('⚠️  Error closing disconnected browser:', error);
        }
      }
      
      // Wait before reconnecting
      await this.delay(2000 * this.browserReconnectAttempts);
      
      // Reinitialize browser
      await this.initialize();
    }
  }

  async searchArchitectureOffices(
    city: string, 
    cityIndex: number = 0, 
    totalCities: number = 1,
    category: SearchCategory = 'architecture-only'
  ): Promise<SearchResult> {
    await this.ensureBrowserConnection();

    const latvianCity = LATVIAN_CITIES.find(c => 
      c.name === city || c.nameEn === city
    );

    if (!latvianCity) {
      throw new Error(`City "${city}" not found in Latvia cities list.`);
    }

    console.log(`🔍 Searching for ${category} offices in ${latvianCity.name}...`);

    const allOffices: ArchitectureOffice[] = [];
    
    // Get search terms for the specified category
    // For architecture-only, construction, interior-design, and property-development: only use single focused term to match Google Maps business labeling
    // For other categories: use multiple terms
    const searchTermCount = (category === 'architecture-only' || category === 'construction' || category === 'interior-design' || category === 'property-development') ? 1 : 4;
    const searchTerms = getSearchTermsForCategories([category], true, searchTermCount);
    
    console.log(`🎯 Using ${searchTerms.length} search term(s) for ${category} category:`);
    searchTerms.forEach((term, index) => {
      console.log(`   ${index + 1}. "${term}"`);
    });
    
    // Search with the selected terms
    for (const searchTerm of searchTerms) {
      try {
        const offices = await this.searchWithTermRetry(latvianCity, searchTerm, 3, category);
        // Add category info to each office
        const categorizedOffices = offices.map(office => ({ ...office, category }));
        allOffices.push(...categorizedOffices);
        
        // Add randomized delay between searches
        await this.randomDelay(this.config.delayBetweenRequests!, 1000);
      } catch (error) {
        console.error(`⚠️  Failed to search for "${searchTerm}" in ${latvianCity.name} after retries:`, error);
        
        // Check if it's a connection error and try to reconnect
        if (this.isConnectionError(error)) {
          console.log('🔄 Detected connection error, attempting to reconnect...');
          try {
            await this.ensureBrowserConnection();
            // Retry the search term once after reconnection
            const offices = await this.searchWithTermRetry(latvianCity, searchTerm, 1, category);
            const categorizedOffices = offices.map(office => ({ ...office, category }));
            allOffices.push(...categorizedOffices);
          } catch (reconnectError) {
            console.error(`❌ Failed to reconnect and retry "${searchTerm}":`, reconnectError);
          }
        }
      }
    }

    // Remove duplicates based on name and address
    const uniqueOffices = this.removeDuplicates(allOffices);
    
    return {
      offices: uniqueOffices.slice(0, this.config.maxResults),
      totalFound: uniqueOffices.length,
      searchQuery: searchTerms.join(', '),
      category,
      city: latvianCity.name,
      timestamp: new Date().toISOString()
    };
  }

  private isConnectionError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes('socket hang up') || 
           errorMessage.includes('ECONNRESET') || 
           errorMessage.includes('detached') || 
           errorMessage.includes('closed') ||
           errorMessage.includes('disconnected') ||
           errorMessage.includes('Connection closed');
  }

  private async searchWithTermRetry(city: LatvianCity, searchTerm: string, maxRetries: number = 3, category: SearchCategory = 'architecture-only'): Promise<ArchitectureOffice[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔎 Searching: "${searchTerm}" (attempt ${attempt}/${maxRetries})`);
        
        // Ensure browser is connected before each search
        await this.ensureBrowserConnection();
        
        const offices = await this.searchWithTerm(city, searchTerm, category);
        console.log(`   ✅ Found ${offices.length} offices for "${searchTerm}"`);
        return offices;
      } catch (error) {
        console.error(`   ❌ Attempt ${attempt}/${maxRetries} failed for "${searchTerm}" in ${city.name}:`, error);
        
        // If it's a connection error, try to reconnect
        if (this.isConnectionError(error)) {
          console.log('   🔄 Connection error detected, will reconnect on next attempt');
          this.browser = null; // Force reconnection
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        await this.randomDelay(2000 * attempt, 1000);
      }
    }
    return [];
  }

  private async searchWithTerm(city: LatvianCity, searchTerm: string, category: SearchCategory = 'architecture-only'): Promise<ArchitectureOffice[]> {
    let page: Page | null = null;
    
    try {
      // Ensure browser is connected
      await this.ensureBrowserConnection();
      
      page = await this.browser!.newPage();
      
      // Set up page error handling
      page.on('error', (error) => {
        console.error('   ⚠️  Page error:', error);
      });
      
      page.on('pageerror', (error) => {
        console.error('   ⚠️  Page JavaScript error:', error);
      });
      
      // Apply stealth features if enabled
      if (this.config.stealthMode) {
        await this.applyStealthFeatures(page);
      }

      // Set realistic user agent and viewport
      await this.setRandomUserAgent(page);

      // Construct search query
      const query = `${searchTerm} ${city.searchTerms[0]}`;
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      
      // Navigate to Google Maps with better error handling
      await page.goto(searchUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      // Handle Google consent page redirect
      await this.handleGoogleConsent(page);

      // Simulate human-like behavior if enabled
      if (this.config.humanBehavior) {
        await this.simulateHumanBehavior(page);
      }

      // Wait a bit for dynamic content to load with random delay
      await this.delay(3000 + Math.random() * 2000);

      // Check for potential blocking or login prompts
      await this.handlePotentialBlocking(page);

      // Wait for results to load with better selector strategy
      try {
        await page.waitForSelector('[role="main"]', { timeout: 15000 });
        console.log('   ✅ Main content loaded');
        await this.delay(2000);
      } catch {
        console.log('   ⚠️  No main content found, trying alternative selectors');
        
        // Try alternative selectors for Google Maps results
        const alternativeSelectors = [
          '.m6QErb',
          '#pane',
          'div[data-result-index]',
          'div[jsaction*="pane.resultCard.click"]',
          'div[role="article"]',
          'a.hfpxzc',
          'div[data-cid]'
        ];
        
        let resultsFound = false;
        for (const selector of alternativeSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            console.log(`   ✅ Found results with selector: ${selector}`);
            resultsFound = true;
            break;
          } catch {
            // Try next selector
          }
        }
        
        if (!resultsFound) {
          console.log('   ⚠️  No results found with any selector');
          return [];
        }
      }

      // Extract office data
      const offices = await this.extractOfficeData(page, category);
      return offices;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.isConnectionError(error)) {
        throw new Error(`Browser connection lost while searching for "${searchTerm}": ${errorMessage}`);
      }
      
      throw error;
    } finally {
      // Always close the page to prevent memory leaks
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.log('   ⚠️  Error closing page:', error);
        }
      }
    }
  }

  private async applyStealthFeatures(page: Page): Promise<void> {
    // Remove automation indicators and set realistic browser properties
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override the plugins property to use a non-empty array
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Override the languages property to use a more realistic array
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override the permissions property
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission } as any) :
          originalQuery(parameters)
      );
    });
  }

  private async setRandomUserAgent(page: Page): Promise<void> {
    // Set realistic user agent and viewport
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUserAgent);
    
    const viewports = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 }
    ];
    
    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(randomViewport);
    
    // Set additional headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
  }

  private async extractOfficeData(page: Page, category: SearchCategory = 'architecture-only'): Promise<ArchitectureOffice[]> {
    const offices: ArchitectureOffice[] = [];

    try {
      // Wait for and scroll to load more results
      await this.scrollToLoadResults(page);

      // Add a small delay to let the DOM stabilize after scrolling
      await this.delay(3000);

      // Try multiple selectors to find office results - but don't store handles, just count
      const resultSelectors = [
        'a.hfpxzc', // Primary working selector - put this first
        'div[data-result-index]', // Original selector
        'div[jsaction*="pane.resultCard.click"]', // Click-able result cards
        'div[role="article"]', // Article-role results
        'div[data-cid]', // Results with CID
        'div[data-result-ad-index]', // Ad results (still businesses)
        'div[aria-label*="results"] div[tabindex="0"]', // Focusable results
        'div.Nv2PK', // Another common result class
        'div[data-value="Directions"]', // Results with directions
        'div[jstcache]' // Results with JS cache
      ];

      let totalElementCount = 0;
      let workingSelector = '';
      
      // Find which selector works and count total elements
      for (const selector of resultSelectors) {
        try {
          const elementCount = await page.evaluate((sel) => {
            return document.querySelectorAll(sel).length;
          }, selector);
          
          if (elementCount > 0) {
            console.log(`   ✅ Found ${elementCount} elements with selector: ${selector}`);
            totalElementCount = elementCount;
            workingSelector = selector;
            break;
          }
        } catch (selectorError) {
          // Try next selector
        }
      }

      if (totalElementCount === 0) {
        console.log('   ⚠️  No office elements found with any selector');
        return offices;
      }
      
      const elementsToProcess = Math.min(totalElementCount, this.config.maxResults!);
      console.log(`   📋 Processing ${elementsToProcess} office elements (found ${totalElementCount} total)`);
      
      const startTime = Date.now();
      let successfulExtractions = 0;
      let failedExtractions = 0;
      
      // First, collect all office names and addresses to check for duplicates
      const seenOffices = new Set<string>();
      const duplicateOffices = new Set<string>();
      
      // Process elements sequentially to avoid conflicts
      for (let i = 0; i < elementsToProcess; i++) {
        try {
          // Progress logging every 10 results
          if (i > 0 && i % 10 === 0) {
            const elapsed = Date.now() - startTime;
            const avgTime = elapsed / i;
            const remaining = elementsToProcess - i;
            let timeEstimate = "not enough data";
            
            // Only show time estimate if we have processed at least 2 items
            if (i >= 2) {
              const estimatedTotal = (avgTime * remaining) / 1000;
              timeEstimate = `~${estimatedTotal.toFixed(0)}s remaining`;
            }
            
            console.log(`   📊 Progress: ${i}/${elementsToProcess} (${successfulExtractions} successful, ${failedExtractions} failed, ${timeEstimate})`);
          }

          // Process one element at a time
          const maxRetries = 2;
          let retryCount = 0;
          
          while (retryCount <= maxRetries) {
            try {
              // Query for fresh element at click time to avoid detached nodes
              const element = await page.evaluate((selector, idx) => {
                const elements = document.querySelectorAll(selector);
                if (elements[idx]) {
                  // Add a unique identifier to track this element
                  elements[idx].setAttribute('data-scraper-index', idx.toString());
                  return true;
                }
                return false;
              }, workingSelector, i);

              if (!element) {
                console.log(`   ⚠️  Element ${i + 1} not found, may have been removed`);
                failedExtractions++;
                break;
              }

              // Click on the fresh element using evaluate to avoid detached node issues
              const clickSuccess = await page.evaluate((selector, idx) => {
                const elements = document.querySelectorAll(selector);
                const targetElement = elements[idx] as HTMLElement;
                if (targetElement && targetElement.click) {
                  targetElement.click();
                  return true;
                }
                return false;
              }, workingSelector, i);

              if (!clickSuccess) {
                console.log(`   ⚠️  Failed to click element ${i + 1}, element may be detached`);
                failedExtractions++;
                break;
              }

              console.log(`   🔍 Clicked element ${i + 1}/${elementsToProcess}`);
              
              // Wait for sidebar with timeout and retry logic
              await this.delay(2000); // Wait for sidebar to load
              
              // First, check if this is a duplicate by getting just the name and address
              const quickInfo = await this.getQuickOfficeInfo(page);
              if (!quickInfo) {
                if (retryCount < maxRetries) {
                  retryCount++;
                  console.log(`   🔄 Retrying quick info extraction for element ${i + 1} (attempt ${retryCount + 1}/${maxRetries + 1})`);
                  await this.delay(1000); // Wait before retry
                  continue;
                } else {
                  console.log(`   ⚠️  Could not get quick info for element ${i + 1} after ${maxRetries + 1} attempts`);
                  failedExtractions++;
                  break;
                }
              }

              const officeKey = `${quickInfo.name.toLowerCase()}-${quickInfo.address.toLowerCase()}`;
              
              // Check if we've seen this office before
              if (seenOffices.has(officeKey)) {
                console.log(`   ⚠️  Duplicate office found: ${quickInfo.name} - ${quickInfo.address}`);
                duplicateOffices.add(officeKey);
                break; // Not a failure, just a duplicate
              }
              
              // If not a duplicate, mark as seen and proceed with full extraction
              seenOffices.add(officeKey);
              
              const office = await this.extractOfficeDetails(page, category);
              if (office) {
                console.log(`   ✅ Extracted: ${office.name} - ${office.address}`);
                offices.push(office);
                successfulExtractions++;
                break; // Success, exit retry loop
              } else {
                console.log(`   ⚠️  No office data extracted for element ${i + 1}`);
                failedExtractions++;
                break;
              }
            } catch (error) {
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`   🔄 Retrying element ${i + 1} due to error (attempt ${retryCount + 1}/${maxRetries + 1}): ${error instanceof Error ? error.message : error}`);
                await this.delay(1000); // Wait before retry
                continue;
              } else {
                console.error(`   ⚠️  Error extracting office ${i + 1} after ${maxRetries + 1} attempts:`, error instanceof Error ? error.message : error);
                failedExtractions++;
                break;
              }
            }
          }
          
          // Add small delay between elements with some randomness
          await this.delay(800 + Math.random() * 400);
          
        } catch (error) {
          failedExtractions++;
          console.error(`   ⚠️  Error processing element ${i + 1}:`, error instanceof Error ? error.message : error);
          
          // Try to recover by waiting and continuing
          await this.delay(1000);
        }
        
        // Memory management: force garbage collection every 50 extractions
        if (i > 0 && i % 50 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`   📊 Extraction complete: ${successfulExtractions} successful, ${failedExtractions} failed in ${totalTime.toFixed(1)}s`);
      console.log(`   📊 Duplicates found: ${duplicateOffices.size}`);

    } catch (error) {
      console.error('   ❌ Error extracting office data:', error);
    }

    return offices;
  }

  private async getQuickOfficeInfo(page: Page): Promise<{ name: string; address: string } | null> {
    try {
      // Wait a bit longer for content to load
      await this.delay(1000);
      
      // Extract name with multiple selectors - prioritize business name over page headers
      const nameSelectors = [
        '.DUwDvf', // Main business name selector
        '.qBF1Pd', // Alternative business name
        '.fontTitleLarge', // Large title
        '.x3AX1-LfntMc-header-title', // Header title
        'h1:not(.kpih0e)', // H1 that's not a breadcrumb
        'h2:not(.kPvgOb)', // H2 that's not a section header
        '[data-section-id="overview"] h1',
        'div[role="main"] h1',
        '.SPZz6b', // Additional selector
        '.tAiQdd' // Additional selector
      ];
      let name = '';
      for (const selector of nameSelectors) {
        try {
          name = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (name && name !== 'Rezultāti' && name !== 'Sponsorēts' && name.length > 2) {
            break;
          }
        } catch {
          // Try next selector
        }
      }

      // Extract address with multiple selectors
      const addressSelectors = [
        '[data-section-id="overview"] button[data-value="Address"]',
        'button[data-value="Address"]',
        '[data-item-id="address"]',
        'div[data-value="Address"]',
        'span[data-value="Address"]',
        '.Io6YTe.fontBodyMedium', // Common address selector
        '.rogA2c .Io6YTe', // Address in info panel
        '[data-value="Directions"] + div', // Address near directions
        '.AeaXub .Io6YTe', // Alternative address selector
        '.RcCsl .Io6YTe' // Another address selector
      ];
      let address = '';
      for (const selector of addressSelectors) {
        try {
          if (selector === '.Io6YTe.fontBodyMedium') {
            // Special handling for this selector - find the one that looks like an address
            const elements = await page.$$(selector);
            for (const element of elements) {
              const text = await element.evaluate(el => el?.textContent?.trim() || '');
              if (text && (text.includes('iela') || text.includes('Rīga') || text.includes('LV-'))) {
                address = text;
                break;
              }
            }
          } else {
            address = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          }
          if (address) {
            break;
          }
        } catch {
          // Try next selector
        }
      }

      // More lenient approach - proceed if we have at least a name
      if (!name) {
        console.log('   ⚠️  No name found in quick info extraction');
        return null;
      }

      // If no address found, try to extract from any text on the page that looks like an address
      if (!address) {
        try {
          const possibleAddress = await page.evaluate(() => {
            const allText = document.body.textContent || '';
            const addressRegex = /[\w\s]+iela\s+[\w\-\s,]+Rīga[\w\s,]*LV-\d{4}/i;
            const match = allText.match(addressRegex);
            return match ? match[0].trim() : '';
          });
          if (possibleAddress) {
            address = possibleAddress;
          }
        } catch {
          // Ignore
        }
      }

      // Return with name and whatever address we found (even if empty)
      return { name, address: address || 'Address not found' };
    } catch (error) {
      console.error('   ⚠️  Error getting quick office info:', error);
      return null;
    }
  }

  private async extractOfficeDetails(page: Page, category: SearchCategory = 'architecture-only'): Promise<ArchitectureOffice | null> {
    try {
      // Wait for the sidebar to load with multiple possible selectors
      const sidebarSelectors = [
        '[data-section-id="overview"]',
        '#pane',
        'div[role="main"]',
        'div[aria-label*="Results"]',
        'div[data-value="Directions"]'
      ];
      
      let sidebarLoaded = false;
      let previousOfficeName = '';
      
      // First, get the current office name to detect when content changes
      try {
        const currentName = await page.$eval('.DUwDvf', (el: Element) => el?.textContent?.trim() || '');
        previousOfficeName = currentName;
      } catch {
        // Ignore if can't get current name
      }
      
      for (const selector of sidebarSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          console.log(`     ✅ Sidebar loaded with selector: ${selector}`);
          sidebarLoaded = true;
          break;
        } catch {
          // Try next selector
        }
      }
      
      if (!sidebarLoaded) {
        console.log('     ⚠️  No sidebar found, trying to extract from current content');
      }
      
      // Wait for content to actually update by monitoring the office name
      let contentUpdated = false;
      let finalOfficeName = '';
      
      // Try to wait for content to update by checking office name changes
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const currentName = await page.$eval('.DUwDvf', (el: Element) => el?.textContent?.trim() || '');
          
          if (currentName && currentName !== previousOfficeName && currentName !== 'Rezultāti' && currentName !== 'Sponsorēts') {
            finalOfficeName = currentName;
            contentUpdated = true;
            console.log(`     ✅ Content updated - Office name: ${finalOfficeName}`);
            break;
          }
          
          // Wait a bit before next check
          await this.delay(200);
        } catch {
          // Continue trying
        }
      }
      
      if (!contentUpdated && !finalOfficeName) {
        console.log('     ⚠️  Content may not have updated, proceeding with current content');
      }

      // **BUSINESS LABELING VALIDATION**
      // Check for Google Maps business labels based on category
      const businessLabels = await this.extractBusinessLabels(page);
      let isValidBusiness = false;
      
      // Use category-specific validation
      if (category === 'architecture-only') {
        isValidBusiness = await this.validateArchitectureFirm(businessLabels);
      } else if (category === 'construction') {
        isValidBusiness = await this.validateConstructionFirm(businessLabels);
      } else if (category === 'interior-design') {
        isValidBusiness = await this.validateInteriorDesignFirm(businessLabels);
      } else if (category === 'property-development') {
        isValidBusiness = await this.validatePropertyDevelopmentFirm(businessLabels);
      } else {
        // For other categories, use architecture validation as fallback (can be expanded later)
        isValidBusiness = await this.validateArchitectureFirm(businessLabels);
      }
      
      if (!isValidBusiness) {
        console.log(`     ⚠️  Business labeling validation failed - not a valid ${category} business`);
        return null; // Skip this business if it's not validated
      }
      
      console.log(`     ✅ Business labeling validation passed - confirmed ${category} business`);

      // Extract name with multiple selectors - prioritize business name over page headers
      const nameSelectors = [
        '.DUwDvf', // Main business name selector
        '.qBF1Pd', // Alternative business name
        '.fontTitleLarge', // Large title
        '.x3AX1-LfntMc-header-title', // Header title
        'h1:not(.kpih0e)', // H1 that's not a breadcrumb
        'h2:not(.kPvgOb)', // H2 that's not a section header
        '[data-section-id="overview"] h1',
        'div[role="main"] h1'
      ];
      let name = '';
      for (const selector of nameSelectors) {
        try {
          name = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (name && name !== 'Rezultāti' && name !== 'Sponsorēts' && name.length > 2) {
            console.log(`     ✅ Found name with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }

      // Extract address with multiple selectors
      const addressSelectors = [
        '[data-section-id="overview"] button[data-value="Address"]',
        'button[data-value="Address"]',
        '[data-item-id="address"]',
        'div[data-value="Address"]',
        'span[data-value="Address"]'
      ];
      let address = '';
      for (const selector of addressSelectors) {
        try {
          address = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (address) {
            console.log(`     ✅ Found address with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }
      
      // Extract phone with multiple selectors
      const phoneSelectors = [
        '[data-section-id="overview"] button[data-value="Phone"]',
        'button[data-value="Phone"]',
        '[data-item-id="phone"]',
        'div[data-value="Phone"]',
        'span[data-value="Phone"]'
      ];
      let phone = '';
      for (const selector of phoneSelectors) {
        try {
          phone = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (phone) {
            console.log(`     ✅ Found phone with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }
      
      // Extract website with highly specific selectors for the office sidebar
      console.log(`     🔍 Searching for website for: ${name}`);
      
      let website = '';
      let websiteFoundWith = '';
      let foundLinkInfo = null;
      let availableLinks: Array<{href: string | null; text: string | undefined; selector: string}> = [];
      
      try {
        // Method 1: Extract website from business labels first
        for (const label of businessLabels) {
          if (label.includes('.') && !label.includes(' ') && !label.includes('@') && !label.includes('tel:')) {
            website = label.startsWith('http') ? label : `https://${label}`;
            console.log(`     ✅ Found website from business label: ${website}`);
            break;
          }
        }
        
        // Method 2: If no website found in labels, try selectors
        if (!website) {
      // First, let's debug what's available in the sidebar
          availableLinks = await page.evaluate(() => {
        const pane = document.querySelector('#pane');
        if (!pane) return [];
        
        const links = Array.from(pane.querySelectorAll('a[href]'));
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim(),
          selector: link.tagName + (link.className ? '.' + link.className.replace(/\s+/g, '.') : '')
        })).filter(link => link.href && !link.href.includes('google.com') && !link.href.includes('maps.google'));
      });
      
      console.log(`     📋 Available links in sidebar: ${JSON.stringify(availableLinks, null, 2)}`);
        }
      } catch (error) {
        console.log(`     ⚠️  Error extracting website from labels: ${error}`);
      }
      
      // Define website selectors
      const websiteSelectors = [
        // Most specific - official website button/link
        '#pane button[data-value="Website"]',
        '#pane a[data-value="Website"]',
        '#pane [data-item-id="website"] a',
        '#pane [data-item-id="website"]',
        
        // Website section selectors
        '#pane div[data-value="Website"] a',
        '#pane div[data-value="Website"]',
        '#pane span[data-value="Website"]',
        
        // Business card area website
        '#pane .m6QErb a[href^="http"]:not([href*="google"]):not([href*="facebook"]):not([href*="instagram"])',
        '#pane .TIHn2 a[href^="http"]:not([href*="google"]):not([href*="facebook"]):not([href*="instagram"])',
        
        // General external links but only within the office pane
        '#pane a[href^="https://"]:not([href*="google"]):not([href*="facebook"]):not([href*="instagram"]):not([href*="linkedin"]):not([href*="twitter"]):not([href*="youtube"])',
        '#pane a[href^="http://"]:not([href*="google"]):not([href*="facebook"]):not([href*="instagram"]):not([href*="linkedin"]):not([href*="twitter"]):not([href*="youtube"])'
      ];
      
      for (const selector of websiteSelectors) {
        try {
          const elements = await page.$$(selector);
          
          for (const element of elements) {
            // Check if element is visible and contains meaningful content
            const linkInfo = await element.evaluate(el => {
              const rect = el.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0;
              
              if (!isVisible) return null;
              
              const href = el.getAttribute('href') || '';
              const text = el.textContent?.trim() || '';
              const tagName = el.tagName;
              
              return { href, text, tagName, isVisible };
            });
            
            if (!linkInfo || !linkInfo.isVisible) continue;
            
            // Get the href or text content
            let candidateWebsite = linkInfo.href || linkInfo.text;
            
            if (candidateWebsite && candidateWebsite.length > 3) {
              // Skip obvious non-websites
              if (candidateWebsite.match(/^\+?\d+/) || candidateWebsite.includes('@') || candidateWebsite.includes('tel:')) {
                continue;
              }
              
              // Clean and validate URL
              let cleanWebsite = candidateWebsite.trim();
              
              if (cleanWebsite.startsWith('www.')) {
                cleanWebsite = 'https://' + cleanWebsite;
              } else if (!cleanWebsite.startsWith('http')) {
                // Only add protocol if it looks like a domain
                if (cleanWebsite.includes('.') && !cleanWebsite.includes(' ')) {
                  cleanWebsite = 'https://' + cleanWebsite;
                } else {
                  continue; // Skip if doesn't look like a URL
                }
              }
              
              // Final validation
              if (cleanWebsite.includes('.') && cleanWebsite.length > 10 && 
                  !cleanWebsite.includes('google.com') && !cleanWebsite.includes('maps.')) {
                website = cleanWebsite;
                websiteFoundWith = selector;
                foundLinkInfo = linkInfo;
                console.log(`     ✅ Found website "${website}" with selector: ${selector}`);
                console.log(`     📋 Link details: ${JSON.stringify(linkInfo)}`);
                break;
              }
            }
          }
          
          if (website) break; // Stop if we found a website
        } catch (error) {
          console.log(`     ⚠️  Error with selector ${selector}: ${error}`);
        }
      }
      
      // If no website found, log detailed debugging info
      if (!website) {
        console.log(`     ❌ No website found for office: ${finalOfficeName}`);
        console.log(`     🔍 Attempted ${websiteSelectors.length} selectors, found ${availableLinks.length} total links`);
        
        // Log the first few links for debugging
        if (availableLinks.length > 0) {
          console.log(`     📋 First few links: ${availableLinks.slice(0, 3).map(l => l.href).join(', ')}`);
        }
      } else {
        console.log(`     ✅ Successfully extracted website: ${website}`);
      }

      // Extract rating with multiple selectors
      const ratingSelectors = [
        '[jsaction*="pane.rating"]',
        'div[data-value="Rating"]',
        'span[role="img"][aria-label*="star"]',
        'div[aria-label*="star"]'
      ];
      let ratingText = '';
      for (const selector of ratingSelectors) {
        try {
          ratingText = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (ratingText) {
            console.log(`     ✅ Found rating with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }
      
      const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : undefined;
      const reviewsMatch = ratingText ? ratingText.match(/\((\d+,?\d*)\)/) : null;
      const reviews = reviewsMatch ? parseInt(reviewsMatch[1].replace(',', '')) : undefined;

      // Extract hours with multiple selectors
      const hoursSelectors = [
        '[data-section-id="overview"] [data-value="Hours"]',
        '[data-value="Hours"]',
        '[data-item-id="hours"]',
        'div[data-value="Hours"]'
      ];
      let hours = '';
      for (const selector of hoursSelectors) {
        try {
          hours = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (hours) {
            console.log(`     ✅ Found hours with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }

      // Extract description with multiple selectors
      const descriptionSelectors = [
        '[data-section-id="overview"] [data-value="Description"]',
        '[data-value="Description"]',
        '[data-item-id="description"]',
        'div[data-value="Description"]'
      ];
      let description = '';
      for (const selector of descriptionSelectors) {
        try {
          description = await page.$eval(selector, (el: Element) => el?.textContent?.trim() || '');
          if (description) {
            console.log(`     ✅ Found description with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
      }





      if (!name) {
        console.log('     ⚠️  No name found, skipping this result');
        return null;
      }

      const office: ArchitectureOffice = {
        name,
        address,
        phone: phone || undefined,
        website: website || undefined,
        rating,
        reviews,
        hours: hours || undefined,
        description: description || undefined,
        businessLabels: businessLabels // Add business labels to the office data
      };

      console.log(`     📋 Extracted office: ${name} | ${address} | ${phone} | ${website} | Labels: ${businessLabels.join(', ')}`);
      return office;

    } catch (error) {
      console.error('   ⚠️  Error extracting office details:', error);
      return null;
    }
  }

  /**
   * Extract business labels from Google Maps business listing
   */
  private async extractBusinessLabels(page: Page): Promise<string[]> {
    const labels: string[] = [];
    
    try {
      // Common selectors for business category/type labels in Google Maps
      const labelSelectors = [
        'button[data-value="Category"]', // Category button
        'div[data-value="Category"]', // Category div
        '[data-section-id="overview"] [data-value="Category"]', // Overview section category
        'span[data-value="Category"]', // Category span
        '[aria-label*="Category"]', // Any element with category aria-label
        '.DkEaL', // Common class for business category
        'div[jsaction*="category"]', // Elements with category-related actions
        '[data-item-id*="category"]', // Data item with category ID
        '.Io6YTe.fontBodyMedium', // Business type/category text
        '.DUwDvf + .W4Efsd', // Text following business name (often category)
        'div[data-attrid="kc:/business/business:category"]' // Specific business category attribute
      ];
      
      for (const selector of labelSelectors) {
        try {
          const elements = await page.$$(selector);
          
          for (const element of elements) {
            const text = await element.evaluate(el => el?.textContent?.trim() || '');
            if (text && text.length > 2 && !labels.includes(text)) {
              labels.push(text);
              console.log(`     🏷️  Found business label: "${text}" with selector: ${selector}`);
            }
          }
        } catch {
          // Try next selector
        }
      }
      
      // Also check for category information in the page URL or data attributes
      const pageUrl = page.url();
      const categoryMatch = pageUrl.match(/category[s]?[=:]([^&]+)/i);
      if (categoryMatch) {
        const categoryFromUrl = decodeURIComponent(categoryMatch[1]).trim();
        if (categoryFromUrl && !labels.includes(categoryFromUrl)) {
          labels.push(categoryFromUrl);
          console.log(`     🏷️  Found category from URL: "${categoryFromUrl}"`);
        }
      }
      
    } catch (error) {
      console.error('     ⚠️  Error extracting business labels:', error);
    }
    
    return labels;
  }

  /**
   * Validate if the business is a construction firm based on Google Maps business labels
   */
  private async validateConstructionFirm(businessLabels: string[]): Promise<boolean> {
    // Only accept businesses with these construction-related labels (focused on Google Maps business labeling)
    const acceptedConstructionLabels = [
      'construction company',
      'construction',
      'general contractor',
      'building contractor',
      'contractor',
      'builder',
      // Latvian construction terms
      'būvniecība',
      'būvuzņēmums',
      'būvkompānija',
      'celtniecības uzņēmums', // Most common Latvian construction company label
      'inženierbūvniecības uzņēmums' // Engineering construction company
    ];
    
    if (businessLabels.length === 0) {
      console.log('     ⚠️  No business labels found - rejecting');
      return false;
    }
    
    // Check if any label matches accepted construction-related keywords
    for (const label of businessLabels) {
      const labelLower = label.toLowerCase();
      
      for (const acceptedLabel of acceptedConstructionLabels) {
        if (labelLower.includes(acceptedLabel.toLowerCase())) {
          console.log(`     ✅ Construction firm validation PASSED: "${label}" matches accepted label "${acceptedLabel}"`);
          return true;
        }
      }
    }
    
    // If no construction labels found, reject the business
    console.log(`     ❌ Construction firm validation FAILED: No construction-related labels found in: ${businessLabels.join(', ')}`);
    return false;
  }

  /**
   * Validate if the business is an architecture firm based on Google Maps business labels
   */
  private async validateArchitectureFirm(businessLabels: string[]): Promise<boolean> {
    // Only accept businesses with these architecture-related labels (anything else is rejected)
    const acceptedArchitectureLabels = [
      'architect',
      'architecture firm',
      'architectural firm', 
      'architecture',
      'architectural',
      'architecture office',
      'architecture studio',
      'architectural services',
      'arhitekts',
      'arhitektūra'
    ];
    
    if (businessLabels.length === 0) {
      console.log('     ⚠️  No business labels found - rejecting');
      return false;
    }
    
    // Check if any label matches accepted architecture-related keywords
    for (const label of businessLabels) {
      const labelLower = label.toLowerCase();
      
      for (const acceptedLabel of acceptedArchitectureLabels) {
        if (labelLower.includes(acceptedLabel.toLowerCase())) {
          console.log(`     ✅ Architecture firm validation PASSED: "${label}" matches accepted label "${acceptedLabel}"`);
          return true;
        }
      }
    }
    
    // If no architecture labels found, reject the business
    console.log(`     ❌ Architecture firm validation FAILED: No architecture-related labels found in: ${businessLabels.join(', ')}`);
    return false;
  }

  /**
   * Validate if the business is an interior design firm based on Google Maps business labels
   */
  private async validateInteriorDesignFirm(businessLabels: string[]): Promise<boolean> {
    // Only accept businesses with these interior design-related labels (focused on Google Maps business labeling)
    const acceptedInteriorDesignLabels = [
      'interior designer',
      'interior design',
      'interior design studio',
      'interior decorator',
      'designer',
      // Latvian interior design terms
      'interjera dizainers',
      'interjera dizains',
      'interjera projektēšana',
      'interjera dizaina birojs'
    ];
    
    if (businessLabels.length === 0) {
      console.log('     ⚠️  No business labels found - rejecting');
      return false;
    }
    
    // Check if any label matches accepted interior design-related keywords
    for (const label of businessLabels) {
      const labelLower = label.toLowerCase();
      
      for (const acceptedLabel of acceptedInteriorDesignLabels) {
        if (labelLower.includes(acceptedLabel.toLowerCase())) {
          console.log(`     ✅ Interior design firm validation PASSED: "${label}" matches accepted label "${acceptedLabel}"`);
          return true;
        }
      }
    }
    
    // If no interior design labels found, reject the business
    console.log(`     ❌ Interior design firm validation FAILED: No interior design-related labels found in: ${businessLabels.join(', ')}`);
    return false;
  }

  /**
   * Validate if the business is a property development firm based on Google Maps business labels
   */
  private async validatePropertyDevelopmentFirm(businessLabels: string[]): Promise<boolean> {
    // Only accept businesses with these property development-related labels (focused on Google Maps business labeling)
    const acceptedPropertyDevelopmentLabels = [
      'property developer',
      'real estate developer',
      'real estate development',
      'property development',
      'real estate',
      'developer',
      'development company',
      // Latvian property development terms
      'nekustamā īpašuma attīstītājs',
      'īpašuma attīstītājs',
      'nekustamā īpašuma attīstība',
      'būvattīstība',
      'projektu attīstītājs',
      'būvniecības attīstītājs', // construction developer
      'nekustamā īpašuma projektu attīstītājs', // real estate project developer
      'nekustamā īpašuma aģentūra' // real estate agency (common in Latvia for property development)
    ];
    
    if (businessLabels.length === 0) {
      console.log('     ⚠️  No business labels found - rejecting');
      return false;
    }
    
    // Check if any label matches accepted property development-related keywords
    for (const label of businessLabels) {
      const labelLower = label.toLowerCase();
      
      for (const acceptedLabel of acceptedPropertyDevelopmentLabels) {
        if (labelLower.includes(acceptedLabel.toLowerCase())) {
          console.log(`     ✅ Property development firm validation PASSED: "${label}" matches accepted label "${acceptedLabel}"`);
          return true;
        }
      }
    }
    
    // If no property development labels found, reject the business
    console.log(`     ❌ Property development firm validation FAILED: No property development-related labels found in: ${businessLabels.join(', ')}`);
    return false;
  }

  private async scrollToLoadResults(page: Page): Promise<void> {
    try {
      console.log('   📜 Starting enhanced scrolling for architecture firm results...');
      
      // Multiple selectors for the left results panel with 2024 UI updates
      const resultsPanelSelectors = [
        'div[role="main"]',
        'div[role="feed"]',
        '#pane',
        'div[data-value="pane"]',
        'div[aria-label*="esults"]',
        'div.m6QErb',
        'div[jsaction*="scroll"]',
        'div[data-section-id="results"]' // New selector for 2024 UI
      ];
      
      let resultsPanel = null;
      let feedContainer = null;
      
      // Find both results panel and feed container
      for (const selector of resultsPanelSelectors) {
        try {
          resultsPanel = await page.$(selector);
          if (resultsPanel) {
            console.log(`   ✅ Found results panel with selector: ${selector}`);
            break;
          }
        } catch {
          continue;
        }
      }
      
      // Also try to find the feed container specifically
      try {
        feedContainer = await page.$('div[role="feed"]');
        if (feedContainer) {
          console.log(`   ✅ Found feed container for enhanced scrolling`);
        }
      } catch {
        // Feed container not found, use results panel
      }
      
      if (!resultsPanel && !feedContainer) {
        console.log('   ⚠️  Could not find results panel or feed container, using page scroll');
        await this.fallbackScrolling(page);
        return;
      }
      
      let previousResultCount = 0;
      let currentResultCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 5; // Reduced from 10 to 5 per user request
      let noNewResultsCount = 0;
      const maxNoNewResults = 10; // ✅ FIXED: Increased from 3 to 10 - less aggressive circuit breaker
      let consecutiveFailures = 0;
      let totalLoadedResults = 0;
      
      // Enhanced result counting with multiple selectors
      const resultSelectors = [
        'a.hfpxzc', // Primary selector that works
        'div[data-result-index]',
        'div[jsaction*="pane.resultCard.click"]',
        'div[data-cid]',
        'div[role="article"]',
        'div.Nv2PK', // Common result class
        'div[data-result-ad-index]' // Include ad results
      ];
      
      while (scrollAttempts < maxScrollAttempts && noNewResultsCount < maxNoNewResults) {
        // Count current results before scrolling using multiple selectors
        currentResultCount = await page.evaluate((selectors) => {
          let maxCount = 0;
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              maxCount = Math.max(maxCount, elements.length);
            } catch {
              continue;
            }
          }
          return maxCount;
        }, resultSelectors);
        
        console.log(`   📜 Scroll ${scrollAttempts + 1}: Found ${currentResultCount} results`);
        
        // Enhanced scrolling with multiple techniques for 2024 Google Maps
        await page.evaluate((panelSelector, feedSelector) => {
          const panel = document.querySelector(panelSelector);
          const feed = document.querySelector(feedSelector);
          const target = feed || panel;
          
          if (target) {
            // Technique 1: Scroll to bottom
            target.scrollTop = target.scrollHeight;
            
            // Technique 2: Smooth scroll to trigger lazy loading
            target.scrollBy({ top: 1000, behavior: 'smooth' });
            
            // Technique 3: Scroll within any child scrollable elements
            const scrollableChildren = target.querySelectorAll('[style*="overflow"], [style*="scroll"]');
            scrollableChildren.forEach((child) => {
              if (child.scrollHeight > child.clientHeight) {
                child.scrollTop = child.scrollHeight;
                child.scrollBy({ top: 500, behavior: 'smooth' });
              }
            });
            
            // Technique 4: Scroll the main content area
            const mainContent = target.querySelector('[role="main"]');
            if (mainContent && mainContent !== target) {
              mainContent.scrollTop = mainContent.scrollHeight;
            }
            
            // Technique 5: Trigger multiple scroll events to activate lazy loading
            const scrollEvents = ['scroll', 'wheel', 'touchmove'];
            scrollEvents.forEach(eventType => {
              target.dispatchEvent(new Event(eventType, { bubbles: true }));
            });
            
            // Technique 6: Mouse wheel simulation for better lazy loading
            target.dispatchEvent(new WheelEvent('wheel', { 
              deltaY: 1000, 
              bubbles: true 
            }));
            
            // Technique 7: Focus and blur to trigger event handlers
            if (target && (target as any).focus) {
              (target as any).focus();
            }
            
            // Technique 8: Try to scroll any feed containers
            const feedContainers = target.querySelectorAll('div[data-section-id], div[aria-label*="results"], div[role="feed"]');
            feedContainers.forEach((container) => {
              if (container.scrollHeight > container.clientHeight) {
                container.scrollTop = container.scrollHeight;
                container.scrollBy({ top: 800, behavior: 'smooth' });
              }
            });
          }
        }, resultsPanelSelectors.find(s => resultsPanel) || 'div[role="main"]', 'div[role="feed"]');
        
        // Progressive delay - start with longer delays, then reduce
        const baseDelay = Math.max(6000 - (scrollAttempts * 100), 3000);
        const variableDelay = Math.random() * 2000;
        const totalDelay = baseDelay + variableDelay;
        
        console.log(`   ⏳ Waiting ${Math.round(totalDelay)}ms for new results to load...`);
        await this.delay(totalDelay);
        
        // Check if new results were loaded with enhanced counting
        const newResultCount = await page.evaluate((selectors) => {
          let maxCount = 0;
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              maxCount = Math.max(maxCount, elements.length);
            } catch {
              continue;
            }
          }
          return maxCount;
        }, resultSelectors);
        
        const newResultsLoaded = newResultCount - currentResultCount;
        
        if (newResultsLoaded > 0) {
          console.log(`   ✅ Loaded ${newResultsLoaded} new results (Total: ${newResultCount})`);
          noNewResultsCount = 0; // Reset counter
          consecutiveFailures = 0;
          totalLoadedResults += newResultsLoaded;
        } else {
          noNewResultsCount++;
          consecutiveFailures++;
          console.log(`   ⚠️  No new results loaded (${noNewResultsCount}/${maxNoNewResults}, consecutive failures: ${consecutiveFailures})`);
        }
        
        // Enhanced "Show more" button detection with 2024 UI selectors
        const showMoreSelectors = [
          'button[aria-label*="more"]',
          'button[aria-label*="Show more"]',
          'button:contains("Show more")',
          'button:contains("Load more")',
          'button[data-value="show more"]',
          '[role="button"][aria-label*="more"]',
          'button[jsaction*="more"]',
          'button.VfPpkd-LgbsSe', // Material Design button
          'div[role="button"][aria-label*="more"]',
          'span[role="button"]:contains("Show more")',
          'button[data-ved*="show"]' // Google's tracking parameter
        ];
        
        let showMoreClicked = false;
        for (const selector of showMoreSelectors) {
          try {
            const showMoreButton = await page.$(selector);
            if (showMoreButton) {
              console.log(`   🔄 Found "Show more" button with selector: ${selector}, clicking...`);
              await showMoreButton.click();
              await this.delay(3000); // Wait for button click to load results
              showMoreClicked = true;
              break;
            }
          } catch {
            // Try next selector
          }
        }
        
        if (showMoreClicked) {
          console.log(`   ✅ Successfully clicked "Show more" button`);
          noNewResultsCount = 0; // Reset counter after button click
        }
        
        // Enhanced technique: Intersection Observer simulation to trigger lazy loading
        try {
          await page.evaluate(() => {
            const results = document.querySelectorAll('a.hfpxzc');
            if (results.length > 0) {
              const lastResult = results[results.length - 1];
              lastResult.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          });
        } catch {
          // Ignore if scrollIntoView fails
        }
        
        // Additional technique: Try to trigger viewport events
        try {
          await page.evaluate(() => {
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('orientationchange'));
          });
        } catch {
          // Ignore if viewport events fail
        }
        
        previousResultCount = currentResultCount;
        scrollAttempts++;
        
        // Early exit if we've been consistently failing and have reasonable results
        if (consecutiveFailures >= 5 && totalLoadedResults >= 20) {
          console.log(`   ⚠️  Multiple consecutive failures with ${totalLoadedResults} results loaded, may have reached end`);
          break;
        }
        
        // Memory management: force garbage collection every 10 scrolls
        if (scrollAttempts % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const finalCount = await page.evaluate((selectors) => {
        let maxCount = 0;
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            maxCount = Math.max(maxCount, elements.length);
          } catch {
            continue;
          }
        }
        return maxCount;
      }, resultSelectors);
      
      console.log(`   📜 Enhanced scrolling complete! Final result count: ${finalCount} (${scrollAttempts} scrolls, ${totalLoadedResults} new results loaded)`);
      
      // Final check: if we still have very few results, try alternative approaches
      if (finalCount < 20 && scrollAttempts < maxScrollAttempts) {
        console.log(`   🔄 Low result count (${finalCount}), trying alternative scrolling approaches...`);
        await this.alternativeScrollingApproaches(page);
      }
      
    } catch (error) {
      console.error('   ⚠️  Error during enhanced scrolling:', error);
      await this.fallbackScrolling(page);
    }
  }
  
  private async alternativeScrollingApproaches(page: Page): Promise<void> {
    console.log('   🔄 Trying alternative scrolling approaches...');
    
    try {
      // Alternative approach 1: Try different feed selectors
      const alternativeFeedSelectors = [
        'div[data-section-id]',
        'div[aria-label*="results"]',
        'div[jsaction*="results"]',
        'div.m6QErb > div',
        'div[role="main"] > div[role="region"]',
        'div[data-value="feed"]'
      ];
      
      for (const selector of alternativeFeedSelectors) {
        try {
          const feed = await page.$(selector);
          if (feed) {
            console.log(`   📜 Found alternative feed with selector: ${selector}`);
            await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              if (element) {
                element.scrollTop = element.scrollHeight;
                element.scrollBy({ top: 2000, behavior: 'smooth' });
              }
            }, selector);
            await this.delay(4000);
          }
        } catch {
          continue;
        }
      }
      
      // Alternative approach 2: Try keyboard navigation
      await page.keyboard.press('End');
      await this.delay(2000);
      await page.keyboard.press('PageDown');
      await this.delay(2000);
      
      // Alternative approach 3: Try clicking on the last visible result to trigger loading
      try {
        await page.evaluate(() => {
          const results = document.querySelectorAll('a.hfpxzc');
          if (results.length > 0) {
            const lastResult = results[results.length - 1];
            const event = new MouseEvent('mouseover', { bubbles: true });
            lastResult.dispatchEvent(event);
          }
        });
        await this.delay(3000);
      } catch {
        // Ignore if mouseover fails
      }
      
      // Alternative approach 4: Try multiple rapid scrolls
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          const main = document.querySelector('div[role="main"]');
          if (main) {
            main.scrollBy({ top: 1000, behavior: 'auto' });
          }
        });
        await this.delay(500);
      }
      
      console.log('   ✅ Alternative scrolling approaches completed');
      
    } catch (error) {
      console.error('   ⚠️  Error in alternative scrolling approaches:', error);
    }
  }

  private async fallbackScrolling(page: Page): Promise<void> {
    console.log('   📜 Using fallback scrolling method...');
    
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        // Try multiple scrolling approaches
        window.scrollBy(0, 1000);
        
        const mainElement = document.querySelector('[role="main"]');
        if (mainElement) {
          mainElement.scrollTop = mainElement.scrollHeight;
        }
        
        const paneElement = document.querySelector('#pane');
        if (paneElement) {
          paneElement.scrollTop = paneElement.scrollHeight;
        }
      });
      
      await this.delay(1500);
    }
    
    console.log('   📜 Fallback scrolling complete');
  }

  private removeDuplicates(offices: ArchitectureOffice[]): ArchitectureOffice[] {
    const seen = new Set<string>();
    return offices.filter(office => {
      const key = `${office.name.toLowerCase()}-${office.address.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private randomDelay(baseMs: number, variationMs: number = 1000): Promise<void> {
    const delay = baseMs + (Math.random() * variationMs);
    return this.delay(delay);
  }

  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      const viewport = page.viewport();
      if (viewport) {
        for (let i = 0; i < 3; i++) {
          const x = Math.random() * viewport.width;
          const y = Math.random() * viewport.height;
          await page.mouse.move(x, y);
          await this.delay(100 + Math.random() * 200);
        }
      }

      // Random scroll
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 100);
      });

      // Wait a random amount of time
      await this.delay(500 + Math.random() * 1000);

      // Simulate reading behavior
      await page.evaluate(() => {
        const elements = document.querySelectorAll('h1, h2, h3, p, span');
        if (elements.length > 0) {
          const randomElement = elements[Math.floor(Math.random() * elements.length)];
          randomElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

    } catch (error) {
      // Silently continue if simulation fails
      console.log('   ⚠️  Human behavior simulation failed, continuing...');
    }
  }

  private async handleGoogleConsent(page: Page): Promise<void> {
    try {
      // Wait for the page to load
      await this.delay(2000);
      
      // Check if we're on the Google consent page
      const currentUrl = page.url();
      const isConsentPage = currentUrl.includes('consent.google.com');
      
      if (isConsentPage) {
        console.log('   🛡️  Detected Google consent page, handling...');
        
        // Try multiple consent button selectors
        const consentButtons = [
          'button[aria-label*="Accept"]',
          'button[aria-label*="Pieņemt"]', // Latvian "Accept"
          'button[aria-label*="Akceptēt"]', // Alternative Latvian "Accept"
          'button[data-action="accept"]',
          'button[jsname="Bgjo9c"]', // Common Google consent button
          'button[data-ved]', // Google buttons often have this
          'button:contains("Accept")',
          'button:contains("Pieņemt")',
          'button:contains("Akceptēt")',
          'form[action*="consent"] button',
          'div[role="button"][aria-label*="Accept"]',
          'div[role="button"][aria-label*="Pieņemt"]'
        ];
        
        let consentHandled = false;
        
        for (const selector of consentButtons) {
          try {
            // Handle text-based selectors differently
            if (selector.includes(':contains(')) {
              const buttonText = selector.includes('Accept') ? 'Accept' : 'Pieņemt';
              const buttons = await page.$$eval('button', (buttons, text) => {
                return Array.from(buttons).filter(button => 
                  button.textContent?.includes(text) || 
                  button.innerText?.includes(text)
                );
              }, buttonText);
              
              if (buttons.length > 0) {
                await page.evaluate((text) => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  const targetButton = buttons.find(button => 
                    button.textContent?.includes(text) || 
                    button.innerText?.includes(text)
                  );
                  if (targetButton) {
                    (targetButton as HTMLElement).click();
                  }
                }, buttonText);
                
                console.log(`   ✅ Clicked consent button with text: ${buttonText}`);
                consentHandled = true;
                break;
              }
            } else {
              const element = await page.$(selector);
              if (element) {
                await element.click();
                console.log(`   ✅ Clicked consent button: ${selector}`);
                consentHandled = true;
                break;
              }
            }
          } catch (elementError) {
            // Continue trying other selectors
          }
        }
        
        if (consentHandled) {
          // Wait for redirect to complete
          console.log('   ⏳ Waiting for redirect to Google Maps...');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
          
          // Verify we're back on Google Maps
          const finalUrl = page.url();
          if (finalUrl.includes('maps.google.com')) {
            console.log('   ✅ Successfully redirected to Google Maps');
          } else {
            console.log('   ⚠️  Unexpected redirect URL:', finalUrl);
          }
        } else {
          console.log('   ⚠️  Could not find consent button, continuing anyway...');
        }
      }
      
    } catch (error) {
      console.log('   ⚠️  Error handling Google consent:', error);
      // Continue anyway
    }
  }

  private async handlePotentialBlocking(page: Page): Promise<void> {
    try {
      // Check for common blocking indicators
      const blockingSelectors = [
        'div[role="dialog"]', // Modal dialogs
        '.g-recaptcha', // reCAPTCHA
        '#captcha', // CAPTCHA
        '[data-testid="consent-banner"]', // Consent banners
        'button[aria-label*="Accept"]', // Accept buttons
        'button[aria-label*="Continue"]', // Continue buttons
        'button[id*="accept"]', // Accept buttons by ID
        '.consent-banner', // Generic consent banners
        '[data-cookie-notice]' // Cookie notices
      ];

      for (const selector of blockingSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            console.log(`   🤖 Found potential blocking element: ${selector}`);
            
            // Try to click accept/continue buttons
            if (selector.includes('Accept') || selector.includes('Continue') || selector.includes('accept')) {
              await element.click();
              console.log(`   ✅ Clicked blocking element`);
              await this.delay(2000);
            }
          }
        } catch (elementError) {
          // Continue checking other selectors
        }
      }

      // Handle potential age verification or location consent
      try {
        const locationButton = await page.$('button[data-value="location_consent"]');
        if (locationButton) {
          await locationButton.click();
          console.log('   ✅ Handled location consent');
          await this.delay(2000);
        }
      } catch {
        // Continue
      }

      // Wait for any overlays to disappear
      await this.delay(1000);

    } catch (error) {
      // Silently continue if blocking detection fails
      console.log('   ⚠️  Blocking detection failed, continuing...');
    }
  }

  async scrapeAllCities(): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const cityName of this.config.cities!) {
      try {
        // Ensure browser connection before each city
        await this.ensureBrowserConnection();
        
        const result = await this.searchArchitectureOffices(cityName);
        results.push(result);
        
        console.log(`✅ Completed scraping ${cityName}: ${result.offices.length} offices found`);
        
        // Add delay between cities
        await this.delay(this.config.delayBetweenRequests!);
        
        // Memory management: collect garbage periodically
        if (global.gc && results.length % 3 === 0) {
          global.gc();
        }
        
      } catch (error) {
        console.error(`❌ Error scraping ${cityName}:`, error);
        
        // If it's a connection error, try to recover and continue
        if (this.isConnectionError(error)) {
          console.log(`🔄 Attempting to recover from connection error for ${cityName}...`);
          try {
            // Force browser reconnection
            this.browser = null;
            await this.ensureBrowserConnection();
            
            // Retry the city once
            const result = await this.searchArchitectureOffices(cityName);
            results.push(result);
            console.log(`✅ Recovered and completed scraping ${cityName}: ${result.offices.length} offices found`);
          } catch (retryError) {
            console.error(`❌ Failed to recover scraping for ${cityName}:`, retryError);
          }
        }
      }
    }
    
    return results;
  }
}