import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { ArchitectureOffice, SearchResult } from '../types';
import { FirebaseService } from '../services/firebaseService';

export class DataOutput {
  private outputDir?: string;
  private firebaseService?: FirebaseService;

  constructor(outputDir?: string, firebaseService?: FirebaseService) {
    this.outputDir = outputDir;
    this.firebaseService = firebaseService;
    if (this.outputDir) {
      this.ensureOutputDirectory();
    }
  }

  private ensureOutputDirectory(): void {
    if (this.outputDir && !fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async saveToJson(results: SearchResult[], filename: string = 'architecture_offices'): Promise<void> {
    if (!this.outputDir) {
      console.log('No output directory configured - skipping local JSON save');
      return;
    }

    const filePath = path.join(this.outputDir, `${filename}.json`);
    
    const output = {
      metadata: {
        scrapedAt: new Date().toISOString(),
        totalCities: results.length,
        totalOffices: results.reduce((sum, result) => sum + result.offices.length, 0)
      },
      results: results.map(result => ({
        city: result.city,
        searchQuery: result.searchQuery,
        timestamp: result.timestamp,
        totalFound: result.totalFound,
        offices: result.offices
      }))
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
    console.log(`JSON data saved to: ${filePath}`);
  }

  async saveToCsv(results: SearchResult[], filename: string = 'architecture_offices'): Promise<void> {
    if (!this.outputDir) {
      console.log('No output directory configured - skipping local CSV save');
      return;
    }

    const filePath = path.join(this.outputDir, `${filename}.csv`);
    
    // Flatten all offices from all cities
    const allOffices: (ArchitectureOffice & { city: string })[] = [];
    
    results.forEach(result => {
      result.offices.forEach(office => {
        allOffices.push({
          ...office,
          city: result.city
        });
      });
    });

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'city', title: 'City' },
        { id: 'name', title: 'Name' },
        { id: 'address', title: 'Address' },
        { id: 'phone', title: 'Phone' },
        { id: 'website', title: 'Website' },
        { id: 'email', title: 'Email' },
        { id: 'rating', title: 'Rating' },
        { id: 'reviews', title: 'Reviews' },
        { id: 'hours', title: 'Hours' },
        { id: 'description', title: 'Description' },


      ]
    });

    const csvData = allOffices;

    await csvWriter.writeRecords(csvData);
    console.log(`CSV data saved to: ${filePath}`);
  }

  async saveToFirestore(results: SearchResult[], country?: string): Promise<void> {
    if (!this.firebaseService) {
      console.log('No Firebase service configured - skipping Firestore save');
      return;
    }

    console.log('Saving results to Firestore...');
    
    for (const result of results) {
      await this.firebaseService.saveSearchResult(result, undefined, country);
    }
    
    console.log('Results saved to Firestore successfully');
  }

  async saveToFile(results: SearchResult[], format: 'json' | 'csv' | 'firestore', filename: string, country?: string): Promise<void> {
    switch (format) {
      case 'json':
        await this.saveToJson(results, filename);
        break;
      case 'csv':
        await this.saveToCsv(results, filename);
        break;
      case 'firestore':
        await this.saveToFirestore(results, country);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  generateSummary(results: SearchResult[]): string {
    const totalOffices = results.reduce((sum, result) => sum + result.offices.length, 0);
    const totalCities = results.length;
    
    let summary = `\n🏢 ARCHITECTURE OFFICES SCRAPING SUMMARY\n`;
    summary += `${'='.repeat(50)}\n\n`;
    summary += `📊 Total Cities Scraped: ${totalCities}\n`;
    summary += `🏢 Total Offices Found: ${totalOffices}\n\n`;
    
    summary += `📍 Results by City:\n`;
    results.forEach(result => {
      summary += `   • ${result.city}: ${result.offices.length} offices\n`;
    });
    
    summary += `\n⏰ Scraping completed at: ${new Date().toISOString()}\n`;
    summary += `${'='.repeat(50)}\n`;
    
    return summary;
  }

  async saveSummary(results: SearchResult[], filename: string = 'scraping_summary'): Promise<void> {
    if (!this.outputDir) {
      console.log('No output directory configured - skipping local summary save');
      return;
    }

    const summary = this.generateSummary(results);
    const filePath = path.join(this.outputDir, `${filename}.txt`);
    
    fs.writeFileSync(filePath, summary);
    console.log(`Summary saved to: ${filePath}`);
  }
} 