'use client';

import React from 'react';
import { InlookState } from '../inlookTypes';

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
  inlookState: InlookState;
  showInlook: boolean;
  resetInlookState: () => void;
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
  handleCountryChange,
  inlookState,
  showInlook,
  resetInlookState
}: Section1Props) {
  return (
    <div className="col-span-2 h-screen">
      <style jsx global>{`
        div::-webkit-scrollbar {
          width: 8px;
        }
        div::-webkit-scrollbar-track {
          background: #2d3748;
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb {
          background: #4a5568;
          border-radius: 4px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #718096;
        }
        .projects-container {
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* Internet Explorer 10+ */
        }
        .projects-container::-webkit-scrollbar {
          display: none;  /* WebKit */
        }
        .inlook-terminal-output {
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* Internet Explorer 10+ */
        }
        .inlook-terminal-output::-webkit-scrollbar {
          display: none;  /* WebKit */
        }
        .inlook-terminal-output pre {
          color: #ffffff !important;
        }
        .spreadsheet-container {
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* Internet Explorer 10+ */
        }
        .spreadsheet-container::-webkit-scrollbar {
          display: none;  /* WebKit */
        }
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
      <div className="h-full flex flex-col">
        {showInlook ? (
          // Inlook AI Scraper UI
          <div className="h-full flex flex-col">
            
            {/* Scrollable content area */}
            <div className={`min-h-0 overflow-y-auto ${inlookState.isRunning ? 'hidden' : 'flex-1'}`} style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4a5568 #2d3748'
            }}>
            
            {/* Inlook Progress */}
            {inlookState.isRunning && inlookState.progress && (
              <div className="mb-6 p-4 bg-blue-900 rounded-lg border border-blue-700">
                <h3 className="text-lg font-medium text-[#ffffff] mb-2">
                  Inlook AI Analysis
                </h3>
                <div className="text-sm text-[#ffffff] mb-2">
                  Status: {inlookState.progress.status.toUpperCase()}
                </div>
                <div className="text-sm text-[#ffffff] mb-2">
                  {inlookState.progress.currentPhase}
                </div>
                {inlookState.progress.pagesCrawled > 0 && (
                  <div className="text-sm text-[#ffffff]">
                    Pages crawled: {inlookState.progress.pagesCrawled}
                  </div>
                )}
              </div>
            )}

            {/* Inlook Results */}
            {inlookState.result && (
              <div className="h-full py-2 px-2">
                
                {/* Analysis Summary */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <div>
                    <span className="text-[#ffffff]">Data Quality:</span>
                    <span className="ml-2 text-[#ffffff]">{inlookState.result.office.dataQuality.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-[#ffffff]">Confidence:</span>
                    <span className="font-medium ml-2 text-[#ffffff]">{inlookState.result.metadata.confidence}%</span>
                  </div>
                  <div>
                    <span className="text-[#ffffff]">Pages Analyzed:</span>
                    <span className="font-medium ml-2 text-[#ffffff]">{inlookState.result.metadata.pagesAnalyzed}</span>
                  </div>
                  <div>
                    <span className="text-[#ffffff]">Time:</span>
                    <span className="font-medium ml-2 text-[#ffffff]">{inlookState.result.metadata.totalTime}s</span>
                  </div>
                </div>

                {/* Company Overview */}
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-[#ffffff] mb-3">{inlookState.result.office.name}</h4>
                  <div className="bg-transparent p-0 rounded-lg">
                    <div className="space-y-3">
                      {inlookState.result.office.description && (
                        <div>
                          <p className="text-[#ffffff] mt-1">{inlookState.result.office.description}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        {inlookState.result.office.foundedYear && (
                          <div>
                            <span className="text-gray-300 text-sm">Founded:</span>
                            <div className="text-[#ffffff] font-medium">{inlookState.result.office.foundedYear}</div>
                          </div>
                        )}
                        {inlookState.result.office.projects && (
                          <div>
                            <span className="text-gray-300 text-sm">Projects:</span>
                            <div className="text-[#ffffff] font-medium">{inlookState.result.office.projects.length} projects</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                {(inlookState.result.office.address || inlookState.result.office.phone || inlookState.result.office.email) && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-[#ffffff] mb-2">Contact Information</h4>
                    <div className="bg-black bg-opacity-30 p-3 rounded text-sm">
                      <div className="grid grid-cols-1 gap-1">
                        {inlookState.result.office.address && (
                          <div><span className="text-gray-300">Address:</span> <span className="text-[#ffffff]">{inlookState.result.office.address}</span></div>
                        )}
                        {inlookState.result.office.phone && (
                          <div><span className="text-gray-300">Phone:</span> <span className="text-[#ffffff]">{inlookState.result.office.phone}</span></div>
                        )}
                        {inlookState.result.office.email && (
                          <div><span className="text-gray-300">Email:</span> <span className="text-[#ffffff]">{inlookState.result.office.email}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {/* Projects Portfolio */}
                {inlookState.result.office.projects && inlookState.result.office.projects.length > 0 && (() => {
                  const residentialProjects = inlookState.result.office.projects.filter((project: any) => 
                    project.type && (project.type.toLowerCase().includes('residential') || project.type.toLowerCase().includes('residencial'))
                  );
                  const commercialProjects = inlookState.result.office.projects.filter((project: any) => 
                    project.type && (project.type.toLowerCase().includes('commercial') || project.type.toLowerCase().includes('comercial'))
                  );
                  
                  const renderProjectTable = (projects: any[], title: string, count: number) => (
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-[#ffffff] mb-3">{title} ({count} projects)</h4>
                      
                      {/* Projects Spreadsheet */}
                      <div className="overflow-hidden" style={{ backgroundColor: 'transparent' }}>
                        <div className="overflow-x-auto overflow-y-auto projects-container px-16">
                          <table className="w-full text-sm">
                            <tbody>
                              {projects.map((project: any, index: number) => (
                                <tr key={index} className="border-none hover:bg-gray-650 transition-colors" style={{ backgroundColor: 'transparent' }}>
                                  <td className="py-0 text-[#ffffff] border-r border-gray-500" style={{ width: '300px' }}>
                                    <div className="pl-2">
                                      <div className="font-medium text-[#ffffff]">{project.name}</div>
                                    </div>
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-gray-500" style={{ width: '400px' }}>
                                    {project.location || '-'}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-gray-500" style={{ width: '80px' }}>
                                    {project.size || '-'}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-gray-500" style={{ width: '110px' }}>
                                    {project.status ? (
                                      <span className="text-white text-xs">
                                        {project.status}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff]">
                                    {''}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff]">
                                    {project.sustainability && project.sustainability.length > 0 ? (
                                      <span className="text-green-400 text-xs">{project.sustainability.join(', ')}</span>
                                    ) : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div>
                      {residentialProjects.length > 0 && renderProjectTable(residentialProjects, "Residential Projects", residentialProjects.length)}
                      {commercialProjects.length > 0 && renderProjectTable(commercialProjects, "Commercial Projects", commercialProjects.length)}
                    </div>
                  );
                })()}


                {/* Awards */}
                {inlookState.result.office.awards && inlookState.result.office.awards.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-[#ffffff] mb-2">Awards ({inlookState.result.office.awards.length})</h4>
                    <div className="bg-black bg-opacity-30 p-3 rounded text-sm max-h-32 overflow-y-auto">
                      {inlookState.result.office.awards.slice(0, 3).map((award, index) => (
                        <div key={index} className="mb-1 text-xs">
                          <span className="text-[#ffffff] font-medium">{award.name}</span>
                          {award.year && <span className="text-gray-300 ml-2">({award.year})</span>}
                          {award.organization && <span className="text-gray-400 ml-2">- {award.organization}</span>}
                        </div>
                      ))}
                      {inlookState.result.office.awards.length > 3 && (
                        <div className="text-gray-400 text-xs">... and {inlookState.result.office.awards.length - 3} more awards</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Publications */}
                {inlookState.result.office.publications && inlookState.result.office.publications.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-[#ffffff] mb-2">Publications ({inlookState.result.office.publications.length})</h4>
                    <div className="bg-black bg-opacity-30 p-3 rounded text-sm max-h-32 overflow-y-auto">
                      {inlookState.result.office.publications.slice(0, 3).map((pub, index) => (
                        <div key={index} className="mb-1 text-xs">
                          <div className="text-[#ffffff] font-medium">{pub.title}</div>
                          {pub.year && <span className="text-gray-300">({pub.year})</span>}
                          {pub.publisher && <span className="text-gray-400 ml-2">- {pub.publisher}</span>}
                        </div>
                      ))}
                      {inlookState.result.office.publications.length > 3 && (
                        <div className="text-gray-400 text-xs">... and {inlookState.result.office.publications.length - 3} more publications</div>
                      )}
                    </div>
                  </div>
                )}


              </div>
            )}

            {/* Inlook Error */}
            {inlookState.error && (
              <div className="mb-6 p-4 bg-red-900 rounded-lg border border-red-700">
                <h3 className="text-lg font-medium text-[#ffffff] mb-2">
                  Inlook Analysis Failed
                </h3>
                <p className="text-[#ffffff] text-sm">{inlookState.error}</p>
              </div>
            )}
            
            </div> {/* End of scrollable content area */}

            {/* Inlook Terminal Block - Always visible */}
            <div className={`overflow-hidden ${inlookState.isRunning ? 'flex-1' : 'flex-none h-48'}`}>
              <div className="h-full flex flex-col">
                <div className="flex-none px-2 flex justify-between items-center">
                  <span className="text-sm text-[#ffffff]">Inlook Terminal Output</span>
                  {inlookState.logs.length > 0 && (
                    <button
                      onClick={() => {
                        const logsText = inlookState.logs.join('\n');
                        navigator.clipboard.writeText(logsText);
                      }}
                      className="text-xs text-[#ffffff] hover:text-[#ffffff] transition-colors"
                    >
                      Copy Logs
                    </button>
                  )}
                </div>
                <div id="inlook-logs-container" className="flex-grow min-h-0 overflow-y-auto inlook-terminal-output">
                  <pre className="text-sm font-mono text-[#ffffff] whitespace-pre-wrap">
                    {inlookState.logs.length > 0 ? inlookState.logs.join('\n') : 
                      inlookState.isRunning ? 'Initializing inlook scraper...' : 'No logs available'}
                  </pre>
                </div>
                <div className="flex-none px-2">
                  <button
                    onClick={() => {
                      // Auto scroll functionality for Inlook terminal
                      const container = document.getElementById('inlook-logs-container');
                      if (container) {
                        container.scrollTop = container.scrollHeight;
                      }
                    }}
                    className="text-xs text-[#ffffff] hover:text-[#ffffff] transition-colors"
                  >
                    Auto Scroll: ON
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : showSystem ? (
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
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4 text-[#ffffff]">
                <button
                  onClick={() => handleCountryChange?.('latvia')}
                  className={`text-sm font-medium transition-all cursor-pointer ${
                    config.country === 'latvia'
                      ? 'text-[#ffffff] opacity-100'
                      : 'text-[#ffffff] opacity-40 hover:opacity-60'
                  }`}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent'
                  }}
                >
                  Latvia
                </button>
                <button
                  onClick={() => handleCountryChange?.('spain')}
                  className={`text-sm font-medium transition-all cursor-pointer ${
                    config.country === 'spain' || !config.country
                      ? 'text-[#ffffff] opacity-100'
                      : 'text-[#ffffff] opacity-40 hover:opacity-60'
                  }`}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent'
                  }}
                >
                  Spain
                </button>
              </div>
              <div className="text-[#ffffff]">
                <h3 className="text-md font-medium">Region Selection</h3>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[#ffffff]">
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
                                          {office.website ? (
                                            <a
                                              href={office.website.startsWith('http') ? office.website : `https://${office.website}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[#ffffff] cursor-pointer"
                                            >
                                              {office.website.replace(/^https?:\/\//, '')}
                                            </a>
                                          ) : '-'}
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