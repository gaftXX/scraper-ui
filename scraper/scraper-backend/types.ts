export interface ArchitectureOffice {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  description?: string;

  placeId?: string;
  city?: string; // Added to track which city the office belongs to
  category?: string; // Added to track which category the office belongs to
  existedInDatabase?: boolean; // Added to track if office was already in database
  businessLabels?: string[]; // Added to track Google Maps business labels for validation
  uniqueId?: string; // Added for Spanish offices (B---S format)
}

// **PROGRESS TRACKING**
export interface ProgressUpdate {
  currentCity: string;
  cityIndex: number;
  totalCities: number;
  currentTerms: string[]; // Array of current search terms being processed
  currentBatch: number;
  totalBatches: number;
  termIndex: number;
  totalTerms: number;
  officesFound: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  phase: 'starting' | 'processing' | 'extracting' | 'saving' | 'completed';
}

export type ProgressCallback = (progress: ProgressUpdate) => void;

export type Country = 'latvia' | 'spain';

export interface ScraperConfig {
  headless?: boolean;
  maxResults?: number;
  delayBetweenRequests?: number;
  timeout?: number;
  outputFormat?: 'json' | 'csv' | 'firestore';
  outputFile?: string;
  cities?: string[];
  country?: Country; // Selected country
  searchRadius?: number;
  humanBehavior?: boolean; // Enable human-like behavior simulation
  stealthMode?: boolean;  // Enable stealth features to avoid detection
  // **NEW CATEGORY FILTERS**
  searchCategories?: SearchCategory[]; // Which categories to search
  firebaseConfig?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    databaseURL?: string;
  };
  // **PROGRESS CALLBACK**
  onProgress?: ProgressCallback; // Callback for progress updates
}

// **SEARCH CATEGORIES**
export type SearchCategory = 'architecture-only' | 'construction' | 'interior-design' | 'property-development';

// **TERM EFFECTIVENESS TRACKING**
export interface TermEffectiveness {
  term: string;
  category: SearchCategory;
  basePriority: 'high' | 'medium' | 'low';
  effectivenessScore: number; // 0-100, higher = more effective
  averageResultsFound: number;
  successRate: number; // 0-1, percentage of searches that found results
  searchCount: number;
  lastUsed: Date;
}

export interface TermPerformanceMetrics {
  totalSearches: number;
  totalResultsFound: number;
  averageTimeToFirstResult: number;
  categories: Map<SearchCategory, number>; // results per category
}

export interface CategoryConfig {
  id: SearchCategory;
  name: string;
  description: string;
  terms: string[];
  priority: 'high' | 'medium' | 'low';
}

// **COUNTRY-SPECIFIC SEARCH TERMS**
const LATVIAN_ARCHITECTURE_TERMS = [
  "architecture firm",
  "architect",
  "architecture office"
];

const SPANISH_ARCHITECTURE_TERMS = [
  "estudio de arquitectura",
  "arquitecto",
  "arquitectura",
  "estudio arquitectura",
  "arquitecto barcelona",
  "estudio arquitectura barcelona"
];

// **CATEGORIZED SEARCH TERMS**
export const SEARCH_CATEGORIES: CategoryConfig[] = [
  {
    id: 'architecture-only',
    name: 'Pure Architecture',
    description: 'Architecture firms and studios only',
    priority: 'high',
    terms: [
      // Default to English terms (will be overridden by country-specific function)
      "architecture firm",
      "architect",
      "architecture office"
    ]
  },
  {
    id: 'construction',
    name: 'Construction',
    description: 'Construction companies and building services',
    priority: 'high',
    terms: [
      // Focus on the most effective term that matches Google Maps business labeling
      "construction company"
    ]
  },
  {
    id: 'interior-design',
    name: 'Interior Design',
    description: 'Interior design services and specialists',
    priority: 'high',
    terms: [
      // Focus on the most effective term that matches Google Maps business labeling
      "interior designer"
    ]
  },
  {
    id: 'property-development',
    name: 'Property Development',
    description: 'Real estate developers and property development companies',
    priority: 'high',
    terms: [
      // Focus on the most effective term that matches Google Maps business labeling
      "property developer"
    ]
  }
];

// **GET COUNTRY-SPECIFIC SEARCH TERMS**
export function getCountrySpecificSearchTerms(categoryId: SearchCategory, country: string): string[] {
  if (categoryId === 'architecture-only') {
    if (country === 'spain') {
      return SPANISH_ARCHITECTURE_TERMS;
    } else {
      // Default to Latvia (English terms)
      return LATVIAN_ARCHITECTURE_TERMS;
    }
  }
  
  // For other categories, use the default terms from SEARCH_CATEGORIES
  const category = SEARCH_CATEGORIES.find(c => c.id === categoryId);
  return category ? category.terms : [];
}

