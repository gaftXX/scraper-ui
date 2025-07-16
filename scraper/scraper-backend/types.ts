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

export interface ScraperConfig {
  headless?: boolean;
  maxResults?: number;
  delayBetweenRequests?: number;
  timeout?: number;
  outputFormat?: 'json' | 'csv' | 'firestore';
  outputFile?: string;
  cities?: string[];
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

// **CATEGORIZED SEARCH TERMS**
export const SEARCH_CATEGORIES: CategoryConfig[] = [
  {
    id: 'architecture-only',
    name: 'Pure Architecture',
    description: 'Architecture firms and studios only',
    priority: 'high',
    terms: [
      // Only use "architecture firm" to match Google Maps business labeling
      "architecture firm"
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

// **GENERATE SEARCH TERMS BASED ON SELECTED CATEGORIES**
export function getSearchTermsForCategories(
  categories: SearchCategory[], 
  useRandomSelection: boolean = false,
  randomCount: number = 1
): string[] {
  if (!categories || categories.length === 0) {
    // Default to architecture-only if no categories selected
    categories = ['architecture-only'];
  }
  
  const terms: string[] = [];
  
  categories.forEach(categoryId => {
    const category = SEARCH_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      if (useRandomSelection) {
        // **SPECIAL HANDLING FOR FOCUSED CATEGORIES**
        if (categoryId === 'architecture-only') {
          // Only use "architecture firm" as it matches Google Maps business labeling
          const singleTerm = "architecture firm";
          terms.push(singleTerm);
          
          console.log(`Architecture-only: Using only "${singleTerm}" to match Google Maps business labeling`);
        } else if (categoryId === 'construction') {
          // Only use "construction company" as it matches Google Maps business labeling
          const singleTerm = "construction company";
          terms.push(singleTerm);
          
          console.log(`Construction: Using only "${singleTerm}" to match Google Maps business labeling`);
        } else if (categoryId === 'interior-design') {
          // Only use "interior designer" as it matches Google Maps business labeling
          const singleTerm = "interior designer";
          terms.push(singleTerm);
          
          console.log(`Interior Design: Using only "${singleTerm}" to match Google Maps business labeling`);
        } else if (categoryId === 'property-development') {
          // Only use "property developer" as it matches Google Maps business labeling
          const singleTerm = "property developer";
          terms.push(singleTerm);
          
          console.log(`Property Development: Using only "${singleTerm}" to match Google Maps business labeling`);
        } else {
          // **REGULAR RANDOM SELECTION FOR OTHER CATEGORIES**
          const shuffled = [...category.terms].sort(() => 0.5 - Math.random());
          const selectedTerms = shuffled.slice(0, Math.min(randomCount, category.terms.length));
          console.log(`🎲 Randomly selected ${selectedTerms.length} terms from ${category.name}: ${selectedTerms.join(', ')}`);
          terms.push(...selectedTerms);
        }
      } else {
        // **USE ALL TERMS**
        if (categoryId === 'architecture-only') {
          // Even when not using random selection, only use "architecture firm"
          terms.push("architecture firm");
        } else if (categoryId === 'construction') {
          // Even when not using random selection, only use "construction company"
          terms.push("construction company");
        } else if (categoryId === 'interior-design') {
          // Even when not using random selection, only use "interior designer"
          terms.push("interior designer");
        } else if (categoryId === 'property-development') {
          // Even when not using random selection, only use "property developer"
          terms.push("property developer");
        } else {
          terms.push(...category.terms);
        }
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

export interface LatvianCity {
  name: string;
  nameEn: string;
  searchTerms: string[];
}

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