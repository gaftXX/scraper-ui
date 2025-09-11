import { InlookOffice, CrawledPage, ClaudeAnalysis, InlookConfig } from './types';

export class ClaudeAnalyzer {
  private apiKey: string;
  private config: InlookConfig;

  constructor(config: InlookConfig) {
    this.config = config;
    this.apiKey = config.claudeApiKey || process.env.CLAUDE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Claude API key is required. Set CLAUDE_API_KEY environment variable or pass it in config.');
    }
  }

  async analyzeWebsite(pages: CrawledPage[]): Promise<ClaudeAnalysis> {
    console.log(`Analyzing ${pages.length} pages with Claude 3.5 Sonnet...`);

    try {
      // Combine all page content for analysis
      const combinedContent = this.combinePageContent(pages);
      
      // Create the analysis prompt
      const prompt = this.createAnalysisPrompt(combinedContent, pages);
      
      // Call Claude API
      const response = await this.callClaudeAPI(prompt);
      
      // Parse the response
      const analysis = this.parseClaudeResponse(response);
      
      console.log('Claude analysis completed successfully');
      return analysis;
      
    } catch (error) {
      console.error('Error during Claude analysis:', error);
      throw new Error(`Claude analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private combinePageContent(pages: CrawledPage[]): string {
    let combined = '';
    
    // Prioritize main page content
    const mainPage = pages.find(p => p.depth === 0) || pages[0];
    if (mainPage) {
      combined += `=== MAIN PAGE (${mainPage.url}) ===\n`;
      combined += `Title: ${mainPage.title}\n\n`;
      combined += `Content: ${mainPage.content}\n\n`;
    }

    // Add other pages
    const otherPages = pages.filter(p => p.depth > 0);
    for (const page of otherPages) {
      combined += `=== PAGE: ${page.title} (${page.url}) ===\n`;
      combined += `Content: ${page.content}\n\n`;
    }

    return combined;
  }

  private createAnalysisPrompt(content: string, pages: CrawledPage[]): string {
    return `You are an expert architecture industry analyst. Analyze the following website content from an architecture firm and extract comprehensive information about the company.

WEBSITE CONTENT:
${content}

Please analyze this content and extract the following information in JSON format. Be thorough and accurate:

{
  "name": "Company name",
  "website": "Main website URL",
  "description": "Brief company description",
  "address": "Physical address if available",
  "phone": "Phone number if available", 
  "email": "Email address if available",
  "foundedYear": "Year founded if mentioned",
  "companySize": "Company size (e.g., 'Small', 'Medium', 'Large', 'Boutique')",
  "headquarters": "Headquarters location",
  "keyArchitects": ["Names of key architects"],
  "specialties": ["Company specialties and focus areas"],
  "projects": [
    {
      "name": "Project name",
      "type": "Project type (residential, commercial, institutional, etc.)",
      "status": "completed, in-progress, or planned",
      "year": "Project year",
      "location": "Project location",
      "size": "Project size or scale",
      "awards": ["Any awards received"],
      "client": "Client name if mentioned",
      "budget": "Budget range if mentioned",
      "sustainability": ["Sustainability features"],
      "materials": ["Materials used"],
      "designFeatures": ["Key design features"]
    }
  ],
  "projectTypes": ["Types of projects they work on"],
  "projectScales": ["Scales of projects (small, medium, large)"],
  "geographicFocus": ["Geographic areas they work in"],
  "certifications": ["Professional certifications"],
  "awards": [
    {
      "name": "Award name",
      "year": "Year received",
      "category": "Award category",
      "organization": "Awarding organization",
      "description": "Award description"
    }
  ],
  "publications": [
    {
      "title": "Publication title",
      "year": "Publication year",
      "publisher": "Publisher",
      "type": "article, book, magazine, or online",
      "url": "URL if available",
      "description": "Publication description"
    }
  ],
  "exhibitions": [
    {
      "name": "Exhibition name",
      "year": "Year",
      "location": "Location",
      "type": "solo, group, or competition",
      "description": "Exhibition description"
    }
  ],
  "press": [
    {
      "title": "Press mention title",
      "year": "Year",
      "source": "Source publication",
      "url": "URL if available",
      "description": "Description"
    }
  ],
  "designApproach": ["Design approaches and methodologies"]
}

IMPORTANT INSTRUCTIONS:
1. Only extract information that is explicitly mentioned in the content
2. If information is not available, use null or omit the field
3. Be accurate and don't make assumptions
4. For arrays, include all relevant items found
5. Focus on architecture-specific information
6. Extract project details comprehensively
7. Do NOT collect any team member information
8. Look for awards, publications, and recognition
9. Identify their geographic focus and project types
10. For project descriptions, avoid generic marketing language like "clean, modern, timeless, contemporary, innovative, cutting-edge" - focus on specific technical details, materials, or unique features

IMPORTANT: You MUST respond with ONLY valid JSON. Do not include any text before or after the JSON. Start your response with { and end with }.`;
  }

  private async callClaudeAPI(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude API');
      }

      return data.content[0].text;

    } catch (error) {
      console.error('Claude API call failed:', error);
      throw error;
    }
  }

  private parseClaudeResponse(response: string): ClaudeAnalysis {
    try {
      console.log('Raw Claude response:', response);
      
      // Try to parse the response directly first
      let extractedData;
      try {
        extractedData = JSON.parse(response);
      } catch (directParseError) {
        // If direct parsing fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in Claude response');
        }
        const jsonStr = jsonMatch[0];
        extractedData = JSON.parse(jsonStr);
      }

      // Validate and clean the extracted data
      const cleanedData = this.cleanExtractedData(extractedData);

      // Calculate confidence based on data completeness
      const confidence = this.calculateConfidence(cleanedData);

      // Determine data quality
      const dataQuality = this.determineDataQuality(confidence, cleanedData);

      // Identify missing data
      const missingData = this.identifyMissingData(cleanedData);

      // Generate suggestions
      const suggestions = this.generateSuggestions(cleanedData, missingData);

      return {
        extractedData: cleanedData,
        confidence,
        reasoning: `Analyzed ${this.config.websiteUrl} and extracted comprehensive architecture firm data`,
        dataQuality,
        missingData,
        suggestions
      };

    } catch (error) {
      console.error('Error parsing Claude response:', error);
      throw new Error(`Failed to parse Claude response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private cleanExtractedData(data: any): Partial<InlookOffice> {
    const cleaned: Partial<InlookOffice> = {};

    // Clean and validate each field
    if (data.name && typeof data.name === 'string') {
      cleaned.name = data.name.trim();
    }

    if (data.website && typeof data.website === 'string') {
      cleaned.website = data.website.trim();
    }

    if (data.description && typeof data.description === 'string') {
      cleaned.description = data.description.trim();
    }

    if (data.address && typeof data.address === 'string') {
      cleaned.address = data.address.trim();
    }

    if (data.phone && typeof data.phone === 'string') {
      cleaned.phone = data.phone.trim();
    }

    if (data.email && typeof data.email === 'string') {
      cleaned.email = data.email.trim();
    }

    if (data.foundedYear && typeof data.foundedYear === 'number') {
      cleaned.foundedYear = data.foundedYear;
    }

    if (data.companySize && typeof data.companySize === 'string') {
      cleaned.companySize = data.companySize.trim();
    }

    if (data.headquarters && typeof data.headquarters === 'string') {
      cleaned.headquarters = data.headquarters.trim();
    }



    if (Array.isArray(data.projects)) {
      cleaned.projects = data.projects.filter((project: any) => 
        project && typeof project.name === 'string' && project.name.trim()
      );
    }

    if (Array.isArray(data.awards)) {
      cleaned.awards = data.awards.filter((award: any) => 
        award && typeof award.name === 'string' && award.name.trim()
      );
    }

    if (Array.isArray(data.publications)) {
      cleaned.publications = data.publications.filter((pub: any) => 
        pub && typeof pub.title === 'string' && pub.title.trim()
      );
    }

    // Clean string arrays
    const stringArrayFields = [
      'keyArchitects', 'specialties', 'projectTypes', 'projectScales', 
      'geographicFocus', 'certifications',
      'designApproach'
    ];

    for (const field of stringArrayFields) {
      if (Array.isArray(data[field])) {
        (cleaned as any)[field] = data[field]
          .filter((item: any) => typeof item === 'string' && item.trim())
          .map((item: string) => item.trim());
      }
    }



    return cleaned;
  }


  private calculateConfidence(data: Partial<InlookOffice>): number {
    const fields = [
      'name', 'description', 'teamMembers', 'projects', 'services', 
      'expertise', 'awards', 'publications'
    ];

    let score = 0;
    let total = fields.length;

    for (const field of fields) {
      if (data[field as keyof InlookOffice]) {
        if (Array.isArray(data[field as keyof InlookOffice])) {
          if ((data[field as keyof InlookOffice] as any[]).length > 0) {
            score += 1;
          }
        } else {
          score += 1;
        }
      }
    }

    return Math.round((score / total) * 100);
  }

  private determineDataQuality(confidence: number, data: Partial<InlookOffice>): 'high' | 'medium' | 'low' {
    if (confidence >= 80 && data.projects && data.projects.length > 0) {
      return 'high';
    } else if (confidence >= 60) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private identifyMissingData(data: Partial<InlookOffice>): string[] {
    const missing: string[] = [];
    
    
    if (!data.projects || data.projects.length === 0) {
      missing.push('Project portfolio');
    }
    
    if (!data.awards || data.awards.length === 0) {
      missing.push('Awards and recognition');
    }

    return missing;
  }

  private generateSuggestions(data: Partial<InlookOffice>, missingData: string[]): string[] {
    const suggestions: string[] = [];
    
    if (missingData.includes('Team information')) {
      suggestions.push('Consider adding a team or about page to showcase key architects');
    }
    
    if (missingData.includes('Project portfolio')) {
      suggestions.push('Add a projects or portfolio section to showcase completed work');
    }
    
    if (missingData.includes('Services offered')) {
      suggestions.push('Create a services page listing all architectural services');
    }
    
    

    return suggestions;
  }
}