// **GENERATE SEARCH TERMS BASED ON SELECTED CATEGORIES AND COUNTRY**
export function getSearchTermsForCategories(
  categories: SearchCategory[], 
  useRandomSelection: boolean = false,
  randomCount: number = 1,
  country: string = 'latvia'
): string[] {
  if (!categories || categories.length === 0) {
    // Default to architecture-only if no categories selected
    categories = ['architecture-only'];
  }
  
  const terms: string[] = [];
  
  categories.forEach(categoryId => {
    // Get country-specific terms
    const countrySpecificTerms = getCountrySpecificSearchTerms(categoryId, country);
    
    if (countrySpecificTerms.length > 0) {
      if (useRandomSelection) {
        // **ALWAYS USE ONLY ONE RANDOMLY SELECTED TERM**
        const shuffled = [...countrySpecificTerms].sort(() => 0.5 - Math.random());
        const selectedTerm = shuffled[0]; // Always take only the first (random) term
        terms.push(selectedTerm);
        
        console.log(`${categoryId} (${country}): Using 1 randomly selected term: "${selectedTerm}"`);
      } else {
        // **USE ONLY ONE RANDOMLY SELECTED TERM (EVEN WHEN NOT EXPLICITLY RANDOM)**
        const shuffled = [...countrySpecificTerms].sort(() => 0.5 - Math.random());
        const selectedTerm = shuffled[0]; // Always take only the first (random) term
        terms.push(selectedTerm);
        
        console.log(`${categoryId} (${country}): Using 1 randomly selected term: "${selectedTerm}"`);
      }
    }
  });
  
  return [...new Set(terms)]; // Remove duplicates
}

// **LEGACY CONSTANT FOR BACKWARD COMPATIBILITY** 
export const ARCHITECTURE_SEARCH_TERMS = getSearchTermsForCategories(['architecture-only', 'construction', 'interior-design', 'property-development']);

export interface SearchResult {
  offices: ArchitectureOffice[];
  totalFound: number;
  searchQuery: string;
  category?: SearchCategory; // Add explicit category tracking
  city: string;
  timestamp: string;
}

export interface City {
  name: string;
  nameEn: string;
  searchTerms: string[];
}

// Legacy alias for backward compatibility
export type LatvianCity = City;

export const LATVIAN_CITIES: LatvianCity[] = [
  {
    name: "Rīga",
    nameEn: "Riga",
    searchTerms: ["Rīga", "Riga", "Rīga, Latvija", "Riga, Latvia"]
  },
  {
    name: "Daugavpils",
    nameEn: "Daugavpils",
    searchTerms: ["Daugavpils", "Daugavpils, Latvija", "Daugavpils, Latvia"]
  },
  {
    name: "Liepāja",
    nameEn: "Liepaja",
    searchTerms: ["Liepāja", "Liepaja", "Liepāja, Latvija", "Liepaja, Latvia"]
  },
  {
    name: "Jelgava",
    nameEn: "Jelgava",
    searchTerms: ["Jelgava", "Jelgava, Latvija", "Jelgava, Latvia"]
  },
  {
    name: "Jūrmala",
    nameEn: "Jurmala",
    searchTerms: ["Jūrmala", "Jurmala", "Jūrmala, Latvija", "Jurmala, Latvia"]
  },
  {
    name: "Ventspils",
    nameEn: "Ventspils",
    searchTerms: ["Ventspils", "Ventspils, Latvija", "Ventspils, Latvia"]
  },
  {
    name: "Rēzekne",
    nameEn: "Rezekne",
    searchTerms: ["Rēzekne", "Rezekne", "Rēzekne, Latvija", "Rezekne, Latvia"]
  },
  {
    name: "Valmiera",
    nameEn: "Valmiera",
    searchTerms: ["Valmiera", "Valmiera, Latvija", "Valmiera, Latvia"]
  },
  {
    name: "Jēkabpils",
    nameEn: "Jekabpils",
    searchTerms: ["Jēkabpils", "Jekabpils", "Jēkabpils, Latvija", "Jekabpils, Latvia"]
  },
  {
    name: "Cēsis",
    nameEn: "Cesis",
    searchTerms: ["Cēsis", "Cesis", "Cēsis, Latvija", "Cesis, Latvia"]
  }
];

export const SPANISH_CITIES: LatvianCity[] = [
  {
    name: "Barcelona",
    nameEn: "Barcelona",
    searchTerms: ["Barcelona", "Barcelona, España", "Barcelona, Spain"]
  }
]; 

export interface ScrapingTiming {
  intensity: number;
  maxResults: number;
  searchRadius: number;
  completionTime: number;
  citiesScraped: number;
  categoriesScraped: number;
  officesFound: number;
  timestamp: Date;
  categories: SearchCategory[]; // Add categories field
  categoryKey: string; // Add categoryKey for unique identification
} 