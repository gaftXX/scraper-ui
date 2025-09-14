'use client';

import React, { useState } from 'react';
import { InlookState } from '../inlookTypes';
import { createTrackedLink } from '../utils/clickTracker';

// Component for displaying updated project details with dropdown
const UpdatedProjectDetails: React.FC<{ project: any }> = ({ project }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getUpdateDetails = (project: any) => {
    const details = [];
    
    // Status change
    if (project.previousStatus !== project.status) {
      details.push({
        field: 'Status',
        from: project.previousStatus || 'planning',
        to: project.status || 'planning',
        reason: 'Status updated from new analysis'
      });
    }

    // Other field updates (if we have more detailed tracking)
    if (project.previousDescription && project.previousDescription !== project.description) {
      details.push({
        field: 'Description',
        from: project.previousDescription.substring(0, 100) + '...',
        to: (project.description || '').substring(0, 100) + '...',
        reason: 'Description updated with new information'
      });
    }

    if (project.previousSize && project.previousSize !== project.size) {
      details.push({
        field: 'Size',
        from: project.previousSize,
        to: project.size,
        reason: 'Size information updated'
      });
    }

    if (project.previousLocation && project.previousLocation !== project.location) {
      details.push({
        field: 'Location',
        from: project.previousLocation,
        to: project.location,
        reason: 'Location information updated'
      });
    }

    if (project.previousUseCase && project.previousUseCase !== project.useCase) {
      details.push({
        field: 'Use Case',
        from: project.previousUseCase,
        to: project.useCase,
        reason: 'Use case classification updated'
      });
    }

    // If no specific field changes, show general update reason
    if (details.length === 0) {
      details.push({
        field: 'Project Information',
        from: 'Previous version',
        to: 'Updated version',
        reason: project.reason || 'Project information updated from new analysis'
      });
    }

    return details;
  };

  const updateDetails = getUpdateDetails(project);

  return (
    <div className="text-xs text-[#ffffff] p-2">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>
          • {project.name}: {project.previousStatus || 'planning'} → {project.status || 'planning'}
        </span>
        <span className="text-[#ffffff] ml-2">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pl-2 border-l-2 border-[#ffffff]">
          <div className="text-xs text-[#ffffff] font-medium mb-1">
            Update Details:
          </div>
          {updateDetails.map((detail, idx) => (
            <div key={idx} className="mb-2 text-xs">
              <div className="text-[#ffffff] font-medium">{detail.field}:</div>
              <div className="text-[#ffffff] ml-2">
                <div>From: <span className="text-[#ffffff]">{detail.from}</span></div>
                <div>To: <span className="text-[#ffffff]">{detail.to}</span></div>
                <div className="text-[#ffffff] italic">Reason: {detail.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Component for displaying blocked project details with dropdown
const BlockedProjectDetails: React.FC<{ project: any }> = ({ project }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getBlockReason = (reason: string) => {
    const reasons = {
      'exact project name match': 'This project has the exact same name as an existing project',
      'exact description match': 'This project has the exact same description as an existing project',
      'similar project name': 'This project name is too similar to an existing project name',
      'similar description': 'This project description is too similar to an existing project description',
      'same location + use case with related names': 'This project is in the same location with the same use case and has a related name to an existing project'
    };
    return reasons[reason as keyof typeof reasons] || reason;
  };

  return (
    <div className="text-xs text-[#ffffff] p-2">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>
          • {project.name} - {project.reason}
        </span>
        <span className="text-[#ffffff] ml-2">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pl-2 border-l-2 border-[#ffffff]">
          <div className="text-xs text-[#ffffff] font-medium mb-1">
            Block Reason Details:
          </div>
          <div className="text-xs text-[#ffffff] mb-2">
            {getBlockReason(project.reason)}
          </div>
          
          {project.similarTo && (
            <div className="text-xs text-[#ffffff] mb-1">
              Similar to existing project:
            </div>
          )}
          {project.similarTo && (
            <div className="text-xs text-[#ffffff] ml-2">
              "{project.similarTo}"
            </div>
          )}
          
          <div className="text-xs text-[#ffffff] italic mt-2">
            This project was blocked to prevent duplicate entries in the database.
          </div>
        </div>
      )}
    </div>
  );
};

// Component for displaying added project details with dropdown
const AddedProjectDetails: React.FC<{ project: any }> = ({ project }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="text-xs text-[#ffffff] p-2">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>
          • {project.name} ({project.status || 'planning'})
        </span>
        <span className="text-[#ffffff] ml-2">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pl-2 border-l-2 border-[#ffffff]">
          <div className="text-xs text-[#ffffff] font-medium mb-1">
            Project Details:
          </div>
          <div className="text-xs text-[#ffffff] space-y-1">
            <div><span className="text-[#ffffff]">Status:</span> {project.status || 'planning'}</div>
            {project.location && <div><span className="text-[#ffffff]">Location:</span> {project.location}</div>}
            {project.size && <div><span className="text-[#ffffff]">Size:</span> {project.size}</div>}
            {project.useCase && <div><span className="text-[#ffffff]">Use Case:</span> {project.useCase}</div>}
            {project.description && (
              <div>
                <span className="text-[#ffffff]">Description:</span> 
                <div className="text-[#ffffff] ml-2 text-xs">{project.description.substring(0, 150)}{project.description.length > 150 ? '...' : ''}</div>
              </div>
            )}
          </div>
          <div className="text-xs text-[#ffffff] italic mt-2">
            This project was successfully added as a new entry.
          </div>
        </div>
      )}
    </div>
  );
};

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

interface InputAnalysisResult {
  projects: any[];
  team: any;
  relations: any;
  funding: any;
  clients: any;
  originalLanguage?: string;
  translatedText?: string;
  analysisId: string;
  timestamp: string;
  firebaseSaveSuccess?: boolean;
  firebaseError?: string;
  feedback?: {
    isNewAnalysis?: boolean;
    projects?: {
      added: any[];
      blocked: any[];
      updated: any[];
    };
    team?: { updated: boolean };
    relations?: { updated: boolean };
    funding?: { updated: boolean };
    clients?: { updated: boolean };
    summary?: {
      totalProjectsAdded: number;
      totalProjectsBlocked: number;
      totalProjectsUpdated: number;
    };
  };
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
  inlookDisabled: boolean;
  toggleInlookDisabled: () => void;
  showInputState: boolean;
  inputStateOffice: any;
  resetInputState: () => void;
  inputAnalysisResult: InputAnalysisResult | null;
  setInputAnalysisResult: (result: InputAnalysisResult | null) => void;
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
  resetInlookState,
  inlookDisabled,
  toggleInlookDisabled,
  showInputState,
  inputStateOffice,
  resetInputState,
  inputAnalysisResult,
  setInputAnalysisResult
}: Section1Props) {
  const handleAnalysis = async () => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    
    if (!textarea.value.trim()) {
      alert('Please enter some data to analyze');
      return;
    }

    if (!inputStateOffice?.uniqueId) {
      alert('Office ID not found');
      return;
    }

    // Show loading state by changing placeholder
    const originalPlaceholder = textarea.placeholder;
    textarea.placeholder = 'Analyzing data...';
    textarea.disabled = true;

    try {
      const response = await fetch('/api/input-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          officeId: inputStateOffice.uniqueId,
          inputText: textarea.value,
          officeName: inputStateOffice.name,
          officeAddress: inputStateOffice.address,
          country: config.country
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Input Analysis completed:', result);
        
        // Store the analysis result
        setInputAnalysisResult({
          projects: result.analysis.projects || [],
          team: result.analysis.team || {},
          relations: result.analysis.relations || {},
          funding: result.analysis.funding || {},
          clients: result.analysis.clients || {},
          originalLanguage: result.analysis.originalLanguage,
          translatedText: result.analysis.translatedText,
          analysisId: result.officeId || 'unknown',
          timestamp: new Date().toISOString(),
          firebaseSaveSuccess: result.firebaseSaveSuccess,
          firebaseError: result.firebaseError,
          feedback: result.feedback
        });
        
        // Show success message
        textarea.placeholder = 'Analysis complete! Closing...';
        
        // Clear the textarea
        textarea.value = '';
        
        // Close the input state after a short delay
        setTimeout(() => {
          resetInputState();
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Input Analysis failed:', error);
        alert(`Analysis failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error during input analysis:', error);
      alert('Failed to analyze data. Please try again.');
    } finally {
      // Reset textarea state
      setTimeout(() => {
        textarea.placeholder = originalPlaceholder;
        textarea.disabled = false;
      }, 2000);
    }
  };

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
        .analysis-results-container {
          scrollbar-width: none;  /* Firefox */
          -ms-overflow-style: none;  /* Internet Explorer 10+ */
        }
        .analysis-results-container::-webkit-scrollbar {
          display: none;  /* WebKit */
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
                                  <td className="py-0 text-[#ffffff] border-r border-white" style={{ width: '300px' }}>
                                    <div className="pl-2">
                                      <div className="font-medium text-[#ffffff]">{project.name}</div>
                                    </div>
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-white" style={{ width: '400px' }}>
                                    {project.location || '-'}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-white" style={{ width: '80px' }}>
                                    {project.size || '-'}
                                  </td>
                                  <td className="py-0 pl-2 text-[#ffffff] border-r border-white" style={{ width: '110px' }}>
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
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4 text-[#ffffff]">
                <button
                  onClick={toggleInlookDisabled}
                  className={`text-sm font-medium transition-all cursor-pointer ${
                    inlookDisabled
                      ? 'text-[#ffffff] opacity-100'
                      : 'text-[#ffffff] opacity-40 hover:opacity-60'
                  }`}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent'
                  }}
                >
                  {inlookDisabled ? 'DISABLED' : 'ENABLED'}
                </button>
              </div>
              <div className="text-[#ffffff]">
                <h3 className="text-md font-medium">Inlook Scraper</h3>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[#ffffff]">
              </div>
            </div>
          </div>
        ) : showInputState ? (
          // Input State UI
          <div className="h-full flex flex-col p-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-[#ffffff]">INPUT DATA</h2>
              <button
                onClick={resetInputState}
                className="px-3 py-1 bg-[#393837] text-sm"
              >
                CLOSE
              </button>
            </div>
            
            {/* Office Information Header */}
            {inputStateOffice && (
              <div className="mb-6 p-4 bg-[#393837] rounded-lg">
                <h3 className="text-lg font-medium text-[#ffffff] mb-2">
                  {inputStateOffice.name}
                </h3>
                <div className="text-sm text-[#ffffff] space-y-1">
                  {inputStateOffice.address && (
                    <div>Address: {inputStateOffice.address}</div>
                  )}
                  {inputStateOffice.phone && (
                    <div>Phone: {inputStateOffice.phone}</div>
                  )}
                  {inputStateOffice.website && (
                    <div>Website: {inputStateOffice.website}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Large Text Input Area */}
            <div className="flex-1 flex flex-col">
              <div className="text-sm text-gray-400 mb-2">
                Press Shift + Enter to analyze the data.
              </div>
              <textarea
                id="office-data-input"
                className="flex-1 w-full p-4 bg-transparent text-[#ffffff] border border-white resize-none focus:outline-none"
                placeholder="input data"
                style={{
                  fontFamily: 'Monaco, Menlo, Ubuntu Mono, Consolas, source-code-pro, monospace',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
                onKeyDown={(e) => {
                  // Handle Shift+Enter for analysis
                  if (e.key === 'Enter' && e.shiftKey) {
                    e.preventDefault();
                    
                    // Call the analysis function
                    handleAnalysis();
                  }
                  // For all other keys (Enter, Arrow Down, Arrow Up), do nothing - let them work normally
                }}
              />
            </div>
          </div>
        ) : inputAnalysisResult ? (
          // Input Analysis Results State
          <div className="h-full flex flex-col p-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-[#ffffff]">ANALYSIS RESULTS</h2>
              <button
                onClick={() => setInputAnalysisResult(null)}
                className="px-3 py-1 bg-[#393837] text-sm"
              >
                CLOSE
              </button>
            </div>
            
            {/* Analysis Summary */}
            <div className="mb-6 p-4">
              <div className="text-sm text-[#ffffff] space-y-1">
                <div>Analysis ID: {inputAnalysisResult.analysisId}</div>
                <div>Timestamp: {new Date(inputAnalysisResult.timestamp).toLocaleString()}</div>
                <div className="font-medium text-[#ffffff]">
                  Firebase Save: {inputAnalysisResult.firebaseSaveSuccess ? 'SUCCESS' : 'FAILED'}
                </div>
                {inputAnalysisResult.firebaseError && (
                  <div className="text-[#ffffff] text-xs">Error: {inputAnalysisResult.firebaseError}</div>
                )}
              </div>
            </div>

            {/* Merge Feedback */}
            {inputAnalysisResult.feedback && (
              <div className="mb-6 p-4">
                <h3 className="text-md font-medium text-[#ffffff] mb-3">Merge Feedback</h3>
                
                {inputAnalysisResult.feedback.isNewAnalysis ? (
                  <div className="text-sm text-[#ffffff] mb-3">
                    This is a new analysis - all data was added successfully
                  </div>
                ) : (
                  <div className="text-sm text-[#ffffff] mb-3">
                    Analysis merged with existing data
                  </div>
                )}

                {/* Project Feedback */}
                {inputAnalysisResult.feedback.projects && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-[#ffffff] mb-2">Projects Summary</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div className="text-[#ffffff]">
                        Added: {inputAnalysisResult.feedback.summary?.totalProjectsAdded || 0}
                      </div>
                      <div className="text-[#ffffff]">
                        Updated: {inputAnalysisResult.feedback.summary?.totalProjectsUpdated || 0}
                      </div>
                      <div className="text-[#ffffff]">
                        Blocked: {inputAnalysisResult.feedback.summary?.totalProjectsBlocked || 0}
                      </div>
                    </div>

                    {/* Added Projects */}
                    {inputAnalysisResult.feedback.projects.added && inputAnalysisResult.feedback.projects.added.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-[#ffffff] font-medium mb-1">Added Projects:</div>
                        <div className="space-y-1">
                          {inputAnalysisResult.feedback.projects.added.map((project: any, index: number) => (
                            <AddedProjectDetails key={index} project={project} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Updated Projects */}
                    {inputAnalysisResult.feedback.projects.updated && inputAnalysisResult.feedback.projects.updated.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-[#ffffff] font-medium mb-1">Updated Projects:</div>
                        <div className="space-y-1">
                          {inputAnalysisResult.feedback.projects.updated.map((project: any, index: number) => (
                            <UpdatedProjectDetails key={index} project={project} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Blocked Projects */}
                    {inputAnalysisResult.feedback.projects.blocked && inputAnalysisResult.feedback.projects.blocked.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-[#ffffff] font-medium mb-1">Blocked Projects (Duplicates):</div>
                        <div className="space-y-1">
                          {inputAnalysisResult.feedback.projects.blocked.map((project: any, index: number) => (
                            <BlockedProjectDetails key={index} project={project} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Other Sections Feedback */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-[#ffffff]">
                    Team: {inputAnalysisResult.feedback.team?.updated ? 'Updated' : 'No changes'}
                  </div>
                  <div className="text-[#ffffff]">
                    Relations: {inputAnalysisResult.feedback.relations?.updated ? 'Updated' : 'No changes'}
                  </div>
                  <div className="text-[#ffffff]">
                    Funding: {inputAnalysisResult.feedback.funding?.updated ? 'Updated' : 'No changes'}
                  </div>
                  <div className="text-[#ffffff]">
                    Clients: {inputAnalysisResult.feedback.clients?.updated ? 'Updated' : 'No changes'}
                  </div>
                </div>
              </div>
            )}
            
            {/* Results Display */}
            <div className="flex-1 overflow-y-auto analysis-results-container space-y-4">
              {/* Projects */}
              {inputAnalysisResult.projects && inputAnalysisResult.projects.length > 0 && (
                <div className="p-4">
                  <h4 className="text-md font-medium text-[#ffffff] mb-3">Projects ({inputAnalysisResult.projects.length})</h4>
                  <div className="space-y-2">
                    {inputAnalysisResult.projects.map((project: any, index: number) => (
                      <div key={index} className="p-3 text-sm">
                        <div className="text-[#ffffff] font-medium">{project.name || 'Unnamed Project'}</div>
                        {project.size && <div className="text-[#ffffff]">Size: {project.size}</div>}
                        {project.location && <div className="text-[#ffffff]">Location: {project.location}</div>}
                        {project.useCase && <div className="text-[#ffffff]">Use Case: {project.useCase}</div>}
                        {project.description && <div className="text-[#ffffff]">Description: {project.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Team */}
              {inputAnalysisResult.team && Object.keys(inputAnalysisResult.team).length > 0 && (
                <div className="p-4">
                  <h4 className="text-md font-medium text-[#ffffff] mb-3">Team Information</h4>
                  <div className="p-3 text-sm space-y-1">
                    {inputAnalysisResult.team.teamSize && (
                      <div className="text-[#ffffff]">Team Size: {inputAnalysisResult.team.teamSize}</div>
                    )}
                    {inputAnalysisResult.team.numberOfPeople && (
                      <div className="text-[#ffffff]">Number of People: {inputAnalysisResult.team.numberOfPeople}</div>
                    )}
                    {inputAnalysisResult.team.specificArchitects && inputAnalysisResult.team.specificArchitects.length > 0 && (
                      <div className="text-[#ffffff]">Architects: {inputAnalysisResult.team.specificArchitects.join(', ')}</div>
                    )}
                    {inputAnalysisResult.team.roles && inputAnalysisResult.team.roles.length > 0 && (
                      <div className="text-[#ffffff]">Roles: {inputAnalysisResult.team.roles.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Relations */}
              {inputAnalysisResult.relations && Object.keys(inputAnalysisResult.relations).length > 0 && (
                <div className="p-4">
                  <h4 className="text-md font-medium text-[#ffffff] mb-3">Relations</h4>
                  <div className="p-3 text-sm space-y-1">
                    {inputAnalysisResult.relations.constructionCompanies && inputAnalysisResult.relations.constructionCompanies.length > 0 && (
                      <div className="text-[#ffffff]">Construction Companies: {inputAnalysisResult.relations.constructionCompanies.join(', ')}</div>
                    )}
                    {inputAnalysisResult.relations.otherArchOffices && inputAnalysisResult.relations.otherArchOffices.length > 0 && (
                      <div className="text-[#ffffff]">Other Architecture Offices: {inputAnalysisResult.relations.otherArchOffices.join(', ')}</div>
                    )}
                    {inputAnalysisResult.relations.partners && inputAnalysisResult.relations.partners.length > 0 && (
                      <div className="text-[#ffffff]">Partners: {inputAnalysisResult.relations.partners.join(', ')}</div>
                    )}
                    {inputAnalysisResult.relations.collaborators && inputAnalysisResult.relations.collaborators.length > 0 && (
                      <div className="text-[#ffffff]">Collaborators: {inputAnalysisResult.relations.collaborators.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Funding */}
              {inputAnalysisResult.funding && Object.keys(inputAnalysisResult.funding).length > 0 && (
                <div className="p-4">
                  <h4 className="text-md font-medium text-[#ffffff] mb-3">Funding Information</h4>
                  <div className="p-3 text-sm space-y-1">
                    {inputAnalysisResult.funding.budget && (
                      <div className="text-[#ffffff]">Budget: {inputAnalysisResult.funding.budget}</div>
                    )}
                    {inputAnalysisResult.funding.fundingSources && inputAnalysisResult.funding.fundingSources.length > 0 && (
                      <div className="text-[#ffffff]">Funding Sources: {inputAnalysisResult.funding.fundingSources.join(', ')}</div>
                    )}
                    {inputAnalysisResult.funding.financialInfo && (
                      <div className="text-[#ffffff]">Financial Info: {inputAnalysisResult.funding.financialInfo}</div>
                    )}
                    {inputAnalysisResult.funding.investmentDetails && (
                      <div className="text-[#ffffff]">Investment Details: {inputAnalysisResult.funding.investmentDetails}</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Clients */}
              {inputAnalysisResult.clients && Object.keys(inputAnalysisResult.clients).length > 0 && (
                <div className="p-4">
                  <h4 className="text-md font-medium text-[#ffffff] mb-3">Client Information</h4>
                  <div className="p-3 text-sm space-y-1">
                    {inputAnalysisResult.clients.pastClients && inputAnalysisResult.clients.pastClients.length > 0 && (
                      <div className="text-[#ffffff]">Past Clients: {inputAnalysisResult.clients.pastClients.join(', ')}</div>
                    )}
                    {inputAnalysisResult.clients.presentClients && inputAnalysisResult.clients.presentClients.length > 0 && (
                      <div className="text-[#ffffff]">Present Clients: {inputAnalysisResult.clients.presentClients.join(', ')}</div>
                    )}
                    {inputAnalysisResult.clients.clientTypes && inputAnalysisResult.clients.clientTypes.length > 0 && (
                      <div className="text-[#ffffff]">Client Types: {inputAnalysisResult.clients.clientTypes.join(', ')}</div>
                    )}
                    {inputAnalysisResult.clients.clientIndustries && inputAnalysisResult.clients.clientIndustries.length > 0 && (
                      <div className="text-[#ffffff]">Client Industries: {inputAnalysisResult.clients.clientIndustries.join(', ')}</div>
                    )}
                  </div>
                </div>
              )}
              
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
                                        <td className="py-0 text-[#ffffff] border-r border-white">
                                          <div className="pl-[13px]">
                                            <div className="font-medium text-[#ffffff]">{office.name}</div>
                                            {office.phone && <div className="text-xs text-[#ffffff]">Phone: {office.phone}</div>}
                                          </div>
                                        </td>
                                        <td className="py-0 pl-[5px] text-[#ffffff] border-r border-white">
                                          {office.address || 'No address available'}
                                        </td>
                                        <td className="py-0 pl-[5px] text-[#ffffff] border-r border-white">
                                          {office.website ? (
                                            createTrackedLink(
                                              office.website.startsWith('http') ? office.website : `https://${office.website}`,
                                              office.website.replace(/^https?:\/\//, ''),
                                              {
                                                officeId: office.uniqueId || `${office.name}-${office.address}`,
                                                officeName: office.name,
                                                website: office.website
                                              },
                                              "text-[#ffffff] cursor-pointer"
                                            )
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