# Inlook AI Scraper

An AI-powered architecture office website scraper that uses Claude 3.5 Sonnet to extract comprehensive information from architecture firm websites.

## Features

- **AI-Powered Analysis**: Uses Claude 3.5 Sonnet to understand and extract structured data from websites
- **Comprehensive Data Extraction**: Extracts team information, project portfolios, awards, publications, and more
- **Intelligent Crawling**: Automatically crawls website pages to gather complete information
- **Rich Data Structure**: Extracts detailed information about projects, team members, company philosophy, and expertise
- **Real-time Progress**: Provides live updates during the scraping process

## What It Extracts

### Basic Information
- Company name and description
- Contact information (address, phone, email)
- Company details (founded year, size, headquarters)

### Team Information
- Team members with roles and biographies
- Key architects and their specializations
- Education and experience details

### Project Information
- Project portfolios with descriptions
- Project types, scales, and locations
- Awards and recognition
- Client information and budgets
- Sustainability features and materials

### Company Intelligence
- Design philosophy and approach
- Services offered and expertise areas
- Certifications and awards
- Publications and exhibitions
- Press mentions and recognition

### Technical Details
- Software and tools used
- Design approaches and methodologies
- Sustainability focus

## Setup

### Prerequisites
- Node.js 18+
- Claude API key from Anthropic

### Installation
```bash
cd inlook-backend
npm install
```

### Environment Variables
Set your Claude API key:
```bash
export CLAUDE_API_KEY="sk-ant-..."
```

## Usage

### Basic Usage
```typescript
import { InlookScraper } from './inlook-backend';

const config = {
  websiteUrl: 'https://example-architecture.com',
  claudeApiKey: 'sk-ant-...', // or set CLAUDE_API_KEY env var
  maxDepth: 3,
  includeProjects: true,
  includeTeam: true,
  includeAwards: true,
  includePublications: true
};

const scraper = new InlookScraper(config, (progress) => {
  console.log('Progress:', progress);
});

const result = await scraper.scrape();
console.log('Extracted office data:', result.office);
```

### Configuration Options

```typescript
interface InlookConfig {
  websiteUrl: string;           // Required: Website to scrape
  maxDepth?: number;           // How deep to crawl (default: 3)
  includeImages?: boolean;     // Include image URLs (default: true)
  includeProjects?: boolean;   // Extract project information (default: true)
  includeTeam?: boolean;       // Extract team information (default: true)
  includeAwards?: boolean;     // Extract awards (default: true)
  includePublications?: boolean; // Extract publications (default: true)
  claudeApiKey?: string;       // Claude API key (or use env var)
  timeout?: number;            // Request timeout in ms (default: 30000)
  userAgent?: string;          // Custom user agent
  followRedirects?: boolean;   // Follow redirects (default: true)
  respectRobotsTxt?: boolean;  // Respect robots.txt (default: true)
}
```

## API Endpoint

The scraper is accessible via the `/api/inlook` endpoint:

```javascript
const response = await fetch('/api/inlook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    websiteUrl: 'https://example-architecture.com',
    claudeApiKey: 'sk-ant-...',
    maxDepth: 3,
    includeProjects: true,
    includeTeam: true,
    includeAwards: true,
    includePublications: true
  }),
});

// Handle streaming response
const reader = response.body.getReader();
// ... handle streaming data
```

## Data Quality

The scraper provides data quality indicators:
- **High**: Comprehensive data with projects, team, and detailed information
- **Medium**: Good data coverage with some missing elements
- **Low**: Basic information only

## Architecture

### Components

1. **InlookWebScraper**: Handles website crawling and content extraction
2. **ClaudeAnalyzer**: Uses Claude 3.5 Sonnet for AI-powered content analysis
3. **InlookScraper**: Main orchestrator that coordinates the scraping process

### Process Flow

1. **Initialization**: Set up web scraper and Claude analyzer
2. **Crawling**: Navigate and extract content from website pages
3. **Analysis**: Use Claude 3.5 Sonnet to analyze and structure the content
4. **Extraction**: Parse AI response into structured data format
5. **Validation**: Clean and validate extracted data
6. **Results**: Return comprehensive office information

## Error Handling

The scraper includes comprehensive error handling:
- Network timeouts and connection issues
- Invalid website URLs
- Claude API errors
- Malformed content parsing
- Rate limiting and blocking

## Performance

- **Typical crawl time**: 30-60 seconds for a 3-level deep crawl
- **Pages analyzed**: Usually 5-15 pages depending on website structure
- **Data extraction**: 80-95% confidence for well-structured architecture websites

## Limitations

- Requires valid Claude API key
- Limited by website structure and content quality
- May not work with heavily JavaScript-dependent sites
- Rate limited by Claude API usage

## Examples

### Extracting from a Modern Architecture Firm
```typescript
const result = await scraper.scrape();
console.log(result.office.name); // "Foster + Partners"
console.log(result.office.projects.length); // 25
console.log(result.office.teamMembers.length); // 12
console.log(result.office.awards.length); // 8
```

### Handling Results
```typescript
const { office, metadata } = result;

console.log(`Data Quality: ${office.dataQuality}`);
console.log(`Confidence: ${metadata.confidence}%`);
console.log(`Pages Analyzed: ${metadata.pagesAnalyzed}`);
console.log(`Extraction Time: ${metadata.crawlTime}ms`);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
