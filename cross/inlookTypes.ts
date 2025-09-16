// Frontend types for Inlook scraper (mirror of backend types)
export interface InlookOffice {
  // Basic Information
  name: string;
  website: string;
  description?: string;
  
  // Contact Information
  address?: string;
  phone?: string;
  email?: string;
  
  // Company Details
  foundedYear?: number;
  companySize?: string;
  headquarters?: string;
  
  // Key Architects
  keyArchitects?: string[];
  specialties?: string[];
  
  // Project Information
  projects?: Project[];
  projectTypes?: string[];
  projectScales?: string[];
  geographicFocus?: string[];
  
  // Certifications
  certifications?: string[];
  awards?: Award[];
  
  // Media & Recognition
  publications?: Publication[];
  exhibitions?: Exhibition[];
  press?: PressMention[];
  
  // Design Approach
  designApproach?: string[];
  
  // Metadata
  scrapedAt: string;
  dataQuality: 'high' | 'medium' | 'low';
  extractionMethod: 'claude-3.5-sonnet';
  sourceUrl: string;
}

export interface TeamMember {
  name: string;
  role?: string;
}

export interface Project {
  name: string;
  type: string; // residential, commercial, institutional, etc.
  status: 'completed' | 'in-progress' | 'planned';
  year?: number;
  location?: string;
  size?: string;
  images?: string[];
  awards?: string[];
  client?: string;
  budget?: string;
  sustainability?: string[];
  materials?: string[];
  designFeatures?: string[];
}

export interface Award {
  name: string;
  year?: number;
  category?: string;
  organization?: string;
  description?: string;
}

export interface Publication {
  title: string;
  year?: number;
  publisher?: string;
  type: 'article' | 'book' | 'magazine' | 'online';
  url?: string;
  description?: string;
}

export interface Exhibition {
  name: string;
  year?: number;
  location?: string;
  type: 'solo' | 'group' | 'competition';
  description?: string;
}

export interface PressMention {
  title: string;
  year?: number;
  source?: string;
  url?: string;
  description?: string;
}

export interface InlookConfig {
  websiteUrl: string;
  maxDepth?: number; // How deep to crawl the website
  includeImages?: boolean;
  includeProjects?: boolean;
  includeTeam?: boolean;
  includeAwards?: boolean;
  includePublications?: boolean;
  claudeApiKey?: string;
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  respectRobotsTxt?: boolean;
}

export interface InlookProgress {
  status: 'starting' | 'crawling' | 'analyzing' | 'extracting' | 'completed' | 'error';
  currentPage?: string;
  pagesCrawled: number;
  totalPages?: number;
  currentPhase: string;
  extractedData?: Partial<InlookOffice>;
  error?: string;
}

export interface InlookResult {
  office: InlookOffice;
  metadata: {
    crawlTime: number;
    pagesAnalyzed: number;
    dataExtracted: string[];
    confidence: number;
    errors: string[];
    totalTime?: number;
  };
}

export interface InlookState {
  isRunning: boolean;
  progress: InlookProgress | null;
  result: InlookResult | null;
  error: string | null;
  logs: string[];
}

// Translation API types
export interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}
