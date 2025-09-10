'use client';

import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { ScraperConfig, SearchCategory, SEARCH_CATEGORIES, getSearchTermsForCategories } from './types';
import { getDefaultCityByCountry, getCitiesByCountry } from './countries';
import Section1 from './sections/Section1';
import Section2 from './sections/Section2';
import Section3 from './sections/Section3';

interface ScrapingProgress {
  currentCity: string;
  cityIndex: number;
  totalCities: number;
  currentTerms: string[];
  currentBatch: number;
  totalBatches: number;
  termIndex: number;
  totalTerms: number;
  officesFound: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  phase: 'starting' | 'processing' | 'extracting' | 'saving' | 'completed';
  error?: string;
  startTime?: number;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  estimatedTotalTime?: number;
}

interface ScrapingResults {
  totalOffices: number;
  totalCities: number;
  results: any[];
  summary: string;
}

// City lists are now handled by the centralized country configuration

export default function ScraperInterface() {
  const [config, setConfig] = useState<ScraperConfig>({
    headless: true,
    maxResults: 20, // Set to level 1 value
    delayBetweenRequests: 0,
    timeout: 45000,
    outputFormat: 'firestore',
    cities: [getDefaultCityByCountry('spain')], // Use default city for Spain
    country: 'spain', // Default to Spain
    searchRadius: 10, // Set to level 1 value
    humanBehavior: true,
    stealthMode: true,
    searchCategories: ['architecture-only'], // Default to pure architecture only
    firebaseConfig: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
      privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY || 'your-private-key',
      clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || 'your-client-email',
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    }
  });
  
  const [progress, setProgress] = useState<ScrapingProgress>({
    currentCity: '',
    cityIndex: 0,
    totalCities: 0,
    currentTerms: [],
    currentBatch: 0,
    totalBatches: 0,
    termIndex: 0,
    totalTerms: 0,
    officesFound: 0,
    status: 'idle',
    phase: 'starting',
    startTime: undefined,
    elapsedTime: 0
  });
  
  const [results, setResults] = useState<ScrapingResults | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [showCompendium, setShowCompendium] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [resetSection2Focus, setResetSection2Focus] = useState<number>(0);
  
  // Use a ref to store the latest config to avoid stale closure issues
  const configRef = useRef<ScraperConfig>(config);
  configRef.current = config;
  
  // Use a ref to store the latest autoScroll state to avoid stale closure issues
  const autoScrollRef = useRef<boolean>(autoScroll);
  autoScrollRef.current = autoScroll;

  // Timer effect to track scraping duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (progress.status === 'running' && progress.startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - progress.startTime!) / 1000);
        setProgress(prev => ({ ...prev, elapsedTime: elapsed }));
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [progress.status, progress.startTime]);

  // Keyboard shortcuts for terminal actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Jump to bottom (Ctrl+End or Cmd+End)
      if ((e.ctrlKey || e.metaKey) && e.key === 'End') {
        e.preventDefault();
        jumpToBottom();
      }
      
      // Copy logs (Ctrl+Shift+C or Cmd+Shift+C) - using Shift to avoid conflicts
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copyTerminalLogs();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [logs]); // Add logs as dependency so we have access to current logs

  // Prevent any automatic scraping on page load/refresh
  useEffect(() => {
    console.log('Page loaded - scraper is IDLE and waiting for user action');
    console.log('Auto-start prevention: Scraper will ONLY start when user clicks Start button');
    
    // Ensure status is idle on page load
    if (progress.status !== 'idle') {
      console.log('Resetting scraper status to idle on page load');
      setProgress(prev => ({ ...prev, status: 'idle' }));
    }
  }, []); // Empty dependency array = runs only once on mount

  // Close system UI when scraper starts running
  useEffect(() => {
    if (progress.status === 'running') {
      setShowSystem(false);
    }
  }, [progress.status]);

  // Debug useEffect to monitor config changes
  useEffect(() => {
    console.log('=== DEBUG: Config changed ===');
    console.log('Cities:', config.cities);
    console.log('Max Results:', config.maxResults);
    console.log('Search Radius:', config.searchRadius);
    console.log('Search Categories:', config.searchCategories);
    console.log('Intensity Level:', getIntensityLevel(config.maxResults || 20, config.searchRadius || 10));
    console.log('============================');
  }, [config]);

  // Update the useEffect for fetching estimated time
  useEffect(() => {
    const fetchEstimatedTime = async () => {
      if (config.maxResults && config.searchRadius && config.searchCategories?.length) {
        const intensity = getIntensityLevel(config.maxResults, config.searchRadius);
        try {
          const response = await fetch('/api/scrape/timing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              intensity,
              categories: config.searchCategories
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            setEstimatedTime(data.averageCompletionTime);
          }
        } catch (error) {
          console.error('Error fetching estimated time:', error);
        }
      }
    };

    fetchEstimatedTime();
  }, [config.maxResults, config.searchRadius, config.searchCategories]);

  const handleConfigChange = (field: keyof ScraperConfig, value: any) => {
    setConfig((prev: ScraperConfig) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCitySelection = (city: string, selected: boolean) => {
    console.log(`=== DEBUG: handleCitySelection called with city: ${city}, selected: ${selected} ===`);
    
    flushSync(() => {
      setConfig((prev: ScraperConfig) => {
        const newConfig = {
          ...prev,
          cities: selected 
            ? [city] // Only allow one city at a time
            : [] // If deselecting, clear all cities
        };
        console.log('=== DEBUG: New config after city change ===');
        console.log('New config:', newConfig);
        console.log('============================================');
        return newConfig;
      });
    });
  };

  const handleCategorySelection = (categoryId: SearchCategory, selected: boolean) => {
    console.log(`=== DEBUG: handleCategorySelection called with categoryId: ${categoryId}, selected: ${selected} ===`);
    
    flushSync(() => {
      setConfig((prev: ScraperConfig) => {
        const newConfig = {
          ...prev,
          searchCategories: selected 
            ? [...(prev.searchCategories || []), categoryId]
            : (prev.searchCategories || []).filter((c: SearchCategory) => c !== categoryId)
        };
        console.log('=== DEBUG: New config after category change ===');
        console.log('New config:', newConfig);
        console.log('===============================================');
        return newConfig;
      });
    });
  };

  const handleCountryChange = (country: 'latvia' | 'spain') => {
    console.log(`=== DEBUG: handleCountryChange called with country: ${country} ===`);
    
    flushSync(() => {
      setConfig((prev: ScraperConfig) => {
        const defaultCity = getDefaultCityByCountry(country);
        const newConfig = {
          ...prev,
          country: country,
          cities: defaultCity ? [defaultCity] : [] // Set default city for the country
        };
        console.log('=== DEBUG: New config after country change ===');
        console.log('New config:', newConfig);
        console.log('===============================================');
        return newConfig;
      });
    });
  };

  const handleCompendiumClick = () => {
    setShowCompendium(true);
    setShowSystem(false); // Close system when opening compendium
  };

  const resetCompendiumState = () => {
    setShowCompendium(false);
  };

  const handleSystemClick = () => {
    setShowSystem(true);
  };

  const resetSystemState = () => {
    setShowSystem(false);
  };

  // Helper function to get intensity level from current maxResults and searchRadius
  const getIntensityLevel = (maxResults: number, searchRadius: number): number => {
    // Map combinations back to intensity levels (results increased by 10, radius unchanged)
    if (maxResults === 20 && searchRadius === 10) return 1;
    if (maxResults === 30 && searchRadius === 20) return 2;
    if (maxResults === 40 && searchRadius === 30) return 3;
    if (maxResults === 50 && searchRadius === 40) return 4;
    if (maxResults === 70 && searchRadius === 50) return 5;
    
    // Default to level 2 if no exact match
    return 2;
  };

  // Helper function to handle intensity changes
  const handleIntensityChange = (intensity: number) => {
    console.log(`=== DEBUG: handleIntensityChange called with intensity: ${intensity} ===`);
    
    let maxResults: number;
    let searchRadius: number;
    
    switch (intensity) {
      case 1:
        maxResults = 20;  // +10 from original 10
        searchRadius = 10;
        break;
      case 2:
        maxResults = 30;  // +10 from original 20
        searchRadius = 20;
        break;
      case 3:
        maxResults = 40;  // +10 from original 30
        searchRadius = 30;
        break;
      case 4:
        maxResults = 50;  // +10 from original 40
        searchRadius = 40;
        break;
      case 5:
        maxResults = 70;  // Increased from 60 to 70 for higher intensity
        searchRadius = 50;
        break;
      default:
        maxResults = 30;  // +10 from original 20
        searchRadius = 20;
    }
    
    console.log(`Setting maxResults: ${maxResults}, searchRadius: ${searchRadius}`);
    
    flushSync(() => {
      setConfig((prev: ScraperConfig) => {
        const newConfig = {
          ...prev,
          maxResults,
          searchRadius
        };
        console.log('=== DEBUG: New config after intensity change ===');
        console.log('New config:', newConfig);
        console.log('===============================================');
        return newConfig;
      });
    });
  };

  // Calculate current search terms count based on selected categories
  const currentSearchTerms = getSearchTermsForCategories(config.searchCategories || []);

  const addLog = (message: string) => {
    setLogs((prev: string[]) => {
      const time = new Date().toLocaleTimeString().replace(/:/g, '');
      const newLogs = [...prev, `${time}: ${message}`];
      
      // Auto-scroll to bottom if auto-scroll is enabled
      // Use the ref to get the current autoScroll state
      if (autoScrollRef.current) {
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = document.getElementById('logs-container');
            if (container) {
              // Check the current autoScroll state again in case it changed
              if (autoScrollRef.current) {
                container.scrollTop = container.scrollHeight;
              }
            }
          }, 50); // Even shorter timeout for more responsive scrolling
        });
      }
      
      return newLogs;
    });
  };

  // Function to jump back to bottom
  const jumpToBottom = () => {
    const container = document.getElementById('logs-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };

  // Function to toggle auto-scroll
  const toggleAutoScroll = () => {
    setAutoScroll(prev => !prev);
  };



  // Function to reset Section2 focus state
  const triggerSection2FocusReset = () => {
    setResetSection2Focus(prev => prev + 1);
  };

  // Function to copy all terminal logs to clipboard
  const copyTerminalLogs = async () => {
    try {
      if (logs.length === 0) {
        alert('No logs to copy');
        return;
      }
      
      // Join all logs with newlines to create a single text string
      const allLogsText = logs.join('\n');
      
      // Copy to clipboard
      await navigator.clipboard.writeText(allLogsText);
      
      // Show success feedback
      const button = document.getElementById('copy-logs-button');
      if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = 'Copied!';
        button.classList.add('bg-green-600', 'hover:bg-green-700');
        button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
        
        setTimeout(() => {
          button.innerHTML = originalText;
          button.classList.remove('bg-green-600', 'hover:bg-green-700');
          button.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy logs:', error);
      alert('Failed to copy logs to clipboard');
    }
  };

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const startScraping = async () => {
    // EXPLICIT USER CONSENT CHECK - Never start without user interaction
    if (progress.status === 'running') {
      console.log('Scraper is already running, ignoring duplicate start request');
      return;
    }

    // Additional safety check - ensure we have cities selected
    if (!configRef.current.cities || configRef.current.cities.length === 0) {
      addLog('Cannot start scraper: No cities selected');
      alert('Please select at least one city before starting the scraper.');
      return;
    }

    // No delay needed since we're using flushSync for state updates

    // Debug: Log the current config state from ref
    console.log('=== DEBUG: Current config state from ref before scraping ===');
    console.log('Cities:', configRef.current.cities);
    console.log('Max Results:', configRef.current.maxResults);
    console.log('Search Radius:', configRef.current.searchRadius);
    console.log('Search Categories:', configRef.current.searchCategories);
    console.log('Intensity Level:', getIntensityLevel(configRef.current.maxResults || 20, configRef.current.searchRadius || 10));
    console.log('==========================================================');

    // Start the actual scraping with the latest config from ref
    startScrapingWithConfig(configRef.current);
  };

  const startScrapingWithConfig = async (scrapingConfig: ScraperConfig) => {
    // Get intensity level name for display
    const intensityLevel = getIntensityLevel(scrapingConfig.maxResults || 20, scrapingConfig.searchRadius || 10);
    const getIntensityName = (level: number): string => {
      switch (level) {
        case 1: return "LIGHT";
        case 2: return "MEDIUM";
        case 3: return "NORMAL";
        case 4: return "HEAVY";
        case 5: return "INTENSE";
        default: return "MEDIUM";
      }
    };

    // Log current config being sent to scraper
    console.log('User started scraper');
    console.log('Current config being sent to scraper:', scrapingConfig);
    addLog('User started scraper');
    addLog(`Config: ${scrapingConfig.cities?.length || 0} cities, ${scrapingConfig.searchCategories?.length || 0} categories, ${scrapingConfig.maxResults} max results, ${scrapingConfig.searchRadius}km radius`);
    
    // Reset Section2 focus state
    triggerSection2FocusReset();
    
    const startTime = Date.now();
    setProgress((prev: ScrapingProgress) => ({ 
      ...prev, 
      status: 'running', 
      startTime: startTime,
      elapsedTime: 0
    }));
    setResults(null);
    setLogs([]);
    
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scrapingConfig)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setProgress(prev => ({ ...prev, ...data.progress }));
              } else if (data.type === 'log') {
                addLog(data.message);
              } else if (data.type === 'complete') {
                setResults(data.results);
                setProgress((prev: ScrapingProgress) => ({ ...prev, status: 'completed' }));
              } else if (data.type === 'error') {
                setProgress((prev: ScrapingProgress) => ({ ...prev, status: 'error', error: data.error }));
              }
            } catch (e) {
              // Skip invalid JSON
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
      
    } catch (error) {
      setProgress((prev: ScrapingProgress) => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };

  return (
    <div className="h-screen text-white overflow-hidden">
      {/* Custom CSS for slider and typography */}
      <style jsx global>{`
        body, html {
          overflow: hidden;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 14px;
        }
        
        * {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 14px;
        }
        
        input, button, select, textarea {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 14px;
        }
        
        h1, h2, h3, h4, h5, h6, p, span, div, label {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
          text-transform: uppercase;
          font-weight: 600;
          font-size: 14px;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-moz-range-thumb:hover {
          background: #2563eb;
          transform: scale(1.1);
        }
      `}</style>
      
      {/* Main Content Grid - Three Horizontal Sections */}
      <div className="flex h-full w-full">
        {/* Section 1: Progress & Results - 49% width - ALWAYS LEFT */}
        <div style={{ width: '49%' }}>
          <Section1 
            progress={progress}
            results={results}
            logs={logs}
            estimatedTime={estimatedTime}
            config={config}
            formatElapsedTime={formatElapsedTime}
            jumpToBottom={jumpToBottom}
            copyTerminalLogs={copyTerminalLogs}
            currentSearchTerms={currentSearchTerms}
            autoScroll={autoScroll}
            toggleAutoScroll={toggleAutoScroll}
            showSystem={showSystem}
            resetSystemState={resetSystemState}
            handleCountryChange={handleCountryChange}
          />
        </div>

        {/* Section 2: Configuration Panel - 2% width - ALWAYS CENTER */}
        <div style={{ width: '2%' }}>
          <Section2 
            config={config}
            progress={progress}
            currentSearchTerms={currentSearchTerms}
            getIntensityLevel={getIntensityLevel}
            handleIntensityChange={handleIntensityChange}
            handleCategorySelection={handleCategorySelection}
            handleCitySelection={handleCitySelection}
            startScraping={startScraping}
            results={results}
            logs={logs}
            onCompendiumClick={handleCompendiumClick}
            onSystemClick={handleSystemClick}
            resetFocusTrigger={resetSection2Focus}
          />
        </div>

        {/* Section 3: Future Content - 49% width - ALWAYS RIGHT */}
        <div style={{ width: '49%' }}>
          <Section3 
            showCompendium={showCompendium}
            results={results}
            formatElapsedTime={formatElapsedTime}
            progress={progress}
            resetCompendiumState={resetCompendiumState}
            config={config}
          />
        </div>
      </div>
    </div>
  );
}
