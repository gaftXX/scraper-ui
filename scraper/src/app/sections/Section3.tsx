'use client';

import React, { useState, useEffect } from 'react';

interface Section3Props {
  showCompendium: boolean;
  results: any;
  formatElapsedTime: (seconds: number) => string;
  progress?: any; // Add progress prop to detect when scraping finishes
  resetCompendiumState?: () => void; // Add reset function prop
}

interface FirestoreOffice {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  description?: string;
  placeId?: string;
  city?: string;
  existedInDatabase?: boolean;
  businessLabels?: string[];
  category?: string;
  timestamp?: any;
}

interface CityData {
  city: string;
  categories: string[];
}

export default function Section3({ showCompendium, results, formatElapsedTime, progress, resetCompendiumState }: Section3Props) {
  const [showCities, setShowCities] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showData, setShowData] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>(['compendium']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [firestoreData, setFirestoreData] = useState<FirestoreOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [filteredData, setFilteredData] = useState<FirestoreOffice[]>([]);
  const [newOffices, setNewOffices] = useState<Set<string>>(new Set()); // Track new offices for highlighting
  const [previousData, setPreviousData] = useState<FirestoreOffice[]>([]); // Track previous data to detect truly new offices

  // Debug logging
  console.log('Section3 props:', { showCompendium, results: !!results, resultsLength: results?.results?.length });

  // Fetch data from Firestore when compendium is opened
  useEffect(() => {
    if (showCompendium) {
      fetchFirestoreData();
    }
  }, [showCompendium]);

  // Reset internal state when compendium is closed
  useEffect(() => {
    if (!showCompendium) {
      setShowCities(false);
      setShowCategories(false);
      setShowData(false);
      setNavigationHistory(['compendium']);
      setCurrentIndex(0);
      setSelectedCity('');
      setSelectedCategory('');
      setFilteredData([]);
      setNewOffices(new Set());
      setPreviousData([]);
    }
  }, [showCompendium]);

  // Auto-refresh data when scraping completes
  useEffect(() => {
    if (progress?.status === 'completed' && showCompendium) {
      // Immediate refresh without delay
      fetchFirestoreData();
    }
  }, [progress?.status, showCompendium]);

  // Handle new office highlighting - simplified to only highlight truly new offices
  useEffect(() => {
    if (firestoreData.length > 0 && progress?.status === 'completed' && previousData.length > 0) {
      // Compare current data with previous data to find truly new offices
      const newOfficeIds = new Set<string>();
      
      firestoreData.forEach(office => {
        const officeId = `${office.name}-${office.address}-${office.city}`;
        
        // Check if this office exists in previous data
        const existsInPrevious = previousData.some(prevOffice => {
          const prevOfficeId = `${prevOffice.name}-${prevOffice.address}-${prevOffice.city}`;
          return prevOfficeId === officeId;
        });
        
        // If office doesn't exist in previous data, it's truly new
        if (!existsInPrevious) {
          newOfficeIds.add(officeId);
        }
      });
      
      if (newOfficeIds.size > 0) {
        setNewOffices(newOfficeIds);
        
        // Remove highlighting after 2 seconds
        setTimeout(() => {
          setNewOffices(new Set());
        }, 2000);
      }
      
      // Update previous data for next comparison
      setPreviousData([...firestoreData]);
    } else if (firestoreData.length > 0 && progress?.status === 'completed') {
      // First time loading data, just update previous data without highlighting
      setPreviousData([...firestoreData]);
    }
  }, [firestoreData, progress?.status]); // Removed previousData from dependencies

  const fetchFirestoreData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/firestore/data', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFirestoreData(data.offices || []);
        console.log('Fetched Firestore data:', data.offices?.length || 0, 'offices');
      } else {
        console.error('Failed to fetch Firestore data - using empty data');
        setFirestoreData([]);
      }
    } catch (error) {
      console.error('Error fetching Firestore data:', error);
      setFirestoreData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique cities and their categories from Firestore data
  const getCitiesAndCategories = (): CityData[] => {
    const cityMap = new Map<string, Set<string>>();
    
    firestoreData.forEach((office) => {
      if (office.city && office.category) {
        if (!cityMap.has(office.city)) {
          cityMap.set(office.city, new Set());
        }
        cityMap.get(office.city)!.add(office.category);
      }
    });

    const citiesAndCategories = Array.from(cityMap.entries()).map(([city, categories]) => ({
      city,
      categories: Array.from(categories)
    }));

    // Order cities by size (same as Section2)
    const cityOrder = [
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
    ];

    return citiesAndCategories.sort((a, b) => {
      const aIndex = cityOrder.indexOf(a.city);
      const bIndex = cityOrder.indexOf(b.city);
      
      // If both cities are in the order list, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one city is in the order list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      // If neither city is in the order list, sort alphabetically
      return a.city.localeCompare(b.city);
    });
  };

  const citiesAndCategories = getCitiesAndCategories();

  const handleNavigate = (direction: 'back' | 'forward') => {
    if (direction === 'back' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      const previousView = navigationHistory[currentIndex - 1];
      if (previousView === 'compendium') {
        setShowCities(false);
        setShowCategories(false);
        setShowData(false);
      } else if (previousView === 'cities') {
        setShowCities(true);
        setShowCategories(false);
        setShowData(false);
      } else if (previousView === 'categories') {
        setShowCities(false);
        setShowCategories(true);
        setShowData(false);
      }
    } else if (direction === 'forward' && currentIndex < navigationHistory.length - 1) {
      setCurrentIndex(currentIndex + 1);
      const nextView = navigationHistory[currentIndex + 1];
      if (nextView === 'cities') {
        setShowCities(true);
        setShowCategories(false);
        setShowData(false);
      } else if (nextView === 'categories') {
        setShowCities(false);
        setShowCategories(true);
        setShowData(false);
      } else if (nextView === 'data') {
        setShowCities(false);
        setShowCategories(false);
        setShowData(true);
      }
    }
  };

  const handleShowCities = () => {
    setShowCities(true);
    setShowCategories(false);
    setShowData(false);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'cities'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleSelectCity = (city: string) => {
    setSelectedCity(city);
    setShowCities(false);
    setShowCategories(true);
    setShowData(false);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'categories'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setShowCities(false);
    setShowCategories(false);
    setShowData(true);
    
    // Filter data for selected city and category
    const filtered = firestoreData.filter(office => 
      office.city === selectedCity && office.category === category
    );
    setFilteredData(filtered);
    
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'data'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  // Update filtered data when firestore data changes
  useEffect(() => {
    if (selectedCity && selectedCategory && showData) {
      const filtered = firestoreData.filter(office => 
        office.city === selectedCity && office.category === selectedCategory
      );
      setFilteredData(filtered);
    }
  }, [firestoreData, selectedCity, selectedCategory, showData]);

  const handleBackToCities = () => {
    setShowCities(true);
    setShowCategories(false);
    setShowData(false);
    setSelectedCity('');
    setSelectedCategory('');
    setFilteredData([]);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'cities'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleBackToCategories = () => {
    setShowCities(false);
    setShowCategories(true);
    setShowData(false);
    setSelectedCategory('');
    setFilteredData([]);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'categories'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleBackToCountry = () => {
    setShowCities(false);
    setShowCategories(false);
    setShowData(false);
    setSelectedCity('');
    setSelectedCategory('');
    setFilteredData([]);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'compendium'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleBackToCity = () => {
    setShowCities(true);
    setShowCategories(false);
    setShowData(false);
    setSelectedCategory('');
    setFilteredData([]);
    const newHistory = [...navigationHistory.slice(0, currentIndex + 1), 'cities'];
    setNavigationHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  return (
    <div className="col-span-2 h-full">
      <div className="h-full flex flex-col">
        {showCompendium && (
          <div className="flex-1 overflow-hidden">
            {/* Navigation Buttons */}
            <div className="flex items-center space-x-2 mb-0">
              {!showCities && !showCategories && !showData && (
                <button
                  onClick={handleShowCities}
                  className="px-3 py-2 text-white text-sm font-bold uppercase tracking-wide hover:opacity-50 transition-opacity duration-300"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                >
                  LATVIA
                </button>
              )}
              {showCities && !showCategories && !showData && (
                <>
                  <button
                    onClick={handleBackToCountry}
                    className="px-3 py-2 bg-[#393837] text-white text-sm font-bold uppercase tracking-wide hover:opacity-50 transition-opacity duration-300"
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    LATVIA -
                  </button>
                  {citiesAndCategories.map((cityData) => (
                    <button
                      key={cityData.city}
                      onClick={() => handleSelectCity(cityData.city)}
                      className="px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300"
                      style={{
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {cityData.city}
                    </button>
                  ))}
                </>
              )}
              {showCategories && (
                <>
                  <button
                    onClick={handleBackToCountry}
                    className="px-3 py-2 bg-[#393837] text-white text-sm font-bold uppercase tracking-wide hover:opacity-50 transition-opacity duration-300"
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    LATVIA -
                  </button>
                  <button
                    onClick={handleBackToCity}
                    className="px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300"
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedCity} -
                  </button>
                  {citiesAndCategories
                    .find(cityData => cityData.city === selectedCity)
                    ?.categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleSelectCategory(category)}
                        className="px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300"
                        style={{
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {category}
                      </button>
                    ))}
                </>
              )}
              {showData && (
                <>
                  <button
                    onClick={handleBackToCountry}
                    className="px-3 py-2 bg-[#393837] text-white text-sm font-bold uppercase tracking-wide hover:opacity-50 transition-opacity duration-300"
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    LATVIA -
                  </button>
                  <button
                    onClick={handleBackToCity}
                    className="px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300"
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {selectedCity} -
                  </button>
                  {citiesAndCategories
                    .find(cityData => cityData.city === selectedCity)
                    ?.categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleSelectCategory(category)}
                        className={`px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300 ${
                          category === selectedCategory ? 'opacity-50' : ''
                        }`}
                        style={{
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {category}
                      </button>
                    ))}
                </>
              )}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-1">
            </div>
            
            {/* Content */}
            {firestoreData.length === 0 && !loading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[#ffffff] text-lg">No data found in database. Run a scraper first to see results here.</span>
              </div>
            ) : showCities ? (
              // Cities are now shown in navigation area
              <div className="flex-1 flex items-center justify-center">
                {loading && (
                  <span className="text-[#ffffff] text-sm opacity-50">Loading cities...</span>
                )}
              </div>
            ) : showCategories ? (
              // Categories are now shown in navigation area
              <div className="flex-1 flex items-center justify-center">
                {loading && (
                  <span className="text-[#ffffff] text-sm opacity-50">Loading categories...</span>
                )}
              </div>
            ) : showData ? (
              // Data Spreadsheet
              <div className="overflow-hidden" style={{ backgroundColor: 'transparent' }}>
                <style jsx global>{`
                  .compendium-container {
                    scrollbar-width: none;  /* Firefox */
                    -ms-overflow-style: none;  /* Internet Explorer 10+ */
                  }
                  .compendium-container::-webkit-scrollbar {
                    display: none;  /* WebKit */
                  }
                `}</style>
                <div className="overflow-x-auto h-[calc(100vh-35px)] overflow-y-auto compendium-container">
                  <table className="w-full text-sm">
                    <tbody>
                      {filteredData.map((office: FirestoreOffice, officeIndex: number) => {
                        const officeId = `${office.name}-${office.address}-${office.city}`;
                        const isNewOffice = newOffices.has(officeId);
                        const countdownNumber = officeIndex + 1; // Count up from 1
                        
                        return (
                          <tr 
                            key={`${office.city}-${officeIndex}`} 
                            className={`border-none hover:bg-gray-650 transition-all duration-300 ${
                              isNewOffice ? 'bg-green-600' : ''
                            }`} 
                            style={{ 
                              backgroundColor: isNewOffice ? '#10b981' : 'transparent',
                              transition: 'background-color 0.3s ease'
                            }}
                          >
                            <td className={`py-0 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`} style={{ width: '25px', textAlign: 'center' }}>
                              {countdownNumber}
                            </td>
                            <td className={`py-0 border-r border-gray-500 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`}>
                              <div className="pl-[13px]">
                                <div className={`font-medium ${
                                  isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                }`}>
                                  {office.name}
                                </div>
                                {office.phone && <div className={`text-xs ${
                                  isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                }`}>Phone: {office.phone}</div>}
                              </div>
                            </td>
                            <td className={`py-0 pl-[5px] border-r border-gray-500 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`}>
                              {office.address || '-'}
                            </td>
                            <td className={`py-0 pl-[5px] ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`}>
                              {office.website || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              // Initial State - No data shown
              <div className="flex-1 flex items-center justify-center">
              </div>
            )}
          </div>
        )}
        
        {!showCompendium && (
        <div className="flex-1 flex items-center justify-center">
        </div>
        )}
      </div>
    </div>
  );
} 