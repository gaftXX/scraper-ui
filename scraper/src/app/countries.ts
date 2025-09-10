export interface City {
  name: string;
  nameEn: string;
  searchTerms: string[];
}

export interface Country {
  id: string;
  name: string;
  cities: City[];
  defaultCity: string;
}

// Centralized country configuration
export const COUNTRIES: Country[] = [
  {
    id: 'latvia',
    name: 'Latvia',
    defaultCity: 'Rīga',
    cities: [
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
    ]
  },
  {
    id: 'spain',
    name: 'Spain',
    defaultCity: 'Barcelona',
    cities: [
      {
        name: "Barcelona",
        nameEn: "Barcelona",
        searchTerms: ["Barcelona", "Barcelona, España", "Barcelona, Spain"]
      }
    ]
  }
];

// Helper functions
export function getCountryById(countryId: string): Country | undefined {
  return COUNTRIES.find(country => country.id === countryId);
}

export function getCityByCountryAndName(countryId: string, cityName: string): City | undefined {
  const country = getCountryById(countryId);
  if (!country) return undefined;
  
  return country.cities.find(city => 
    city.name === cityName || city.nameEn === cityName
  );
}

export function getCitiesByCountry(countryId: string): City[] {
  const country = getCountryById(countryId);
  return country ? country.cities : [];
}

export function getDefaultCityByCountry(countryId: string): string {
  const country = getCountryById(countryId);
  return country ? country.defaultCity : '';
}

export function getAllCountryIds(): string[] {
  return COUNTRIES.map(country => country.id);
}

export function getAllCountryNames(): string[] {
  return COUNTRIES.map(country => country.name);
}

// Legacy compatibility - for backward compatibility with existing code
export const LATVIAN_CITIES = getCitiesByCountry('latvia');
export const SPANISH_CITIES = getCitiesByCountry('spain');
