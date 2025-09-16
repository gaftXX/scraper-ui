import { InlookWebScraper } from './webScraper';
import { ClaudeAnalyzer } from './claudeAnalyzer';
import { InlookConfig, InlookResult, InlookProgress, InlookOffice, CrawledPage } from './types';

export class InlookScraper {
  private webScraper: InlookWebScraper;
  private claudeAnalyzer: ClaudeAnalyzer;
  private config: InlookConfig;
  private onProgress?: (progress: InlookProgress) => void;

  constructor(config: InlookConfig, onProgress?: (progress: InlookProgress) => void) {
    this.config = config;
    this.onProgress = onProgress;
    this.webScraper = new InlookWebScraper(config);
    this.claudeAnalyzer = new ClaudeAnalyzer(config);
  }

  async scrape(): Promise<InlookResult> {
    const startTime = Date.now();
    let pagesAnalyzed = 0;
    let extractedData: Partial<InlookOffice> = {};
    const errors: string[] = [];

    try {
      // Initialize web scraper
      this.updateProgress({
        status: 'starting',
        pagesCrawled: 0,
        currentPhase: 'Initializing web scraper...'
      });

      await this.webScraper.initialize();

      // Crawl the website
      this.updateProgress({
        status: 'crawling',
        pagesCrawled: 0,
        currentPhase: 'Crawling website pages...'
      });

      const crawledPages = await this.webScraper.crawlWebsite();
      pagesAnalyzed = crawledPages.length;

      this.updateProgress({
        status: 'analyzing',
        pagesCrawled: pagesAnalyzed,
        currentPhase: 'Analyzing content with Claude 3.5 Sonnet...'
      });

      // Analyze with Claude
      const claudeAnalysis = await this.claudeAnalyzer.analyzeWebsite(crawledPages);
      extractedData = claudeAnalysis.extractedData;

      this.updateProgress({
        status: 'extracting',
        pagesCrawled: pagesAnalyzed,
        currentPhase: 'Extracting structured data...',
        extractedData: extractedData
      });

      // Create final office object
      const office = this.createInlookOffice(extractedData, crawledPages);

      this.updateProgress({
        status: 'completed',
        pagesCrawled: pagesAnalyzed,
        currentPhase: 'Analysis completed successfully'
      });

      const crawlTime = Date.now() - startTime;

      return {
        office,
        metadata: {
          crawlTime,
          pagesAnalyzed,
          dataExtracted: this.getDataExtractedFields(extractedData),
          confidence: claudeAnalysis.confidence,
          errors
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      this.updateProgress({
        status: 'error',
        pagesCrawled: pagesAnalyzed,
        currentPhase: 'Error occurred during scraping',
        error: errorMessage
      });

      throw new Error(`Inlook scraping failed: ${errorMessage}`);
    } finally {
      // Clean up
      try {
        await this.webScraper.close();
      } catch (error) {
        console.error('Error closing web scraper:', error);
      }
    }
  }

  private createInlookOffice(extractedData: Partial<InlookOffice>, crawledPages: CrawledPage[]): InlookOffice {
    const mainPage = crawledPages.find(p => p.depth === 0) || crawledPages[0];
    
    return {
      // Basic Information
      name: extractedData.name || this.extractNameFromUrl(this.config.websiteUrl),
      website: this.config.websiteUrl,
      description: extractedData.description || '',
      
      // Contact Information
      address: extractedData.address,
      phone: extractedData.phone,
      email: extractedData.email,
      
      // Company Details
      foundedYear: extractedData.foundedYear,
      companySize: extractedData.companySize,
      headquarters: extractedData.headquarters,
      
      // Key Architects
      keyArchitects: extractedData.keyArchitects || [],
      specialties: extractedData.specialties || [],
      
      // Project Information
      projects: extractedData.projects || [],
      projectTypes: extractedData.projectTypes || [],
      projectScales: extractedData.projectScales || [],
      geographicFocus: extractedData.geographicFocus || [],
      
      // Certifications
      certifications: extractedData.certifications || [],
      awards: extractedData.awards || [],
      
      // Media & Recognition
      publications: extractedData.publications || [],
      exhibitions: extractedData.exhibitions || [],
      press: extractedData.press || [],
      
      // Design Approach
      designApproach: extractedData.designApproach || [],
      
      // Metadata
      scrapedAt: new Date().toISOString(),
      dataQuality: this.determineDataQuality(extractedData),
      extractionMethod: 'claude-3.5-sonnet',
      sourceUrl: this.config.websiteUrl
    };
  }

  private extractNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      // Remove common prefixes and suffixes
      let name = hostname
        .replace(/^www\./, '')
        .replace(/\.(com|org|net|co\.uk|de|fr|es|it)$/, '')
        .replace(/[-_]/g, ' ')
        .split('.')[0];
      
      // Capitalize words
      name = name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      return name || 'Unknown Architecture Firm';
    } catch {
      return 'Unknown Architecture Firm';
    }
  }

  private determineDataQuality(data: Partial<InlookOffice>): 'high' | 'medium' | 'low' {
    let score = 0;
    const maxScore = 10;

    // Basic information
    if (data.name) score += 1;
    if (data.description) score += 1;
    if ((data as any).contact && (data.phone || data.email)) score += 1;

    // Key architects
    if (data.keyArchitects && data.keyArchitects.length > 0) score += 1;

    // Project information
    if (data.projects && data.projects.length > 0) score += 1;
    if (data.projectTypes && data.projectTypes.length > 0) score += 1;

    // Certifications
    if (data.certifications && data.certifications.length > 0) score += 1;

    // Recognition
    if (data.awards && data.awards.length > 0) score += 1;

    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  private getDataExtractedFields(data: Partial<InlookOffice>): string[] {
    const fields: string[] = [];

    if (data.name) fields.push('Company Name');
    if (data.description) fields.push('Description');
    if (data.address) fields.push('Address');
    if (data.phone) fields.push('Phone');
    if (data.email) fields.push('Email');
    if (data.projects && data.projects.length > 0) fields.push('Projects');
    if (data.awards && data.awards.length > 0) fields.push('Awards');
    if (data.publications && data.publications.length > 0) fields.push('Publications');

    return fields;
  }

  private updateProgress(progress: InlookProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  // Getter methods for accessing scraper components
  getWebScraper(): InlookWebScraper {
    return this.webScraper;
  }

  getClaudeAnalyzer(): ClaudeAnalyzer {
    return this.claudeAnalyzer;
  }

  // Method to get crawled pages (for debugging)
  getCrawledPages(): CrawledPage[] {
    return this.webScraper.getCrawledPages();
  }
}
