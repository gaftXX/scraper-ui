'use client';

import React, { useRef } from 'react';
import { ScraperConfig, SearchCategory, SEARCH_CATEGORIES } from '../types';
import Tooltip from './Tooltip';

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
}

const LATVIAN_CITIES = [
  'Rīga',        // ~632,000
  'Daugavpils',  // ~82,000
  'Liepāja',     // ~68,000
  'Jelgava',     // ~56,000
  'Jūrmala',     // ~49,000
  'Ventspils',   // ~34,000
  'Rēzekne',     // ~27,000
  'Valmiera',    // ~23,000
  'Jēkabpils',   // ~22,000
  'Cēsis'        // ~15,000
]; // Removed reverse() to show largest cities on the left

export default function Section2({
  config,
  progress,
  currentSearchTerms,
  getIntensityLevel,
  handleIntensityChange,
  handleCategorySelection,
  handleCitySelection,
  startScraping,
  results,
  logs
}: Section2Props) {
  // Create refs for all cities upfront
  const cityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Create refs for all categories upfront
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Create refs for intensity buttons
  const intensityRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

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
      'architecture-only': 'Architecture',
      'construction-architecture': 'Construction + Architecture',
      'design-services': 'Interior Design',
      'property-development': 'Property Development',
      'engineering-services': 'Engineering & Technical Services',
      'uncategorized': 'Uncategorized'
    };
    return categoryMap[categoryId] || categoryId;
  };

  const getCategoryLetter = (categoryId: string): string => {
    const letterMap: any = {
      'architecture-only': 'A',
      'construction-architecture': 'C',
      'design-services': 'I',
      'property-development': 'P',
      'engineering-services': 'E',
      'uncategorized': 'U'
    };
    return letterMap[categoryId];
  };

  // Helper function to check if Section1 has no content
  const hasNoSection1Content = (): boolean => {
    return progress.status !== 'running' && !results && logs.length === 0;
  };

  return (
    <div className="col-span-1 h-full">
      <div className="h-full flex flex-col p-4 items-center justify-center relative">
        
        {/* Vertical line in the middle */}
        <div 
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Top part of the line - NOW THE SLIDER */}
          <div 
            className="absolute bg-white group/top-vertical"
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
              {/* Top section of vertical line (fades) */}
              <div 
                className="absolute w-full transition-opacity duration-300"
                style={{
                  height: 'calc(50% - 150px)',
                  top: 0,
                  opacity: 'var(--line-opacity, 0.1)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
              {/* Middle section of vertical line (stays solid) */}
              <div 
                className="absolute w-full"
                style={{
                  height: '300px',
                  top: 'calc(50% - 150px)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
              {/* Bottom section of vertical line (fades) */}
              <div 
                className="absolute w-full transition-opacity duration-300"
                style={{
                  height: 'calc(50% - 150px)',
                  bottom: 0,
                  opacity: 'var(--line-opacity, 0.1)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
            </div>
          </div>
          
          {/* Slider positioned along the top segment */}
          <div 
            className="group/vertical-line"
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
                  className={`relative ${progress.status !== 'running' ? 'opacity-0 group-hover/vertical-line:opacity-100' : 'opacity-0'} transition-opacity duration-200`}
                  style={{
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
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
                      cursor: progress.status !== 'running' ? 'pointer' : 'default',
                      outline: 'none'
                    }}
                    disabled={progress.status === 'running'}
                  >
                    {level}
                  </button>
                  {progress.status !== 'running' && (
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

          {/* Left horizontal line with city selection */}
          {hasNoSection1Content() && (
            <div 
              className="group/left-line absolute"
              style={{
                width: '1000px',
                height: '16px',
                left: '0',
                top: '50%',
                transform: 'translate(calc(-100% - 8px), -50%)'
              }}
            >
              <style jsx global>{`
                @keyframes pulse {
                  0%, 100% { background-color: #393837 !important; }
                  50% { background-color: white !important; }
                }

                .city-checkbox {
                  opacity: 0;
                  transition: opacity 0.2s ease-in-out;
                }

                .group-hover\/left-line .city-checkbox {
                  opacity: 1;
                }

                .city-checkbox:checked {
                  opacity: 1 !important;
                  animation: pulse 3s infinite ease-in-out !important;
                  background-color: white !important;
                }

                .city-checkbox {
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

                .city-checkbox::-webkit-checkbox {
                  -webkit-appearance: none !important;
                  appearance: none !important;
                  width: 14px !important;
                  height: 14px !important;
                  background-color: #393837 !important;
                  border: none !important;
                  border-radius: 0 !important;
                }

                .city-checkbox::-moz-checkbox {
                  -moz-appearance: none !important;
                  appearance: none !important;
                  width: 14px !important;
                  height: 14px !important;
                  background-color: #393837 !important;
                  border: none !important;
                  border-radius: 0 !important;
                }

                .city-checkbox:checked::-webkit-checkbox {
                  animation: pulse 3s infinite ease-in-out !important;
                  background-color: white !important;
                }

                .city-checkbox:checked::-moz-checkbox {
                  animation: pulse 3s infinite ease-in-out !important;
                  background-color: white !important;
                }

                .city-checkbox:focus {
                  outline: none !important;
                  border: none !important;
                  box-shadow: none !important;
                }

                .city-checkbox::-ms-check {
                  display: none;
                }

                .city-letter {
                  opacity: 0;
                  transition: opacity 0.2s ease-in-out;
                }

                .group-hover\/left-line .city-letter,
                .city-checkbox:checked + .city-letter {
                  opacity: 1;
                }

                .group\/top-vertical:hover {
                  --line-opacity: 1;
                }

                .group\/bottom-vertical:hover {
                  --line-opacity: 1;
                }

                .group\/left-line:hover {
                  --line-opacity: 1;
                }

                .group\/right-line:hover {
                  --line-opacity: 1;
                }
              `}</style>

              {/* White line background with fading sections */}
              <div className="absolute w-full h-full">
                {/* Left section (fades) */}
                <div 
                  className="absolute h-full transition-opacity duration-300"
                  style={{
                    width: 'calc(100% - 150px)',
                    left: 0,
                    opacity: 'var(--line-opacity, 0.1)'
                  }}
                >
                  <div className="w-full h-full bg-white" />
                </div>
                {/* Right section (stays solid) */}
                <div 
                  className="absolute h-full"
                  style={{
                    width: '150px',
                    right: 0
                  }}
                >
                  <div className="w-full h-full bg-white" />
                </div>
              </div>
              
              {/* City Selection on the line - starts 50px from middle */}
              <div 
                className="absolute"
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
                  transform: 'translateY(calc(-50%))'
                }}
              >
                {LATVIAN_CITIES.map((city: string) => (
                  <div key={city} className="relative">
                    <label className="flex flex-col items-center gap-1 px-2 py-1 rounded cursor-pointer bg-opacity-80">
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
                            type="checkbox"
                            checked={config.cities?.includes(city) || false}
                            onChange={(e) => handleCitySelection(city, e.target.checked)}
                            className="city-checkbox absolute inset-0"
                            style={{
                              WebkitAppearance: 'none',
                              MozAppearance: 'none',
                              appearance: 'none',
                              width: '14px',
                              height: '14px',
                              backgroundColor: '#393837',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              borderRadius: 0,
                              outline: 'none',
                              boxShadow: 'none',
                              cursor: 'pointer',
                              zIndex: 10
                            }}
                          />
                          <span 
                            className={`city-letter absolute inset-0 flex items-center justify-center text-[8px] ${
                              config.cities?.includes(city)
                                ? 'text-[#393837]'
                                : 'text-white'
                            } ${progress.status !== 'running' ? 'opacity-0 group-hover/left-line:opacity-100' : 'opacity-0'}`}
                            style={{
                              pointerEvents: 'none'
                            }}
                          >
                            {city[0]}
                          </span>
                        </div>
                      </div>
                      {progress.status !== 'running' && (
                        <Tooltip targetRef={{ current: cityRefs.current[city] }}>
                          {city}
                        </Tooltip>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Right horizontal line */}
          {hasNoSection1Content() && (
            <div 
              className="group/right-line absolute"
              style={{
                width: '1000px',
                height: '16px',
                left: '8px',
                top: '50%',
                transform: 'translate(0, -50%)'
              }}
            >
              {/* White line background with fading sections */}
              <div className="absolute w-full h-full">
                {/* Left section (stays solid) */}
                <div 
                  className="absolute h-full"
                  style={{
                    width: '150px',
                    left: 0
                  }}
                >
                  <div className="w-full h-full bg-white" />
                </div>
                {/* Right section (fades) */}
                <div 
                  className="absolute h-full transition-opacity duration-300"
                  style={{
                    width: 'calc(100% - 150px)',
                    right: 0,
                    opacity: 'var(--line-opacity, 0.1)'
                  }}
                >
                  <div className="w-full h-full bg-white" />
                </div>
              </div>
            </div>
          )}
          
          {/* Bottom part of the line */}
          <div 
            className="absolute bg-white group/bottom-vertical"
            style={{
              width: '16px',
              height: '500px',
              left: '50%',
              top: '8px',
              transform: 'translateX(-50%)'
            }}
          >
            <div className="absolute w-full h-full">
              {/* Top section of vertical line (fades) */}
              <div 
                className="absolute w-full transition-opacity duration-300"
                style={{
                  height: 'calc(50% - 150px)',
                  top: 0,
                  opacity: 'var(--line-opacity, 0.1)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
              {/* Middle section of vertical line (stays solid) */}
              <div 
                className="absolute w-full"
                style={{
                  height: '300px',
                  top: 'calc(50% - 150px)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
              {/* Bottom section of vertical line (fades) */}
              <div 
                className="absolute w-full transition-opacity duration-300"
                style={{
                  height: 'calc(50% - 150px)',
                  bottom: 0,
                  opacity: 'var(--line-opacity, 0.1)'
                }}
              >
                <div className="w-full h-full bg-white" />
              </div>
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
            className="group/bottom-line absolute"
            style={{
              width: '180px',
              height: '300px',
              left: 'calc(50% + 0.2px)',
              top: '30px',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center'
            }}
          >
            <style jsx>{`
              .category-checkbox {
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
              }

              .group-hover\/bottom-line .category-checkbox {
                opacity: 1;
              }

              .category-checkbox:checked {
                opacity: 1 !important;
              }

              .category-letter {
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
              }

              .group-hover\/bottom-line .category-letter,
              .category-checkbox:checked + .category-letter {
                opacity: 1;
              }
            `}</style>

            <style jsx global>{`
              .category-checkbox {
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
              }

              .group-hover\/right-line .category-checkbox:not(:disabled) {
                opacity: 1;
              }

              .category-checkbox:checked:not(:disabled) {
                opacity: 1 !important;
                animation: pulse 3s infinite ease-in-out !important;
                background-color: white !important;
              }

              .category-checkbox {
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

              .category-checkbox:disabled {
                cursor: default !important;
                opacity: 0 !important;
              }

              .category-checkbox::-webkit-checkbox {
                -webkit-appearance: none !important;
                appearance: none !important;
                width: 14px !important;
                height: 14px !important;
                background-color: #393837 !important;
                border: none !important;
                border-radius: 0 !important;
              }

              .category-checkbox::-moz-checkbox {
                -moz-appearance: none !important;
                appearance: none !important;
                width: 14px !important;
                height: 14px !important;
                background-color: #393837 !important;
                border: none !important;
                border-radius: 0 !important;
              }

              .category-checkbox:checked:not(:disabled)::-webkit-checkbox {
                animation: pulse 3s infinite ease-in-out !important;
                background-color: white !important;
              }

              .category-checkbox:checked:not(:disabled)::-moz-checkbox {
                animation: pulse 3s infinite ease-in-out !important;
                background-color: white !important;
              }

              .category-checkbox:focus {
                outline: none !important;
                border: none !important;
                box-shadow: none !important;
              }

              .category-checkbox::-ms-check {
                display: none;
              }

              .category-letter {
                opacity: 0;
                transition: opacity 0.2s ease-in-out;
              }

              .group-hover\/right-line .category-letter:not(.disabled),
              .category-checkbox:checked:not(:disabled) + .category-letter {
                opacity: 1;
              }

              .category-letter.disabled {
                opacity: 0 !important;
              }

              .group\/top-vertical:hover {
                --line-opacity: 1;
              }

              .group\/bottom-vertical:hover {
                --line-opacity: 1;
              }

              .group\/left-line:hover {
                --line-opacity: 1;
              }

              .group\/right-line:hover {
                --line-opacity: 1;
              }
            `}</style>

            <div className="w-full px-2 flex flex-col items-center">
              {SEARCH_CATEGORIES.map((category) => (
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
                    <div className="relative" style={{ width: '14px', height: '14px' }}>
                      <input
                        type="checkbox"
                        checked={config.searchCategories?.includes(category.id) || false}
                        onChange={(e) => handleCategorySelection(category.id, e.target.checked)}
                        className={`category-checkbox absolute inset-0 ${progress.status !== 'running' ? 'opacity-0 group-hover/right-line:opacity-100' : 'opacity-0'}`}
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          backgroundColor: '#393837',
                          cursor: progress.status !== 'running' ? 'pointer' : 'default',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          borderRadius: 0,
                          outline: 'none',
                          boxShadow: 'none',
                          transition: 'background-color 0.3s ease'
                        }}
                        disabled={progress.status === 'running'}
                      />
                      <span 
                        className={`category-letter absolute inset-0 flex items-center justify-center text-[8px] ${
                          config.searchCategories?.includes(category.id)
                            ? 'text-[#393837]'
                            : 'text-white'
                        } ${progress.status !== 'running' ? 'opacity-0 group-hover/right-line:opacity-100' : 'opacity-0'}`}
                        style={{
                          pointerEvents: 'none'
                        }}
                      >
                        {getCategoryLetter(category.id)}
                      </span>
                    </div>
                  </div>
                  {progress.status !== 'running' && (
                    <Tooltip targetRef={{ current: categoryRefs.current[category.id] }}>
                      {getCategoryName(category.id)}
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Start button positioned in the center */}
        <div 
          className="absolute"
          style={{
            left: '50%',
            top: 'calc(50% + 2px)', // Added 2px offset
            transform: 'translate(-50%, -50%)',
            zIndex: 3
          }}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              console.log('Start Scraping button clicked by user');
              startScraping();
            }}
            disabled={progress.status === 'running' || (config.cities?.length || 0) === 0}
            className={`transition-colors ${
              progress.status === 'running' || (config.cities?.length || 0) === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            style={{
              width: '16px',
              height: '18px',
              backgroundColor: 'transparent',
              padding: 0,
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              if (progress.status !== 'running' && (config.cities?.length || 0) > 0) {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (progress.status !== 'running' && (config.cities?.length || 0) > 0) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            type="button"
            title={progress.status === 'running' 
              ? 'Scraping in Progress...' 
              : `Start Scraper at ${getIntensityName(config.maxResults || 20, config.searchRadius || 10)} Intensity (Click to Confirm)`
            }
          />
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto w-full">
          <div>
            {/* Removed the horizontal slider - now it's vertical on the line */}
          </div>

          {/* **CATEGORY SELECTION MOVED TO BOTTOM SEGMENT** */}
        </div>
      </div>
    </div>
  );
} 