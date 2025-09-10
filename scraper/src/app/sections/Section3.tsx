'use client';

import React, { useState, useEffect } from 'react';
import { getCitiesByCountry, getCountryById } from '../countries';

interface Section3Props {
  showCompendium: boolean;
  results: any;
  formatElapsedTime: (seconds: number) => string;
  progress?: any; // Add progress prop to detect when scraping finishes
  resetCompendiumState?: () => void; // Add reset function prop
  config?: any; // Add config prop to access selected country
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
  uniqueId?: string; // Added for Spanish offices (B---S format)
  modifiedName?: string; // Added for custom office names
  timestamp?: any;
}

interface CityData {
  city: string;
  categories: string[];
}

// City ordering for both countries
// City ordering is now handled by the centralized country configuration

// Helper function to display street name, number, and district only
const cleanAddressDisplay = (address: string, city?: string): string => {
  if (!address) return address;
  
  let cleanedAddress = address
    .replace(/^[^\w\s]*/, '') // Remove non-word characters at the start
    .replace(/^\s*[-–—•·]\s*/, '') // Remove dashes, bullets, dots at start
    .trim();
  
  // Remove postal codes (5-digit codes for Spain, 4-digit codes for Latvia)
  cleanedAddress = cleanedAddress
    .replace(/,\s*\d{4,5}\s*,?/g, ',') // Remove postal codes like ", 08001," or ", 08001"
    .replace(/,\s*\d{4,5}$/g, '') // Remove postal codes at the end like ", 08001"
    .replace(/^\d{4,5}\s*,?\s*/g, '') // Remove postal codes at the start like "08001, "
    .replace(/\s+\d{4,5}\s*,?/g, ',') // Remove postal codes with spaces like " 08001,"
    .replace(/\s+\d{4,5}$/g, '') // Remove postal codes with spaces at the end
    .replace(/,\s*,/g, ',') // Clean up double commas
    .replace(/^,\s*/, '') // Remove leading comma
    .replace(/,\s*$/, '') // Remove trailing comma
    .trim();
  
  // Remove city names and countries - keep only street name, number, and district
  cleanedAddress = cleanedAddress
    .replace(/,\s*[^,]+,\s*[^,]+$/g, '') // Remove last two parts (usually city, country)
    .replace(/,\s*[^,]+$/g, '') // Remove last part (usually city)
    .trim();
  
  // Additional cleanup for common patterns
  cleanedAddress = cleanedAddress
    .replace(/^[^a-zA-Z0-9\s]*/, '') // Remove any remaining non-alphanumeric characters at start
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim();
  
  return cleanedAddress;
};

