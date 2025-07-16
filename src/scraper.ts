import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  ArchitectureOffice, 
  ScraperConfig, 
  SearchResult, 
  LatvianCity, 
  LATVIAN_CITIES, 
  ARCHITECTURE_SEARCH_TERMS 
} from './types';

export class GoogleMapsArchitectureScraper {
  private browser: Browser | null = null;
  private config: ScraperConfig;
  private browserReconnectAttempts = 0;
  private maxBrowserReconnectAttempts = 3;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      maxResults: config.maxResults ?? 50,
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

  async searchArchitectureOffices(city: string): Promise<SearchResult> {
    await this.ensureBrowserConnection();

    const latvianCity = LATVIAN_CITIES.find(c => 
      c.name === city || c.nameEn === city
    );

    if (!latvianCity) {
      throw new Error(`City "${city}" not found in Latvia cities list.`);
    }

    console.log(`🔍 Searching for architecture offices in ${latvianCity.name}...`);

    const allOffices: ArchitectureOffice[] = [];
    
    // Use only "architecture firm" to match Google Maps business labeling
    const searchTerms = ["architecture firm"];
    
          console.log(`Using single search term for better Google Maps business labeling match:`);
    searchTerms.forEach((term, index) => {
      console.log(`   ${index + 1}. "${term}"`);
    });
    
    // Search with the selected term
    for (const searchTerm of searchTerms) {
      try {
        const offices = await this.searchWithTermRetry(latvianCity, searchTerm, 3);
        allOffices.push(...offices);
        
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
            const offices = await this.searchWithTermRetry(latvianCity, searchTerm, 1);
            allOffices.push(...offices);
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

  private async searchWithTermRetry(city: LatvianCity, searchTerm: string, maxRetries: number = 3): Promise<ArchitectureOffice[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔎 Searching: "${searchTerm}" (attempt ${attempt}/${maxRetries})`);
        
        // Ensure browser is connected before each search
        await this.ensureBrowserConnection();
        
        const offices = await this.searchWithTerm(city, searchTerm);
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

  private async searchWithTerm(city: LatvianCity, searchTerm: string): Promise<ArchitectureOffice[]> {
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
      const offices = await this.extractOfficeData(page);
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

  private async extractOfficeData(page: Page): Promise<ArchitectureOffice[]> {
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
      
      // Process elements by index, querying fresh elements each time
      for (let i = 0; i < elementsToProcess; i++) {
        try {
          // Query for fresh element at click time to avoid detached nodes
          const element = await page.evaluate((selector, index) => {
            const elements = document.querySelectorAll(selector);
            if (elements[index]) {
              // Add a unique identifier to track this element
              elements[index].setAttribute('data-scraper-index', index.toString());
              return true;
            }
            return false;
          }, workingSelector, i);

          if (!element) {
            console.log(`   ⚠️  Element ${i + 1} not found, may have been removed`);
            continue;
          }

          // Click on the fresh element using evaluate to avoid detached node issues
          const clickSuccess = await page.evaluate((selector, index) => {
            const elements = document.querySelectorAll(selector);
            const targetElement = elements[index] as HTMLElement;
            if (targetElement && targetElement.click) {
              targetElement.click();
              return true;
            }
            return false;
          }, workingSelector, i);

          if (!clickSuccess) {
            console.log(`   ⚠️  Failed to click element ${i + 1}, element may be detached`);
            continue;
          }

          console.log(`   🔍 Clicked element ${i + 1}/${elementsToProcess}`);
          await this.delay(2000); // Wait for sidebar to load
          
          const office = await this.extractOfficeDetails(page);
          if (office) {
            offices.push(office);
            console.log(`   ✅ Extracted: ${office.name} - ${office.address}`);
          } else {
            console.log(`   ⚠️  No office data extracted for element ${i + 1}`);
          }
          
          // Add small delay between extractions
          await this.delay(1000);
          
        } catch (error) {
          console.error(`   ⚠️  Error extracting office ${i + 1}:`, error);
        }
      }

    } catch (error) {
      console.error('   ❌ Error extracting office data:', error);
    }

    return offices;
  }

  private async extractOfficeDetails(page: Page): Promise<ArchitectureOffice | null> {
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

      // **BUSINESS LABELING VALIDATION**
      // Check for Google Maps business labels that indicate "Architecture firm"
      const businessLabels = await this.extractBusinessLabels(page);
      const isArchitectureFirm = await this.validateArchitectureFirm(businessLabels);
      
      if (!isArchitectureFirm) {
        console.log('     ⚠️  Business labeling validation failed - not an architecture firm');
        return null; // Skip this business if it's not validated as an architecture firm
      }
      
      console.log('     ✅ Business labeling validation passed - confirmed architecture firm');

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
      
      // Extract website with multiple selectors
      const websiteSelectors = [
        '[data-section-id="overview"] a[data-value="Website"]',
        'a[data-value="Website"]',
        '[data-item-id="website"]',
        'div[data-value="Website"] a',
        'span[data-value="Website"] a'
      ];
      let website = '';
      for (const selector of websiteSelectors) {
        try {
          website = await page.$eval(selector, (el: Element) => el?.getAttribute('href') || '');
          if (website) {
            console.log(`     ✅ Found website with selector: ${selector}`);
            break;
          }
        } catch {
          // Try next selector
        }
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

  private async fallbackScrolling(page: Page): Promise<void> {
    console.log('   🔄 Falling back to basic page scrolling...');
    try {
      // Simple scroll down for a few times
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          const resultsPanel = document.querySelector('[role="main"]');
          if (resultsPanel) {
            resultsPanel.scrollTo(0, resultsPanel.scrollHeight);
          }
        });
        await this.delay(1000);
      }
      console.log('   ✅ Basic scrolling complete.');
    } catch (error) {
      console.error('   ❌ Basic scrolling failed:', error);
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