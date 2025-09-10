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
  humanBehavior?: boolean; // Enable human-like behavior simulation
  stealthMode?: boolean;  // Enable stealth features to avoid detection
  firebaseConfig?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
    databaseURL?: string;
  };
}

export interface SearchResult {
  offices: ArchitectureOffice[];
  totalFound: number;
  searchQuery: string;
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
export function getCountrySpecificSearchTerms(country: string): string[] {
  if (country === 'spain') {
    return SPANISH_ARCHITECTURE_TERMS;
  } else {
    // Default to Latvia (English terms)
    return LATVIAN_ARCHITECTURE_TERMS;
  }
}

export const ARCHITECTURE_SEARCH_TERMS = LATVIAN_ARCHITECTURE_TERMS; // Default to Latvian terms for backward compatibility 