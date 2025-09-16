// Main exports for Inlook scraper
export { InlookScraper } from './inlookScraper';
export { InlookWebScraper } from './webScraper';
export { ClaudeAnalyzer } from './claudeAnalyzer';

// Type exports
export type {
  InlookOffice,
  InlookConfig,
  InlookResult,
  InlookProgress,
  CrawledPage,
  ClaudeAnalysis,
  TeamMember,
  Project,
  Award,
  Publication,
  Exhibition,
  PressMention
} from './types';

// Import types for internal use
import type { InlookConfig, InlookProgress } from './types';
import { InlookScraper } from './inlookScraper';

// Utility function to create a new Inlook scraper instance
export function createInlookScraper(config: InlookConfig, onProgress?: (progress: InlookProgress) => void): InlookScraper {
  return new InlookScraper(config, onProgress);
}

// Default configuration
export const defaultInlookConfig: Partial<InlookConfig> = {
  maxDepth: 3,
  includeImages: true,
  includeProjects: true,
  includeTeam: true,
  includeAwards: true,
  includePublications: true,
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  followRedirects: true,
  respectRobotsTxt: true
};
