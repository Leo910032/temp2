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
  }, [selectedLocation]); // The dependency array is now correct.

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for event venue, business, or address..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
          autoComplete="off"
        />
        <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        {(searchQuery || selectedLocation) && <button onClick={clearLocation} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600" type="button"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        {isSearching && <div className="absolute right-8 top-2.5"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div></div>}
      </div>

      {error && <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>}

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

      {showResults && !selectedLocation && (
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