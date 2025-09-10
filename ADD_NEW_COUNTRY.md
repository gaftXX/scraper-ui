# How to Add a New Country

This system is now designed to make adding new countries extremely easy. You only need to modify **ONE FILE** to add a new country.

## Quick Start

To add a new country, simply edit the `COUNTRIES` array in these files:
- `src/countries.ts`
- `scraper/src/app/countries.ts` 
- `scraper/scraper-backend/countries.ts`

## Example: Adding France

```typescript
export const COUNTRIES: Country[] = [
  // ... existing countries (Latvia, Spain)
  {
    id: 'france',
    name: 'France',
    defaultCity: 'Paris',
    cities: [
      {
        name: "Paris",
        nameEn: "Paris",
        searchTerms: ["Paris", "Paris, France", "Paris, France"]
      },
      {
        name: "Lyon",
        nameEn: "Lyon", 
        searchTerms: ["Lyon", "Lyon, France", "Lyon, France"]
      },
      {
        name: "Marseille",
        nameEn: "Marseille",
        searchTerms: ["Marseille", "Marseille, France", "Marseille, France"]
      }
    ]
  }
];
```

## That's It!

Once you add the country to the `COUNTRIES` array in all three files, the system will automatically:

✅ **Frontend**: Show the new country in system settings  
✅ **City Selection**: Display cities for the new country  
✅ **Scraping**: Use the correct cities and search terms  
✅ **Compendium**: Filter data by the new country  
✅ **Default Selection**: Set the default city when country is selected  

## File Locations

Update these three files with the same `COUNTRIES` array:

1. **Main Types**: `src/countries.ts`
2. **Frontend**: `scraper/src/app/countries.ts`
3. **Backend**: `scraper/scraper-backend/countries.ts`

## Country Object Structure

```typescript
interface Country {
  id: string;           // Unique identifier (e.g., 'france')
  name: string;         // Display name (e.g., 'France')
  defaultCity: string;  // Default city when country is selected
  cities: City[];       // Array of cities in this country
}

interface City {
  name: string;         // Local name (e.g., "Paris")
  nameEn: string;       // English name (e.g., "Paris")
  searchTerms: string[]; // Search terms for Google Maps
}
```

## Search Terms Best Practices

For each city, include search terms that work well with Google Maps:

```typescript
searchTerms: [
  "CityName",                    // Just the city name
  "CityName, CountryName",       // City with country
  "CityName, CountryName"        // Alternative format
]
```

## No More Manual Updates Required

The old system required updating multiple files manually. Now everything is centralized and automatic:

- ❌ **Old Way**: Update 6+ files manually
- ✅ **New Way**: Update 3 files with the same data

## Testing Your New Country

1. Add the country to all three `countries.ts` files
2. Restart the development server
3. Go to System Settings → Select your new country
4. Verify cities appear correctly
5. Test scraping with the new country

That's it! The system handles everything else automatically.
