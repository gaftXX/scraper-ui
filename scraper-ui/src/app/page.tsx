'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ScraperConfig, SearchCategory, SEARCH_CATEGORIES, getSearchTermsForCategories } from './types';

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

const LATVIAN_CITIES = [
  'Rīga', 'Daugavpils', 'Liepāja', 'Jelgava', 'Jūrmala', 
  'Ventspils', 'Rēzekne', 'Valmiera', 'Jēkabpils', 'Cēsis'
];

export default function ScraperInterface() {
  const [config, setConfig] = useState<ScraperConfig>({
    headless: true,
    maxResults: 20,
    delayBetweenRequests: 0,
    timeout: 45000,
    outputFormat: 'firestore',
    cities: ['Rīga'],
    searchRadius: 20,
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
    console.log('📱 Page loaded - scraper is IDLE and waiting for user action');
    console.log('🛡️ Auto-start prevention: Scraper will ONLY start when user clicks Start button');
    
    // Ensure status is idle on page load
    if (progress.status !== 'idle') {
      console.log('🔧 Resetting scraper status to idle on page load');
      setProgress(prev => ({ ...prev, status: 'idle' }));
    }
  }, []); // Empty dependency array = runs only once on mount

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
    setConfig((prev: ScraperConfig) => ({
      ...prev,
      cities: selected 
        ? [...(prev.cities || []), city]
        : (prev.cities || []).filter((c: string) => c !== city)
    }));
  };

  const handleCategorySelection = (categoryId: SearchCategory, selected: boolean) => {
    setConfig((prev: ScraperConfig) => ({
      ...prev,
      searchCategories: selected 
        ? [...(prev.searchCategories || []), categoryId]
        : (prev.searchCategories || []).filter((c: SearchCategory) => c !== categoryId)
    }));
  };

  // Helper function to get intensity level from current maxResults and searchRadius
  const getIntensityLevel = (maxResults: number, searchRadius: number): number => {
    // Map combinations back to intensity levels (results increased by 10, radius unchanged)
    if (maxResults === 20 && searchRadius === 10) return 1;
    if (maxResults === 30 && searchRadius === 20) return 2;
    if (maxResults === 40 && searchRadius === 30) return 3;
    if (maxResults === 50 && searchRadius === 40) return 4;
    if (maxResults === 60 && searchRadius === 50) return 5;
    
    // Default to level 2 if no exact match
    return 2;
  };

  // Helper function to handle intensity changes
  const handleIntensityChange = (intensity: number) => {
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
        maxResults = 60;  // +10 from original 50
        searchRadius = 50;
        break;
      default:
        maxResults = 30;  // +10 from original 20
        searchRadius = 20;
    }
    
    setConfig((prev: ScraperConfig) => ({
      ...prev,
      maxResults,
      searchRadius
    }));
  };

  // Calculate current search terms count based on selected categories
  const currentSearchTerms = getSearchTermsForCategories(config.searchCategories || []);

  const addLog = (message: string) => {
    setLogs((prev: string[]) => {
      const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${message}`];
      
      // Auto-scroll only if user is currently at the bottom
      setTimeout(() => {
        const container = document.getElementById('logs-container');
        if (container) {
          const { scrollTop, scrollHeight, clientHeight } = container;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;
          
          // Only auto-scroll if user is at bottom - this allows new logs to appear 
          // without disturbing users who have scrolled up to view older logs
          if (isAtBottom) {
            container.scrollTop = container.scrollHeight;
          }
        }
      }, 100); // Shorter timeout for more responsive scrolling
      
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
        button.innerHTML = '<span>✅</span><span>Copied!</span>';
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
      console.log('⚠️ Scraper is already running, ignoring duplicate start request');
      return;
    }

    // Additional safety check - ensure we have cities selected
    if (!config.cities || config.cities.length === 0) {
      addLog('❌ Cannot start scraper: No cities selected');
      alert('Please select at least one city before starting the scraper.');
      return;
    }

    // Explicit confirmation dialog for user consent
    const confirmStart = window.confirm(
      `🚀 Start scraping ${config.cities.length} cities with ${config.searchCategories?.length || 0} categories?\n\n` +
      `Selected cities: ${config.cities.join(', ')}\n` +
      `Categories: ${config.searchCategories?.join(', ') || 'Default'}\n\n` +
      `Click OK to proceed or Cancel to abort.`
    );

    if (!confirmStart) {
      addLog('❌ Scraping cancelled by user');
      console.log('❌ User cancelled scraping via confirmation dialog');
      return;
    }

    // Log explicit user action
    console.log('✅ User explicitly confirmed and started scraper');
    addLog('👤 User confirmed and started scraper manually');
    
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
      addLog('🚀 Starting scraper...');
      
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Custom CSS for slider */}
      <style jsx>{`
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
      
      {/* Center everything in the page */}
      <div className="flex justify-center items-start min-h-screen py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Main Content Grid - Always Centered */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* Configuration Panel */}
            <div className="xl:col-span-1">
              <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-6 text-white">
                  ⚙️ Configuration
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Intensity
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={getIntensityLevel(config.maxResults || 20, config.searchRadius || 20)}
                      onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((getIntensityLevel(config.maxResults || 20, config.searchRadius || 20) - 1) / 4) * 100}%, #4b5563 ${((getIntensityLevel(config.maxResults || 20, config.searchRadius || 20) - 1) / 4) * 100}%, #4b5563 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Light</span>
                      <span>Normal</span>
                      <span>Intense</span>
                    </div>
                    <div className="mt-2 p-2 bg-gray-700 rounded text-sm">
                      <span className="text-gray-300">Current: </span>
                      <span className="text-white font-medium">{config.maxResults} results</span>
                      <span className="text-gray-300"> • </span>
                      <span className="text-white font-medium">{config.searchRadius}km radius</span>
                    </div>
                  </div>

                  {/* **NEW CATEGORY SELECTION** */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      🏷️ Search Categories
                    </label>
                    <div className="space-y-3">
                      {SEARCH_CATEGORIES.map((category) => (
                        <label key={category.id} className="flex items-start space-x-3 p-3 hover:bg-gray-700 rounded cursor-pointer border border-gray-600">
                          <input
                            type="checkbox"
                            checked={config.searchCategories?.includes(category.id) || false}
                            onChange={(e) => handleCategorySelection(category.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-200">{category.name}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                category.priority === 'high' ? 'bg-green-900 text-green-300' :
                                category.priority === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                                'bg-gray-700 text-gray-400'
                              }`}>
                                {category.priority}
                              </span>
                              <span className="text-xs text-gray-400">
                                {category.terms.length} terms
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{category.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-gray-700 rounded border border-gray-600">
                      <div className="text-sm text-gray-300">
                        <span className="font-medium">Selected:</span> {config.searchCategories?.length || 0} categories
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        <span className="font-medium">Total search terms:</span> {currentSearchTerms.length}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        💡 Tip: Select fewer categories for faster searches, more for comprehensive coverage
                      </div>
                    </div>
                  </div>


                </div>

                {/* City Selection */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Cities to Scrape
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LATVIAN_CITIES.map((city: string) => (
                      <label key={city} className="flex items-center space-x-2 p-2 hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.cities?.includes(city) || false}
                          onChange={(e) => handleCitySelection(city, e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-300">{city}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Selected: {config.cities?.length || 0} cities
                  </p>
                </div>

                <div className="mt-6">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('🎯 Start Scraping button clicked by user');
                      startScraping();
                    }}
                    disabled={progress.status === 'running' || (config.cities?.length || 0) === 0}
                    className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                      progress.status === 'running' || (config.cities?.length || 0) === 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                    }`}
                    type="button"
                  >
                    {progress.status === 'running' ? '🔄 Scraping in Progress...' : '🚀 Start Scraper (Click to Confirm)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Progress & Results Panel - Always Centered */}
            <div className="xl:col-span-2">
              <div className="bg-gray-800 rounded-lg shadow-md p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 flex items-center text-white">
                  📊 Progress & Results
                </h2>

                {/* Progress Bar */}
                {progress.status === 'running' && (
                  <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                      <span>Cities: {progress.cityIndex + 1}/{progress.totalCities}</span>
                      <span>Offices found: {progress.officesFound}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300 mb-1">
                      <span>⏱️ Elapsed: {formatElapsedTime(progress.elapsedTime || 0)}</span>
                      <span>⌛ Estimated: {estimatedTime ? formatElapsedTime(estimatedTime) : 'Calculating...'}</span>
                    </div>
                    <div className="text-sm text-gray-300 mb-1">
                      <span>🏷️ Categories: {config.searchCategories?.join(', ')}</span>
        </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(((progress.elapsedTime || 0) / (estimatedTime || 100)) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {progress.currentCity && `Currently scraping: ${progress.currentCity}`}
                    </div>
                    
                    {/* Enhanced Progress Details */}
                    <div className="mt-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                      <div className="flex justify-between items-center text-sm text-gray-300 mb-2">
                        <span>📊 Progress Details</span>
                        <span className="text-blue-400">{progress.phase}</span>
                      </div>
                      
                      {progress.totalBatches > 0 && (
                        <div className="flex justify-between text-sm text-gray-300 mb-2">
                          <span>Batch: {progress.currentBatch}/{progress.totalBatches}</span>
                          <span>Terms: {progress.termIndex}/{progress.totalTerms}</span>
                        </div>
                      )}
                      
                      {progress.currentTerms && progress.currentTerms.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-400 mb-1">🔍 Current Search Terms:</div>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {progress.currentTerms.map((term, index) => (
                              <span
                                key={index}
                                className="inline-block px-2 py-1 bg-blue-600 text-white text-xs rounded-full"
                              >
                                {term}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Results Summary */}
                {results && (
                  <div className="mb-6 p-4 rounded-lg border bg-green-900 border-green-700">
                    <h3 className="text-lg font-medium mb-2 text-green-300">
                      ✅ Scraping Complete & Uploaded to Firebase!
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-300">Total Offices:</span>
                        <span className="font-medium ml-2 text-white">{results.totalOffices}</span>
                      </div>
                      <div>
                        <span className="text-gray-300">Cities Scraped:</span>
                        <span className="font-medium ml-2 text-white">{results.totalCities}</span>
                      </div>
                      <div>
                        <span className="text-gray-300">Time Taken:</span>
                        <span className="font-medium ml-2 text-white">{formatElapsedTime(progress.elapsedTime || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-300">Search Terms:</span>
                        <span className="font-medium ml-2 text-white">{currentSearchTerms.length}</span>
                      </div>
                    </div>
                    <div className="border-t pt-3 border-green-700">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-green-400">🔥</span>
                        <span className="text-green-300">Data automatically uploaded to Firebase with duplicate checking</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm mt-1">
                        <span className="text-blue-400">🛡️</span>
                        <span className="text-gray-300">Only new offices were saved (duplicates filtered out)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Found Offices Hierarchical Display */}
                {results && results.results && results.results.length > 0 && (() => {
                  // Group offices by city and then by category
                  const officesByCity = results.results.reduce((acc: any, cityResult: any) => {
                    const city = cityResult.city;
                    if (!acc[city]) {
                      acc[city] = {};
                    }
                    
                    // Group offices by category within the city
                    if (cityResult.offices) {
                      cityResult.offices.forEach((office: any) => {
                        const category = office.category || 'uncategorized';
                        if (!acc[city][category]) {
                          acc[city][category] = [];
                        }
                        acc[city][category].push(office);
                      });
                    }
                    
                    return acc;
                  }, {});
                  
                  const getCategoryName = (categoryId: string) => {
                    const categoryMap: any = {
                      'architecture-only': 'Pure Architecture',
                      'construction-architecture': 'Construction + Architecture',
                      'design-services': 'Design & Planning Services',
                      'property-development': 'Property Development',
                      'engineering-services': 'Engineering & Technical Services',
                      'uncategorized': 'Uncategorized'
                    };
                    return categoryMap[categoryId] || categoryId;
                  };
                  
                  const totalOffices = Object.values(officesByCity).reduce((total: number, cityData: any) => 
                    total + Object.values(cityData).reduce((cityTotal: number, offices: any) => 
                      cityTotal + offices.length, 0), 0);
                  
                  return totalOffices > 0 ? (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-4 text-white">🏢 Found Architecture Offices ({totalOffices})</h3>
                      
                      {/* Hierarchical Display */}
                      <div className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                        <div className="overflow-x-auto max-h-[2000px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-600 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-3 text-left text-white font-medium border-r border-gray-500 min-w-[50px]">#</th>
                                <th className="px-3 py-3 text-left text-white font-medium border-r border-gray-500 min-w-[300px]">Latvia {'>'} City {'>'} Category {'>'} Office</th>
                                <th className="px-3 py-3 text-left text-white font-medium border-r border-gray-500 min-w-[250px]">Address</th>
                                <th className="px-3 py-3 text-left text-white font-medium min-w-[150px]">🔍 Database Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(officesByCity).map(([city, categoryData]: [string, any]) => (
                                <React.Fragment key={city}>
                                  {/* City Header */}
                                  <tr className="bg-gray-600 border-b border-gray-500">
                                    <td className="px-3 py-2 text-yellow-400 font-bold border-r border-gray-500"></td>
                                    <td className="px-3 py-2 text-yellow-400 font-bold border-r border-gray-500">
                                      🇱🇻 Latvia {'>'} {city}
                                    </td>
                                    <td className="px-3 py-2 border-r border-gray-500"></td>
                                    <td className="px-3 py-2"></td>
                                  </tr>
                                  
                                  {/* Categories within City */}
                                  {Object.entries(categoryData).map(([category, offices]: [string, any]) => (
                                    <React.Fragment key={`${city}-${category}`}>
                                      {/* Category Header */}
                                      <tr className="bg-gray-650 border-b border-gray-600">
                                        <td className="px-3 py-2 text-blue-400 font-medium border-r border-gray-600"></td>
                                        <td className="px-3 py-2 text-blue-400 font-medium border-r border-gray-600">
                                          <div className="pl-4">
                                            🏷️ {getCategoryName(category)} ({offices.length})
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 border-r border-gray-600"></td>
                                        <td className="px-3 py-2"></td>
                                      </tr>
                                      
                                      {/* Offices in Category */}
                                      {offices.map((office: any, officeIndex: number) => (
                                        <tr key={`${city}-${category}-${officeIndex}`} className="border-b border-gray-600 hover:bg-gray-650 transition-colors">
                                          <td className="px-3 py-3 text-gray-400 font-medium border-r border-gray-600">
                                            {officeIndex + 1}
                                          </td>
                                  <td className="px-3 py-3 text-gray-300 border-r border-gray-600">
                                            <div className="pl-8 font-medium text-white">
                                      {office.name || 'Unnamed Office'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-gray-300 border-r border-gray-600">
                                    <div className="max-w-[250px] truncate" title={office.address}>
                                      {office.address || '-'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-gray-300">
                                    {office.existedInDatabase ? (
                                      <div className="flex items-center space-x-1">
                                        <span className="text-orange-400">📋</span>
                                        <span className="text-orange-400 font-medium">Existed</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-1">
                                        <span className="text-green-400">✨</span>
                                        <span className="text-green-400 font-medium">New</span>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* Table Summary */}
                      <div className="mt-4 text-center text-gray-400 text-sm">
                        📋 Showing {totalOffices} architecture offices organized by category • 
                        {Object.keys(officesByCity).length} cities, {Object.values(officesByCity).reduce((total: number, cityData: any) => 
                          total + Object.keys(cityData).length, 0)} categories
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* No Results Message */}
                {results && results.results && results.results.length === 0 && (
                  <div className="mb-6 p-4 bg-yellow-900 rounded-lg border border-yellow-700">
                    <h3 className="text-lg font-medium text-yellow-300 mb-2">
                      ⚠️ No Offices Found
                    </h3>
                    <p className="text-yellow-200 text-sm">
                      The scraper completed successfully but didn't find any architecture offices matching the search criteria.
                      Try expanding the search radius or checking different cities.
                    </p>
                  </div>
                )}

                {/* Error Display */}
                {progress.status === 'error' && (
                  <div className="mb-6 p-4 bg-red-900 rounded-lg border border-red-700">
                    <h3 className="text-lg font-medium text-red-300 mb-2">
                      ❌ Error Occurred
                    </h3>
                    <p className="text-red-200 text-sm">{progress.error}</p>
                  </div>
                )}

                {/* Logs */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-white">Terminal Output</h3>
                    <div className="flex items-center space-x-2">
                      {logs.length > 0 && (
                        <>
                          <button
                            id="copy-logs-button"
                            onClick={copyTerminalLogs}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm transition-colors flex items-center space-x-1"
                            title="Copy all terminal logs to clipboard (Ctrl/Cmd+Shift+C)"
                          >
                            <span>📋</span>
                            <span>Copy</span>
                          </button>
                          <button
                            onClick={jumpToBottom}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition-colors flex items-center space-x-1"
                            title="Jump to bottom (Ctrl/Cmd+End)"
                          >
                            <span>↓</span>
                            <span>Bottom</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div 
                    id="logs-container"
                    className="bg-black rounded-lg p-6 h-96 overflow-y-auto font-mono text-sm w-full relative"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {logs.length === 0 ? (
                      <p className="text-green-400">Waiting for activity...</p>
                    ) : (
                      <div className="space-y-1">
                        {logs.map((log, index) => (
                          <div 
                            key={index} 
                            className="text-green-400 whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{
                              __html: log
                                .replace(/🚀|✅|🔧|📊|🔍|💾|🎉/g, '<span class="text-yellow-400">$&</span>')
                                .replace(/❌|⚠️|🔄/g, '<span class="text-red-400">$&</span>')
                                .replace(/🛡️|🤖|📋|📄|📊/g, '<span class="text-blue-400">$&</span>')
                            }}
                          />
                        ))}
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
