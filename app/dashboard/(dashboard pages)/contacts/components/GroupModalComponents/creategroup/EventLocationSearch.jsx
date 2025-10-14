// app/dashboard/(dashboard pages)/contacts/components/EventLocationSearch.jsx
"use client";
import { useEffect } from 'react';

import { usePlacesSearch } from '@/lib/services/serviceContact/client/hooks/usePlacesSearch';

// Helper functions for UI
const getResultIcon = (result) => {
  if (result.types?.includes('establishment')) return '🏢';
  if (result.types?.some(type => ['street_address', 'route'].includes(type))) return '🏠';
  return '📍';
};

const getResultTypeLabel = (result) => {
  if (result.types?.includes('establishment')) return 'Business/Venue';
  if (result.types?.some(type => ['street_address', 'route'].includes(type))) return 'Address';
  return 'Location';
};

export default function EventLocationSearch({ onLocationSelect, selectedLocation }) {
  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    showResults,
    error,
    budgetExceeded,
    budgetInfo,
    handleLocationSelect,
    clearLocation,
  } = usePlacesSearch({ onLocationSelect });

  // Effect to clear the search query when the parent clears the location
  useEffect(() => {
    // If the parent component clears the location, we clear our input field.
    if (!selectedLocation) {
        setSearchQuery('');
    }
    // If the parent component provides a location, we can set the input to its name.
    else if (selectedLocation && searchQuery !== selectedLocation.name) {
        setSearchQuery(selectedLocation.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation]); // Only depend on selectedLocation to avoid re-triggering on every keystroke

  return (
    <div className="relative">
      {budgetExceeded && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Monthly API Limit Reached</p>
              <p className="text-xs text-amber-700 mt-1">
                You&apos;ve reached your monthly limit for location searches.
                {budgetInfo && (
                  <span> ({budgetInfo.currentRunsAPI}/{budgetInfo.maxRunsAPI} API operations used)</span>
                )}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Please upgrade your plan to continue using this feature.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={budgetExceeded ? "Location search disabled - upgrade to continue" : "Search for event venue, business, or address..."}
          className={`w-full px-4 py-2 pl-10 border rounded-lg text-sm ${
            budgetExceeded
              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'
          }`}
          autoComplete="off"
          disabled={budgetExceeded}
        />
        <svg className={`absolute left-3 top-2.5 h-4 w-4 ${budgetExceeded ? 'text-gray-300' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        {(searchQuery || selectedLocation) && !budgetExceeded && <button onClick={clearLocation} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600" type="button"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        {isSearching && <div className="absolute right-8 top-2.5"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div></div>}
      </div>

      {error && !budgetExceeded && <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}

      {selectedLocation && (
        <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
                <div className="text-lg">{getResultIcon(selectedLocation)}</div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-green-900 text-sm">{selectedLocation.name}</h4>
                    <p className="text-green-700 text-xs mt-1">{selectedLocation.address}</p>
                </div>
            </div>
        </div>
      )}

      {showResults && !selectedLocation && !budgetExceeded && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button key={result.placeId} onClick={() => handleLocationSelect(result)} className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0" type="button">
                <div className="flex items-start gap-3">
                  <div className="text-lg mt-0.5">{getResultIcon(result)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{result.name}</div>
                    <div className="text-gray-600 text-xs mt-1 truncate">{result.address}</div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              {searchQuery.length < 3 ? "Type at least 3 characters..." : "No suggestions found."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}