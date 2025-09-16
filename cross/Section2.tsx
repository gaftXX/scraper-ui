'use client';

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ScraperConfig, SearchCategory, SEARCH_CATEGORIES, CategoryConfig } from './types';
import { getCitiesByCountry } from './countries';
import Tooltip from './components/tooltip/Tooltip';
import { InlookConfig, InlookState, InlookProgress, InlookResult } from './inlookTypes';

interface Section2Props {
  config: ScraperConfig;
  progress: any;
  currentSearchTerms: string[];
  getIntensityLevel: (maxResults: number, searchRadius: number) => number;
  handleIntensityChange: (intensity: number) => void;
  handleCategorySelection: (categoryId: SearchCategory, selected: boolean) => void;
  handleCitySelection: (city: string, selected: boolean) => void;
  startScraping: () => void;
  results: any;
  logs: string[];
  onCompendiumClick: () => void;
  onSystemClick: () => void;
  resetFocusTrigger: number;
  setInlookState: (state: InlookState | ((prev: InlookState) => InlookState)) => void;
  setShowInlook: (show: boolean) => void;
  inlookDisabled: boolean;
}

// City lists are now handled by the centralized country configuration

const Section2 = forwardRef<any, Section2Props>(({
  config,
  progress,
  currentSearchTerms,
  getIntensityLevel,
  handleIntensityChange,
  handleCategorySelection,
  handleCitySelection,
  startScraping,
  results,
  logs,
  onCompendiumClick,
  onSystemClick,
  resetFocusTrigger,
  setInlookState,
  setShowInlook,
  inlookDisabled
}, ref) => {
  // Get cities based on selected country using centralized configuration
  const getCitiesForCountry = () => {
    const countryId = config.country || 'latvia';
    return getCitiesByCountry(countryId).map(city => city.name);
  };
  
  const currentCities = getCitiesForCountry();
  // Create refs for all cities upfront
  const cityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Create refs for all categories upfront
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Create refs for intensity buttons
  const intensityRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Add state for scraper focus mode
  const [isScraperFocus, setIsScraperFocus] = useState(false);

  // Add state for dashboard focus mode
  const [isDashboardFocus, setIsDashboardFocus] = useState(false);

  // Add state for inlook focus mode
  const [isInlookFocus, setIsInlookFocus] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState<any>(null);

  // Add state for cross visibility
  const [isCrossVisible, setIsCrossVisible] = useState(true);

  // Add keyboard event listener
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only allow Shift+S toggle when scraper is not running and not in inlook focus
      if (event.key.toLowerCase() === 's' && event.shiftKey && progress.status !== 'running' && !isInlookFocus) {
        setIsScraperFocus(prev => !prev); // Toggle the state
        setIsDashboardFocus(false); // Close dashboard focus when opening scraper focus
        setIsInlookFocus(false); // Close inlook focus when opening scraper focus
        setIsCrossVisible(true); // Show cross when entering scraper focus
      }
      
      // Allow Shift+D toggle even when scraper is running
      if (event.key.toLowerCase() === 'd' && event.shiftKey) {
        setIsDashboardFocus(prev => !prev); // Toggle the state
        setIsScraperFocus(false); // Close scraper focus when opening dashboard focus
        setIsInlookFocus(false); // Close inlook focus when opening dashboard focus
        setIsCrossVisible(true); // Show cross when entering dashboard focus
      }

      // Escape key to exit inlook focus mode
      if (event.key === 'Escape' && isInlookFocus) {
        setIsInlookFocus(false);
        setSelectedOffice(null);
      }

      // Toggle cross visibility with Shift+H
      if (event.key.toLowerCase() === 'h' && event.shiftKey) {
        console.log('Shift+H pressed - toggling cross visibility');
        setIsCrossVisible(prev => !prev); // Toggle cross visibility
      }

      // Start scraper with Enter when in scraper focus and not running
      if (event.key === 'Enter' && isScraperFocus && progress.status !== 'running' && (config.cities?.length || 0) > 0) {
        event.preventDefault();
        startScraping();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [progress.status, isScraperFocus, isDashboardFocus, isInlookFocus, isCrossVisible, config.cities?.length]); // Include all state dependencies

  // Reset focus states when resetFocusTrigger changes
  useEffect(() => {
    if (resetFocusTrigger > 0) {
      setIsScraperFocus(false);
      setIsDashboardFocus(false);
      setIsInlookFocus(false);
      setSelectedOffice(null);
      setIsCrossVisible(true); // Show cross when resetting focus
    }
  }, [resetFocusTrigger]);

  // Handle inlook focus activation
  const handleInlookFocusActivate = (office: any) => {
    setSelectedOffice(office);
    setIsInlookFocus(true);
    setIsScraperFocus(false);
    setIsDashboardFocus(false);
    setIsCrossVisible(true);
  };

  // Expose handleInlookFocusActivate to parent component
  useImperativeHandle(ref, () => ({
    handleInlookFocusActivate
  }));

  // Inlook scraper function
  const startInlookScraping = async () => {
    if (!selectedOffice || !selectedOffice.website) {
      console.error('No office selected or no website available');
      return;
    }

    // Switch to Inlook state
    setShowInlook(true);

    setInlookState({
      isRunning: true,
      progress: null,
      result: null,
      error: null,
      logs: []
    });

    try {
      const config: InlookConfig = {
        websiteUrl: selectedOffice.website.startsWith('http') ? selectedOffice.website : `https://${selectedOffice.website}`,
        maxDepth: 3,
        includeImages: true,
        includeProjects: true,
        includeTeam: true,
        includeAwards: true,
        includePublications: true,
        timeout: 30000,
        followRedirects: true,
        respectRobotsTxt: true
      };

      const response = await fetch('/api/inlook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleInlookEvent(data);
            } catch (error) {
              console.error('Error parsing SSE data:', error);
            }
          }
        }
      }
    } catch (error) {
      setInlookState(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  };

  const handleInlookEvent = (data: any) => {
    switch (data.type) {
      case 'progress':
        setInlookState(prev => ({ ...prev, progress: data.progress }));
        break;
      case 'log':
        setInlookState(prev => ({ 
          ...prev, 
          logs: [...prev.logs, data.message] 
        }));
        break;
      case 'complete':
        setInlookState(prev => ({ 
          ...prev, 
          isRunning: false, 
          result: data.result,
          progress: { ...prev.progress!, status: 'completed' }
        }));
        break;
      case 'error':
        setInlookState(prev => ({ 
          ...prev, 
          isRunning: false, 
          error: data.error 
        }));
        break;
    }
  };

  // Helper function to get intensity level name
  const getIntensityName = (maxResults: number, searchRadius: number): string => {
    const level = getIntensityLevel(maxResults, searchRadius);
    switch (level) {
      case 1: return "LIGHT";
      case 2: return "MEDIUM";
      case 3: return "NORMAL";
      case 4: return "HEAVY";
      case 5: return "INTENSE";
      default: return "LIGHT";
    }
  };

  const getCategoryName = (categoryId: string) => {
    const categoryMap: any = {
      'architecture-only': 'Pure Architecture',
      'construction': 'Construction',
      'interior-design': 'Interior Design',
      'property-development': 'Property Development'
    };
    return categoryMap[categoryId] || categoryId;
  };

  const getCategoryLetter = (categoryId: string): string => {
    const letterMap: any = {
      'architecture-only': 'A',
      'construction': 'C',
      'interior-design': 'I',
      'property-development': 'P'
    };
    return letterMap[categoryId];
  };

  return (
    <div className="col-span-1 h-full relative z-[9999]">
      <div className="h-full flex flex-col p-4 items-center justify-center relative">
        
        {/* Vertical line in the middle */}
        <div 
          className="absolute transition-opacity duration-300"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: isCrossVisible ? 1 : 0
          }}
        >
          {/* Top part of the line */}
          <div 
            className="absolute"
            style={{
              width: '16px',
              height: '500px',
              left: '50%',
              top: '-508px',
              transform: 'translateX(-50%)',
              zIndex: 1
            }}
          >
            <div className="absolute w-full h-full">
              {/* Solid section (250px from center) */}
              <div 
                className="absolute w-full bg-white"
                style={{
                  height: '250px',
                  bottom: 0,
                  opacity: 1
                }}
              />
              {/* Faded section */}
              <div 
                className="absolute w-full bg-white transition-opacity duration-300"
                style={{
                  height: 'calc(100% - 250px)',
                  top: 0,
                  opacity: isScraperFocus ? 1 : 0.1
                }}
              />
            </div>
          </div>
          
          {/* Slider positioned along the top segment */}
          <div 
            className={`absolute transition-opacity duration-300 ${isScraperFocus ? 'opacity-100' : 'opacity-0'}`}
            style={{
              width: '20px',
              height: '300px',
              left: '50%',
              top: '-378px',
              transform: 'translateX(-50%)',
              zIndex: 2,
              position: 'absolute'
            }}
          >
            {/* Intensity buttons with hover areas */}
            <div className="flex flex-col justify-between h-full items-center">
              {[5, 4, 3, 2, 1].map((level) => (
                <div
                  key={level}
                  ref={(el: HTMLDivElement | null) => {
                    if (intensityRefs.current) intensityRefs.current[level] = el;
                  }}
                  className="relative"
                  style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: isScraperFocus ? 'auto' : 'none'
                  }}
                >
                  <button
                    onClick={() => handleIntensityChange(level)}
                    className={`w-[14px] h-[14px] bg-[#393837] hover:bg-white hover:text-[#393837] transition-colors duration-300 text-[8px] ${
                      getIntensityLevel(config.maxResults || 20, config.searchRadius || 10) === level
                        ? 'bg-white text-[#393837]'
                        : 'text-white'
                    }`}
                    style={{
                      border: 'none',
                      cursor: isScraperFocus && progress.status !== 'running' ? 'pointer' : 'default',
                      outline: 'none'
                    }}
                    disabled={!isScraperFocus || progress.status === 'running'}
                  >
                    {level}
                  </button>
                  {isScraperFocus && progress.status !== 'running' && (
                    <Tooltip targetRef={{ current: intensityRefs.current[level] }}>
                      {(() => {
                        switch (level) {
                          case 5: return "INTENSE";
                          case 4: return "HEAVY";
                          case 3: return "NORMAL";
                          case 2: return "MEDIUM";
                          case 1: return "LIGHT";
                          default: return "";
                        }
                      })()}
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Left horizontal line */}
          <div 
            className="absolute"
            style={{
              width: '1000px',
              height: '16px',
              left: '0',
              top: '50%',
              transform: 'translate(calc(-100% - 8px), -50%)',
              opacity: progress.status === 'running' ? 0 : 1
            }}
          >
            <style jsx global>{`
                              /* City radio styles */
              .city-radio {
                opacity: 1 !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                appearance: none !important;
                width: 14px !important;
                height: 14px !important;
                background-color: #393837 !important;
                cursor: pointer;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                outline: none !important;
                box-shadow: none !important;
                transition: background-color 0.3s ease !important;
              }

              .city-radio:hover {
                background-color: white !important;
              }

              .city-radio:checked {
                background-color: white !important;
              }

              .city-letter {
                opacity: 1 !important;
                color: white !important;
                transition: color 0.3s ease !important;
              }

              .city-radio:hover ~ .city-letter {
                color: #393837 !important;
              }

              .city-radio:checked ~ .city-letter {
                color: #393837 !important;
              }

                /* Category checkbox styles */
                .category-checkbox {
                  opacity: 1 !important;
                  -webkit-appearance: none !important;
                  -moz-appearance: none !important;
                  appearance: none !important;
                  width: 14px !important;
                  height: 14px !important;
                  background-color: #393837 !important;
                  cursor: pointer;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border-radius: 0 !important;
                  outline: none !important;
                  box-shadow: none !important;
                }

                .category-checkbox:checked {
                  background-color: white !important;
                }

                .category-letter {
                  opacity: 1 !important;
                  color: white !important;
                }

                .category-checkbox:checked ~ .category-letter {
                  color: #393837 !important;
                }
              `}</style>

            <div className="absolute w-full h-full">
              {/* Solid section (250px from center) */}
              <div 
                className="absolute h-full bg-white"
                style={{
                  width: '250px',
                  right: 0,
                  opacity: 1
                }}
              />
              {/* Faded section */}
              <div 
                className="absolute h-full bg-white transition-opacity duration-300"
                style={{
                  width: 'calc(100% - 250px)',
                  left: 0,
                  opacity: (isScraperFocus || isInlookFocus) ? 1 : 0.1
                }}
              />
            </div>
            
            {/* City Selection buttons */}
            <div 
              className={`absolute transition-opacity duration-300 ${isScraperFocus ? 'opacity-100' : 'opacity-0'}`}
              style={{
                right: '50px',
                top: '50%',
                width: '930px',
                display: 'flex',
                flexDirection: 'row-reverse',
                gap: '50px',
                flexWrap: 'nowrap',
                alignItems: 'center',
                justifyContent: 'flex-start',
                transform: 'translateY(calc(-50% - 1px))',
                pointerEvents: isScraperFocus ? 'auto' : 'none'
              }}
            >
              {currentCities.map((city: string) => (
                <div key={city} className="relative">
                  <label className="flex flex-col items-center gap-1 px-2 py-1 rounded bg-opacity-80" style={{ cursor: 'default' }}>
                    <div 
                      ref={(el: HTMLDivElement | null) => {
                        if (cityRefs.current) cityRefs.current[city] = el;
                      }}
                      className="relative"
                      style={{
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <div className="relative" style={{ width: '14px', height: '14px' }}>
                        <input
                          type="radio"
                          name="city-selection"
                          checked={config.cities?.includes(city) || false}
                          onChange={(e) => handleCitySelection(city, e.target.checked)}
                          className="city-radio absolute inset-0"
                          style={{
                            cursor: isScraperFocus && progress.status !== 'running' ? 'pointer' : 'default'
                          }}
                          disabled={!isScraperFocus || progress.status === 'running'}
                        />
                        <span className="city-letter absolute inset-0 flex items-center justify-center text-[8px]">
                          {city[0]}
                        </span>
                      </div>
                    </div>
                  </label>
                  {isScraperFocus && progress.status !== 'running' && (
                    <Tooltip targetRef={{ current: cityRefs.current[city] }}>
                      {city}
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>

            {/* Inlook button positioned on the left line */}
            <div 
              className={`absolute transition-opacity duration-300 ${isInlookFocus ? 'opacity-100' : 'opacity-0'}`}
              style={{
                right: '50px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 3,
                pointerEvents: isInlookFocus ? 'auto' : 'none'
              }}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Inlook button clicked - starting website scraping');
                  startInlookScraping();
                }}
                disabled={!isInlookFocus}
                className={`transition-colors ${
                  !isInlookFocus
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
                style={{
                  width: '130px',
                  height: '15px',
                  backgroundColor: '#393837',
                  padding: '0 8px',
                  border: 'none',
                  cursor: isInlookFocus ? 'pointer' : 'not-allowed',
                  color: 'white',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                type="button"
                title={!isInlookFocus ? 'Inlook mode not active'
                  : 'Inlook Button (Click to scrape website)'
                }
              >
                MAKE A INLOOK
              </button>
            </div>
          </div>
          
          {/* Right horizontal line */}
          <div 
            className="absolute"
            style={{
              width: '1000px',
              height: '16px',
              left: '8px',
              top: '50%',
              transform: 'translate(0, -50%)',
              opacity: progress.status === 'running' ? 0 : 1
            }}
          >
            <div className="absolute w-full h-full">
              {/* Solid section (250px from center) */}
              <div 
                className="absolute h-full bg-white"
                style={{
                  width: '250px',
                  left: 0,
                  opacity: 1
                }}
              />
              {/* Faded section */}
              <div 
                className="absolute h-full bg-white transition-opacity duration-300"
                style={{
                  width: 'calc(100% - 250px)',
                  right: 0,
                  opacity: isDashboardFocus ? 1 : 0.1
                }}
              />
            </div>
            
            {/* Dashboard buttons positioned on the right line */}
            <div 
              className={`absolute transition-opacity duration-300 ${isDashboardFocus ? 'opacity-100' : 'opacity-0'}`}
              style={{
                left: '50px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 3,
                pointerEvents: isDashboardFocus ? 'auto' : 'none'
              }}
            >
              <div className="flex space-x-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('Dashboard button clicked');
                    setIsDashboardFocus(false); // Reset dashboard focus state
                    setIsScraperFocus(false); // Reset scraper focus state
                    onCompendiumClick(); // Call the parent handler
                  }}
                  disabled={!isDashboardFocus}
                  className={`transition-colors ${
                    !isDashboardFocus
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  style={{
                    width: '80px',
                    height: '15px',
                    backgroundColor: '#393837',
                    padding: '0 8px',
                    border: 'none',
                    cursor: isDashboardFocus ? 'pointer' : 'not-allowed',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  type="button"
                  title={!isDashboardFocus ? 'Press Shift+D to enable dashboard mode'
                    : 'Dashboard Button (Click to interact)'
                  }
                >
                  COMPENDIUM
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('System button clicked');
                    setIsDashboardFocus(false); // Reset dashboard focus state
                    setIsScraperFocus(false); // Reset scraper focus state
                    onSystemClick(); // Call the parent handler
                  }}
                  disabled={!isDashboardFocus || progress.status === 'running'}
                  className={`transition-colors ${
                    !isDashboardFocus || progress.status === 'running'
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                  style={{
                    width: '50px',
                    height: '15px',
                    backgroundColor: '#393837',
                    padding: '0 8px',
                    border: 'none',
                    cursor: isDashboardFocus && progress.status !== 'running' ? 'pointer' : 'not-allowed',
                    color: 'white',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  type="button"
                  title={!isDashboardFocus ? 'Press Shift+D to enable dashboard mode'
                    : progress.status === 'running' ? 'System unavailable while scraper is running'
                    : 'System Button (Click to interact)'
                  }
                >
                  SYSTEM
                </button>
              </div>
            </div>
          </div>
          
          {/* Bottom part of the line */}
          <div 
            className="absolute"
            style={{
              width: '16px',
              height: '500px',
              left: '50%',
              top: '8px',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="absolute w-full h-full">
              {/* Solid section (250px from center) */}
              <div 
                className="absolute w-full bg-white"
                style={{
                  height: '250px',
                  top: 0,
                  opacity: 1
                }}
              />
              {/* Faded section */}
              <div 
                className="absolute w-full bg-white transition-opacity duration-300"
                style={{
                  height: 'calc(100% - 250px)',
                  bottom: 0,
                  opacity: isScraperFocus ? 1 : 0.1
                }}
              />
            </div>
          </div>
          
          {/* Transparent box in the middle of the vertical line */}
          <div 
            className="absolute"
            style={{
              width: '16px',
              height: '16px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'transparent',
              zIndex: 2
            }}
          />
          
          {/* Category checkboxes positioned along the bottom segment */}
          <div 
            className={`absolute transition-opacity duration-300 ${isScraperFocus ? 'opacity-100' : 'opacity-0'}`}
            style={{
              width: '180px',
              height: '300px',
              left: 'calc(50% + 0.2px)',
              top: '30px',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              pointerEvents: isScraperFocus ? 'auto' : 'none'
            }}
          >
            <style jsx>{`
              .category-checkbox {
                opacity: 1;
              }

              .category-letter {
                opacity: 1;
              }

              .category-checkbox:checked {
                opacity: 1;
              }

              .category-checkbox:checked + .category-letter {
                opacity: 1;
              }

              .category-letter.disabled {
                opacity: 0;
              }
            `}</style>

            <div className="w-full px-2 flex flex-col items-center">
              {SEARCH_CATEGORIES.map((category: CategoryConfig) => (
                <div 
                  key={category.id} 
                  className="relative w-full flex items-center justify-center" 
                  style={{ marginTop: '25px', marginBottom: '25px' }}
                >
                  <div 
                    ref={(el: HTMLDivElement | null) => {
                      if (categoryRefs.current) categoryRefs.current[category.id] = el;
                    }}
                    className="relative"
                    style={{
                      width: '40px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="category-checkbox"
                        checked={config.searchCategories?.includes(category.id) || false}
                        onChange={(e) => handleCategorySelection(category.id, e.target.checked)}
                        style={{
                          cursor: isScraperFocus && progress.status !== 'running' ? 'pointer' : 'default'
                        }}
                        disabled={!isScraperFocus || progress.status === 'running'}
                      />
                      <span className="category-letter" data-category={category.id}>
                        {getCategoryLetter(category.id)}
                      </span>
                    </div>
                  </div>
                  {isScraperFocus && progress.status !== 'running' && (
                    <Tooltip targetRef={{ current: categoryRefs.current[category.id] }}>
                      {getCategoryName(category.id)}
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>

            {/* Update the global styles for checkboxes */}
            <style jsx global>{`
              /* City radio styles */
              .city-radio {
                opacity: 1 !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                appearance: none !important;
                width: 14px !important;
                height: 14px !important;
                background-color: #393837 !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                outline: none !important;
                box-shadow: none !important;
                position: relative;
                transition: background-color 0.3s ease !important;
              }

              .city-radio:hover {
                background-color: white !important;
              }

              .city-radio:checked {
                background-color: white !important;
              }

              .city-letter {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                pointer-events: none;
                opacity: 1 !important;
                transition: color 0.3s ease !important;
              }

              .city-radio:hover ~ .city-letter {
                color: #393837;
              }

              .city-radio:checked ~ .city-letter {
                color: #393837;
              }

              /* Category checkbox styles */
              .category-checkbox {
                opacity: 1 !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                appearance: none !important;
                width: 14px !important;
                height: 14px !important;
                background-color: #393837 !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                outline: none !important;
                box-shadow: none !important;
                position: relative !important;
                display: block !important;
                transition: background-color 0.3s ease !important;
              }

              .category-checkbox:hover {
                background-color: white !important;
              }

              .category-checkbox:checked {
                background-color: white !important;
              }

              .category-letter {
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                color: white !important;
                font-size: 12px !important;
                pointer-events: none !important;
                opacity: 1 !important;
                z-index: 2 !important;
                user-select: none !important;
                display: block !important;
                width: auto !important;
                height: auto !important;
                line-height: 1 !important;
                transition: color 0.3s ease !important;
              }

              .category-checkbox:hover ~ .category-letter {
                color: #393837 !important;
              }

              .category-checkbox:checked ~ .category-letter {
                color: #393837 !important;
              }
            `}</style>
          </div>
        </div>

        {/* Start button positioned in the center */}
        <div 
          className={`absolute transition-opacity duration-300 ${isScraperFocus ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: '50%',
            top: 'calc(50% + 2px)',
            transform: 'translate(-50%, -50%)',
            zIndex: 3,
            pointerEvents: isScraperFocus ? 'auto' : 'none'
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              console.log('Start Scraping button clicked by user');
              setIsScraperFocus(false); // Reset focus state when scraping starts
              setIsDashboardFocus(false); // Reset dashboard focus state when scraping starts
              startScraping();
            }}
            disabled={!isScraperFocus || progress.status === 'running' || (config.cities?.length || 0) === 0}
            className={`transition-colors ${
              !isScraperFocus || progress.status === 'running' || (config.cities?.length || 0) === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            style={{
              width: '16px',
              height: '18px',
              backgroundColor: 'transparent',
              padding: 0,
              border: 'none',
              cursor: isScraperFocus ? 'pointer' : 'not-allowed'
            }}
            onMouseEnter={(e) => {
              if (isScraperFocus && progress.status !== 'running' && (config.cities?.length || 0) > 0) {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (isScraperFocus && progress.status !== 'running' && (config.cities?.length || 0) > 0) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            type="button"
            title={!isScraperFocus ? 'Press Shift+S to enable scraper mode'
              : progress.status === 'running' ? 'Scraping in Progress...'
              : `Start Scraper at ${getIntensityName(config.maxResults || 20, config.searchRadius || 10)} Intensity (Click to Confirm)`
            }
          />
        </div>

        {/* Inlook Focus Mode Display */}
        {isInlookFocus && selectedOffice && (
          <div 
            className="absolute transition-opacity duration-300 opacity-100"
            style={{
              right: '100%',
              top: '29%',
              zIndex: 4,
              backgroundColor: 'transparent',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '300px',
              maxWidth: '500px'
            }}
          >
            <div className="text-white">
              <div className="space-y-2">
                <div>
                  {selectedOffice.modifiedName || selectedOffice.name}
                </div>
                {selectedOffice.uniqueId && (
                  <div className="font-mono text-sm">
                    {selectedOffice.uniqueId}
                  </div>
                )}
                <div>
                  {selectedOffice.address || 'N/A'}
                </div>
                {selectedOffice.phone && (
                  <div>
                    {selectedOffice.phone}
                  </div>
                )}
                {selectedOffice.website && (
                  <div>
                    <a 
                      href={selectedOffice.website.startsWith('http') ? selectedOffice.website : `https://${selectedOffice.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white no-underline"
                    >
                      {selectedOffice.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-4 text-center text-sm text-gray-300">
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4 flex-1 overflow-y-auto w-full">
          <div>
            {/* Removed the horizontal slider - now it's vertical on the line */}
          </div>

          {/* **CATEGORY SELECTION MOVED TO BOTTOM SEGMENT** */}
        </div>
      </div>
    </div>
  );
});

Section2.displayName = 'Section2';

export default Section2; 