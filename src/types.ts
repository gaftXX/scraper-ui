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
}

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

export const ARCHITECTURE_SEARCH_TERMS = [
  "architecture firm"
]; 