export default function Section3({ showCompendium, results, formatElapsedTime, progress, resetCompendiumState, config }: Section3Props) {
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
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null); // Track which office name is being edited
  const [editingName, setEditingName] = useState<string>(''); // Track the current editing name
  const [savingOfficeId, setSavingOfficeId] = useState<string | null>(null); // Track which office is being saved
  const [editModeEnabled, setEditModeEnabled] = useState<boolean>(false); // Track if edit mode is enabled

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
        const displayName = office.modifiedName || office.name;
        const officeId = `${displayName}-${office.address}-${office.city}`;
        
        // Check if this office exists in previous data
        const existsInPrevious = previousData.some(prevOffice => {
          const prevDisplayName = prevOffice.modifiedName || prevOffice.name;
          const prevOfficeId = `${prevDisplayName}-${prevOffice.address}-${prevOffice.city}`;
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
      const selectedCountry = config?.country || 'latvia';
      const response = await fetch(`/api/firestore/data?country=${selectedCountry}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const freshOffices = data.offices || [];
        
        // Preserve any locally modified names that haven't been saved yet
        setFirestoreData(prevData => {
          const mergedData = freshOffices.map((freshOffice: FirestoreOffice) => {
            // Find if this office exists in previous data with a modified name
            const existingOffice = prevData.find(prevOffice => 
              prevOffice.uniqueId === freshOffice.uniqueId
            );
            
            // If the office exists in previous data and has a modified name, preserve it
            if (existingOffice && existingOffice.modifiedName && existingOffice.modifiedName !== existingOffice.name) {
              return {
                ...freshOffice,
                modifiedName: existingOffice.modifiedName
              };
            }
            
            return freshOffice;
          });
          
          return mergedData;
        });
        
        console.log('Fetched Firestore data:', freshOffices.length, 'offices');
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

  // Get unique cities and their categories from Firestore data, filtered by selected country
  const getCitiesAndCategories = (): CityData[] => {
    const cityMap = new Map<string, Set<string>>();
    const selectedCountry = config?.country || 'latvia';
    
    // Get the cities for the selected country using centralized configuration
    const countryCities = getCitiesByCountry(selectedCountry);
    const cityNames = countryCities.map(city => city.name);
    
    firestoreData.forEach((office) => {
      if (office.city && office.category) {
        // Only include cities that are in the selected country's city list
        if (cityNames.includes(office.city)) {
          if (!cityMap.has(office.city)) {
            cityMap.set(office.city, new Set());
          }
          cityMap.get(office.city)!.add(office.category);
        }
      }
    });

    const citiesAndCategories = Array.from(cityMap.entries()).map(([city, categories]) => ({
      city,
      categories: Array.from(categories)
    }));

    // Sort cities by their order in the country configuration
    return citiesAndCategories.sort((a, b) => {
      const aIndex = cityNames.indexOf(a.city);
      const bIndex = cityNames.indexOf(b.city);
      
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
  
  // Get the current country name for display
  const getCountryName = () => {
    const selectedCountry = config?.country || 'latvia';
    const country = getCountryById(selectedCountry);
    return country ? country.name.toUpperCase() : 'LATVIA';
  };

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

  // Handle starting to edit an office name
  const handleStartEdit = (officeId: string, currentName: string) => {
    setEditingOfficeId(officeId);
    setEditingName(currentName);
  };

  // Handle canceling edit
  const handleCancelEdit = (originalName?: string) => {
    setEditingOfficeId(null);
    setEditingName('');
    // If originalName is provided, revert the contentEditable element
    if (originalName) {
      const element = document.querySelector(`[contenteditable="true"]`);
      if (element) {
        element.textContent = originalName;
      }
    }
  };

  // Handle saving the modified name
  const handleSaveEdit = async (officeId: string) => {
    if (!editingName.trim()) {
      handleCancelEdit();
      return;
    }

    // Set saving state to show flashing animation
    setSavingOfficeId(officeId);
    
    // Immediately blur the contentEditable element to unselect it
    const element = document.querySelector(`[contenteditable="true"]`);
    if (element) {
      (element as HTMLElement).blur();
    }

    try {
      const response = await fetch('/api/update-office-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          officeId,
          modifiedName: editingName.trim()
        })
      });

      if (response.ok) {
        // Update the local data with the modified name
        setFirestoreData(prevData => 
          prevData.map(office => 
            office.uniqueId === officeId 
              ? { ...office, modifiedName: editingName.trim() }
              : office
          )
        );
        setFilteredData(prevData => 
          prevData.map(office => 
            office.uniqueId === officeId 
              ? { ...office, modifiedName: editingName.trim() }
              : office
          )
        );
        console.log('Office name updated successfully');
      } else {
        console.error('Failed to update office name');
      }
    } catch (error) {
      console.error('Error updating office name:', error);
    } finally {
      // Clear saving state after a short delay to show the animation
      setTimeout(() => {
        setSavingOfficeId(null);
        handleCancelEdit();
      }, 1000);
    }
  };

  return (
    <div className="col-span-2 h-full">
      <div className="h-full flex flex-col">
        {showCompendium && (
          <div className="flex-1 overflow-hidden">
            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mb-0">
              <div className="flex items-center space-x-2">
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
                  {getCountryName()}
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
                    {getCountryName()} -
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
                    {getCountryName()} -
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
                    {getCountryName()} -
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
              {showData && (
                <>
                  <style jsx>{`
                    @keyframes flash {
                      0% { opacity: 0.3; }
                      50% { opacity: 1; }
                      100% { opacity: 0.3; }
                    }
                    .flash-animation {
                      animation: flash 1s ease-in-out infinite;
                    }
                  `}</style>
                  <button
                    onClick={() => setEditModeEnabled(!editModeEnabled)}
                    className={`px-3 py-2 bg-[#393837] text-white text-sm font-medium hover:opacity-50 transition-opacity duration-300 ${
                      editModeEnabled ? 'flash-animation' : ''
                    }`}
                    style={{
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    EDIT
                  </button>
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
                        const displayName = office.modifiedName || office.name;
                        const officeId = `${displayName}-${office.address}-${office.city}`;
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
                            {/* Unique ID Column */}
                            <td className={`py-0 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`} style={{ width: '60px', textAlign: 'center' }}>
                              {office.uniqueId && (
                                <div className={`text-xs font-mono ${
                                  isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                }`}>
                                  {office.uniqueId}
                                </div>
                              )}
                            </td>
                            {/* Office Name Column */}
                            <td className={`py-0 border-r border-gray-500 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`}>
                              <div>
                                <div 
                                  contentEditable={editingOfficeId === office.uniqueId}
                                  suppressContentEditableWarning={true}
                                  className={`font-medium ${editModeEnabled ? 'cursor-pointer hover:opacity-50 transition-opacity duration-300' : 'cursor-default'} ${
                                    isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                  } ${editingOfficeId === office.uniqueId ? 'outline-none' : ''} ${
                                    savingOfficeId === office.uniqueId ? 'animate-pulse' : ''
                                  }`}
                                  onClick={() => editModeEnabled && handleStartEdit(office.uniqueId!, office.modifiedName || office.name)}
                                  onInput={(e) => setEditingName(e.currentTarget.textContent || '')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEdit(office.uniqueId!);
                                    } else if (e.key === 'Escape') {
                                      const originalName = office.modifiedName || office.name;
                                      handleCancelEdit(originalName);
                                    }
                                  }}
                                  onBlur={() => {
                                    // Only cancel if not currently saving
                                    if (savingOfficeId !== office.uniqueId) {
                                      // Revert content back to original name
                                      const originalName = office.modifiedName || office.name;
                                      handleCancelEdit(originalName);
                                    }
                                  }}
                                  title={editingOfficeId === office.uniqueId ? "Press Enter to save, Escape to cancel" : ""}
                                >
                                  {office.modifiedName || office.name}
                                </div>
                                {office.phone && <div className={`text-xs ${
                                  isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                }`}>Phone: {office.phone}</div>}
                              </div>
                            </td>
                            <td className={`py-0 pl-[5px] border-r border-gray-500 ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`} style={{ width: '330px' }}>
                              {office.address ? cleanAddressDisplay(office.address, office.city) : '-'}
                            </td>
                            <td className={`py-0 pl-[5px] ${
                              isNewOffice ? 'text-black' : 'text-[#ffffff]'
                            }`}>
                              {office.website ? (
                                <a
                                  href={office.website.startsWith('http') ? office.website : `https://${office.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`cursor-pointer ${
                                    isNewOffice ? 'text-black' : 'text-[#ffffff]'
                                  }`}
                                >
                                  {office.website.replace(/^https?:\/\//, '')}
                                </a>
                              ) : '-'}
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