import puppeteer, { Browser, Page } from 'puppeteer';
import { CrawledPage, InlookConfig } from './types';

export class InlookWebScraper {
  private browser: Browser | null = null;
  private config: InlookConfig;
  private crawledPages: CrawledPage[] = [];
  private visitedUrls: Set<string> = new Set();

  constructor(config: InlookConfig) {
    this.config = {
      maxDepth: 3,
      includeImages: true,
      includeProjects: true,
      includeTeam: true,
      includeAwards: true,
      includePublications: true,
      timeout: 30000,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      followRedirects: true,
      respectRobotsTxt: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    console.log('Initializing Inlook web scraper...');
    
    try {
      const launchOptions = {
        headless: true,
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
        timeout: 60000
      };
      
      this.browser = await puppeteer.launch(launchOptions);
      console.log('Inlook web scraper initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Inlook web scraper:', error);
      throw new Error(`Web scraper initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('Inlook web scraper closed');
      } catch (error) {
        console.log('Error closing Inlook web scraper:', error);
      }
      this.browser = null;
    }
  }

  async crawlWebsite(): Promise<CrawledPage[]> {
    if (!this.browser) {
      throw new Error('Web scraper not initialized');
    }

    console.log(`Starting to crawl website: ${this.config.websiteUrl}`);
    this.crawledPages = [];
    this.visitedUrls.clear();

    try {
      // Start crawling from the main URL
      await this.crawlPage(this.config.websiteUrl, 0);
      
      console.log(`Crawling completed. Found ${this.crawledPages.length} pages`);
      return this.crawledPages;
      
    } catch (error) {
      console.error('Error during website crawling:', error);
      throw error;
    }
  }

  private async crawlPage(url: string, depth: number): Promise<void> {
    if (depth > this.config.maxDepth! || this.visitedUrls.has(url)) {
      return;
    }

    this.visitedUrls.add(url);
    console.log(`Crawling page: ${url} (depth: ${depth})`);

    let page: Page | null = null;
    
    try {
      page = await this.browser!.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent(this.config.userAgent!);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout
      });

      // Wait for content to load
      await this.delay(2000);

      // Extract page data
      const pageData = await this.extractPageData(page, url, depth);
      this.crawledPages.push(pageData);

      // Find and crawl additional pages if within depth limit
      if (depth < this.config.maxDepth!) {
        const links = await this.extractInternalLinks(page, url);
        
        // Limit concurrent crawling to avoid overwhelming the server
        const maxConcurrent = 3;
        const linkBatches = this.chunkArray(links, maxConcurrent);
        
        for (const batch of linkBatches) {
          await Promise.all(
            batch.map(link => this.crawlPage(link, depth + 1))
          );
          
          // Add delay between batches
          await this.delay(1000);
        }
      }

    } catch (error) {
      console.error(`Error crawling page ${url}:`, error);
      // Continue with other pages even if one fails
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.log('Error closing page:', error);
        }
      }
    }
  }

  private async extractPageData(page: Page, url: string, depth: number): Promise<CrawledPage> {
    try {
      // Extract basic page information
      const title = await page.title();
      
      // Extract text content (clean and structured)
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style, nav, footer, header');
        scripts.forEach((el: any) => el.remove());
        
        // Get main content areas
        const mainContent = document.querySelector('main') || 
                           document.querySelector('[role="main"]') ||
                           document.querySelector('.content') ||
                           document.querySelector('#content') ||
                           document.body;
        
        return mainContent ? mainContent.textContent || '' : '';
      });

      // Extract HTML (cleaned)
      const html = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach((el: any) => el.remove());
        
        return document.documentElement.outerHTML;
      });

      // Extract images
      const images = await page.evaluate(() => {
        const imgElements = document.querySelectorAll('img');
        return Array.from(imgElements)
          .map((img: any) => img.src || img.getAttribute('data-src'))
          .filter(src => src && !src.startsWith('data:'))
          .map(src => src ? (src.startsWith('http') ? src : new URL(src, window.location.href).href) : '')
          .filter(src => src !== '');
      });

      // Extract internal links
      const links = await this.extractInternalLinks(page, url);

      return {
        url,
        title: title || '',
        content: this.cleanText(content),
        html: html,
        images: images.filter((img): img is string => img !== null),
        links: links,
        timestamp: new Date().toISOString(),
        depth
      };

    } catch (error) {
      console.error(`Error extracting data from ${url}:`, error);
      return {
        url,
        title: '',
        content: '',
        html: '',
        images: [],
        links: [],
        timestamp: new Date().toISOString(),
        depth
      };
    }
  }

  private async extractInternalLinks(page: Page, baseUrl: string): Promise<string[]> {
    try {
      const links = await page.evaluate((base) => {
        const baseUrl = new URL(base);
        const linkElements = document.querySelectorAll('a[href]');
        
        return Array.from(linkElements)
          .map(link => {
            const href = (link as any).getAttribute('href');
            if (!href) return null;
            
            try {
              const url = new URL(href, base);
              // Only include internal links
              if (url.hostname === baseUrl.hostname) {
                return url.href;
              }
            } catch {
              // Invalid URL, skip
            }
            return null;
          })
          .filter((url): url is string => url !== null);
      }, baseUrl);

      // Filter out common non-content pages
      const filteredLinks = links.filter(link => {
        const url = new URL(link);
        const pathname = url.pathname.toLowerCase();
        
        // Skip common non-content paths
        const skipPatterns = [
          '/admin', '/login', '/register', '/cart', '/checkout',
          '/search', '/tag/', '/category/', '/author/',
          '.pdf', '.doc', '.docx', '.zip', '.rar',
          'mailto:', 'tel:', 'javascript:'
        ];
        
        return !skipPatterns.some(pattern => pathname.includes(pattern));
      });

      return [...new Set(filteredLinks)]; // Remove duplicates

    } catch (error) {
      console.error('Error extracting links:', error);
      return [];
    }
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Getter for crawled pages
  getCrawledPages(): CrawledPage[] {
    return this.crawledPages;
  }

  // Getter for visited URLs
  getVisitedUrls(): string[] {
    return Array.from(this.visitedUrls);
  }
}
