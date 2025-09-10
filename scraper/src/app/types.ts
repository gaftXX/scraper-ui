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
  existedInDatabase?: boolean; // Added to track if office was already in database
  businessLabels?: string[]; // Added to track Google Maps business labels for validation
  uniqueId?: string; // Added for Spanish offices (B---S format)
}

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
  humanBehavior?: boolean;
  stealthMode?: boolean;
  // **NEW CATEGORY FILTERS**
  searchCategories?: SearchCategory[]; // Which categories to search
  firebaseConfig?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    databaseURL?: string;
  };
}

// **SEARCH CATEGORIES**
export type SearchCategory = 'architecture-only' | 'construction' | 'interior-design' | 'property-development';

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

// **CATEGORIZED SEARCH TERMS**
export const SEARCH_CATEGORIES: CategoryConfig[] = [
  {
    id: 'architecture-only',
    name: 'Pure Architecture',
    description: 'Architecture firms and studios only',
    priority: 'high',
    terms: [
      // Default to English terms (will be overridden by country-specific function)
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
        // **SPECIAL HANDLING FOR FOCUSED CATEGORIES**
        if (categoryId === 'architecture-only') {
          // Use country-specific architecture terms
          const shuffled = [...countrySpecificTerms].sort(() => 0.5 - Math.random());
          const selectedTerm = shuffled[0];
          terms.push(selectedTerm);
        } else if (categoryId === 'construction') {
          // Only use "construction company" as it matches Google Maps business labeling
          const singleTerm = "construction company";
          terms.push(singleTerm);
        } else if (categoryId === 'interior-design') {
          // Only use "interior designer" as it matches Google Maps business labeling
          const singleTerm = "interior designer";
          terms.push(singleTerm);
        } else if (categoryId === 'property-development') {
          // Only use "property developer" as it matches Google Maps business labeling
          const singleTerm = "property developer";
          terms.push(singleTerm);
        } else {
          // **REGULAR RANDOM SELECTION FOR OTHER CATEGORIES**
          const shuffled = [...countrySpecificTerms].sort(() => 0.5 - Math.random());
          const selectedTerms = shuffled.slice(0, Math.min(randomCount, countrySpecificTerms.length));
          terms.push(...selectedTerms);
        }
      } else {
        // **USE ALL TERMS**
        if (categoryId === 'architecture-only') {
          // Use country-specific architecture terms
          const shuffled = [...countrySpecificTerms].sort(() => 0.5 - Math.random());
          const selectedTerm = shuffled[0];
          terms.push(selectedTerm);
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
          terms.push(...countrySpecificTerms);
        }
      }
    }
  });
  
  return [...new Set(terms)]; // Remove duplicates
}

// **LEGACY CONSTANT FOR BACKWARD COMPATIBILITY** 
const ARCHITECTURE_SEARCH_TERMS = getSearchTermsForCategories(['architecture-only', 'construction', 'interior-design', 'property-development']);

export function getIntensityLevel(maxResults: number, searchRadius: number): number {
  // Map combinations back to intensity levels (results increased by 10, radius unchanged)
  if (maxResults === 20 && searchRadius === 10) return 1;
  if (maxResults === 30 && searchRadius === 20) return 2;
  if (maxResults === 40 && searchRadius === 30) return 3;
  if (maxResults === 50 && searchRadius === 40) return 4;
  if (maxResults === 70 && searchRadius === 50) return 5;
  
  // Default to level 2 if no exact match
  return 2;
}

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

interface ScrapingResults {
  totalOffices: number;
  totalCities: number;
  results: any[];
  summary: string;
  scrapedCities: string[]; // Store the cities that were actually scraped
} 