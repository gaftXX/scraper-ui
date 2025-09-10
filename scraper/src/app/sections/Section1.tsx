'use client';

import React from 'react';

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
  scrapedCities?: string[];
}

interface Section1Props {
  progress: ScrapingProgress;
  results: ScrapingResults | null;
  logs: string[];
  estimatedTime: number | null;
  config: any;
  formatElapsedTime: (seconds: number) => string;
  jumpToBottom: () => void;
  copyTerminalLogs: () => Promise<void>;
  currentSearchTerms: string[];
  autoScroll: boolean;
  toggleAutoScroll: () => void;
  showSystem: boolean;
  resetSystemState: () => void;
  handleCountryChange?: (country: 'latvia' | 'spain') => void;
}

export default function Section1({
  progress,
  results,
  logs,
  estimatedTime,
  config,
  formatElapsedTime,
  jumpToBottom,
  copyTerminalLogs,
  currentSearchTerms,
  autoScroll,
  toggleAutoScroll,
  showSystem,
  resetSystemState,
  handleCountryChange
}: Section1Props) {
  return (
    <div className="col-span-2 h-screen">
      <div className="h-full flex flex-col p-2">
        {showSystem ? (
          // System UI
          <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-[#ffffff]">SYSTEM SETTINGS</h2>
              <button
                onClick={resetSystemState}
                className="px-3 py-1 bg-[#393837] text-sm"
              >
                CLOSE
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center text-[#ffffff] mb-6">
                <h3 className="text-md font-medium mb-4">Country Selection</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => handleCountryChange?.('latvia')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      config.country === 'latvia'
                        ? 'bg-[#4a90e2] text-white'
                        : 'bg-[#393837] text-[#ffffff] hover:bg-[#4a4a4a]'
                    }`}
                  >
                    Latvia
                  </button>
                  <button
                    onClick={() => handleCountryChange?.('spain')}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      config.country === 'spain' || !config.country
                        ? 'bg-[#4a90e2] text-white'
                        : 'bg-[#393837] text-[#ffffff] hover:bg-[#4a4a4a]'
                    }`}
                  >
                    Spain
                  </button>
                </div>
                <p className="text-xs text-[#ffffff] opacity-70 mt-2">
                  Select a country to change available cities
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Scraper UI
          <div className="h-full flex flex-col">
            {/* Progress Bar */}
            <div className="flex-none">
              {progress.status === 'running' && (
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#ffffff]">Cities: {progress.cityIndex + 1}/{progress.totalCities}</span>
                    <span className="text-[#ffffff]">Offices found: {progress.officesFound}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#ffffff]">Elapsed: {formatElapsedTime(progress.elapsedTime || 0)}</span>
                    <span className="text-[#ffffff]">Estimated: {estimatedTime ? formatElapsedTime(estimatedTime) : 'Calculating...'}</span>
                  </div>
                  <div className="text-sm">
                  </div>
                  <div className="text-sm mt-1">
                  </div>
                </div>
              )}

              {/* Results Summary */}
              {results && (
                <div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-[#ffffff]">Total Offices:</span>
                      <span className="font-medium ml-2 text-[#ffffff]">{results.totalOffices}</span>
                    </div>
                    <div>
                      <span className="text-[#ffffff]">Cities Scraped:</span>
                      <span className="font-medium ml-2 text-[#ffffff]">{results.scrapedCities?.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-[#ffffff]">Time Taken:</span>
                      <span className="font-medium ml-2 text-[#ffffff]">{formatElapsedTime(progress.elapsedTime || 0)}</span>
                    </div>
                    <div>
                      <span className="text-[#ffffff]">Search Terms:</span>
                      <span className="font-medium ml-2 text-[#ffffff]">{currentSearchTerms.length}</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center space-x-2 text-sm">
                    </div>
                    <div className="flex items-center space-x-2 text-sm mt-1">
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
                    <h3 className="text-lg font-medium mb-4 text-[#ffffff]"></h3>
                    
                    {/* Hierarchical Display */}
                    <div className="overflow-hidden" style={{ backgroundColor: 'transparent' }}>
                      <style jsx global>{`
                        .spreadsheet-container {
                          scrollbar-width: none;  /* Firefox */
                          -ms-overflow-style: none;  /* Internet Explorer 10+ */
                        }
                        .spreadsheet-container::-webkit-scrollbar {
                          display: none;  /* WebKit */
                        }
                      `}</style>
                      <div className="overflow-x-auto max-h-[2000px] overflow-y-auto spreadsheet-container">
                        <table className="w-full text-sm">
                          <tbody>
                            {Object.entries(officesByCity).map(([city, categoryData]: [string, any], cityIndex: number) => (
                              <React.Fragment key={city}>
                                {Object.entries(categoryData).map(([category, offices]: [string, any]) => (
                                  <React.Fragment key={`${city}-${category}`}>
                                    {offices.map((office: any, officeIndex: number) => (
                                      <tr key={`${city}-${category}-${officeIndex}`} className="border-none hover:bg-gray-650 transition-colors" style={{ backgroundColor: 'transparent' }}>
                                        <td className="py-0 text-[#ffffff] border-r border-gray-500">
                                          <div className="pl-[13px]">
                                            <div className="font-medium text-[#ffffff]">{office.name}</div>
                                            {office.phone && <div className="text-xs text-[#ffffff]">Phone: {office.phone}</div>}
                                          </div>
                                        </td>
                                        <td className="py-0 pl-[5px] text-[#ffffff] border-r border-gray-500">
                                          {office.address || 'No address available'}
                                        </td>
                                        <td className="py-0 pl-[5px] text-[#ffffff] border-r border-gray-500">
                                          {office.website ? office.website.replace(/^https?:\/\//, '') : '-'}
                                        </td>
                                        <td className="py-0 pl-[5px] text-[#ffffff]">
                                          {office.existedInDatabase ? (
                                            <div className="flex items-center space-x-1">
                                              <span className="text-[#ffffff] font-medium">Existed</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center space-x-1">
                                              <span className="text-[#ffffff] font-medium">New</span>
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
                    <div className="mt-4 text-center text-[#ffffff] text-sm">
                    </div>
                  </div>
                ) : null;
              })()}

              {/* No Results Message */}
              {results && results.results && results.results.length === 0 && (
                <div className="mb-6 p-4 bg-yellow-900 rounded-lg border border-yellow-700">
                  <h3 className="text-lg font-medium text-[#ffffff] mb-2">
                    No Offices Found
                  </h3>
                  <p className="text-[#ffffff] text-sm">
                    The scraper completed successfully but didn't find any architecture offices matching the search criteria.
                    Try expanding the search radius or checking different cities.
                  </p>
                </div>
              )}

              {/* Error Display */}
              {progress.status === 'error' && (
                <div className="mb-6 p-4 bg-red-900 rounded-lg border border-red-700">
                  <h3 className="text-lg font-medium text-[#ffffff] mb-2">
                    Error Occurred
                  </h3>
                  <p className="text-[#ffffff] text-sm">{progress.error}</p>
                </div>
              )}
            </div>

            {/* Terminal Block - Always visible */}
            <div className="flex-grow min-h-0 overflow-hidden">
              <div className="h-full flex flex-col">
                {logs.length > 0 && (
                  <>
                    <div className="flex-none px-2 flex justify-between items-center">
                      <span className="text-sm text-[#ffffff]">Terminal Output</span>
                      <button
                        onClick={copyTerminalLogs}
                        className="text-xs text-[#ffffff] hover:text-[#ffffff] transition-colors"
                      >
                        Copy Logs
                      </button>
                    </div>
                    <style jsx global>{`
                      .terminal-output {
                        scrollbar-width: none;  /* Firefox */
                        -ms-overflow-style: none;  /* Internet Explorer 10+ */
                      }
                      .terminal-output::-webkit-scrollbar {
                        display: none;  /* WebKit */
                      }
                      .terminal-output pre {
                        color: #ffffff !important;
                      }
                    `}</style>
                    <div id="logs-container" className="flex-grow min-h-0 overflow-y-auto terminal-output">
                      <pre className="text-sm font-mono text-[#ffffff] whitespace-pre-wrap">
                        {logs.join('\n')}
                      </pre>
                    </div>
                    <div className="flex-none px-2">
                      <button
                        onClick={toggleAutoScroll}
                        className="text-xs text-[#ffffff] hover:text-[#ffffff] transition-colors"
                      >
                        {autoScroll ? 'Auto Scroll: ON' : 'Auto Scroll: OFF'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 