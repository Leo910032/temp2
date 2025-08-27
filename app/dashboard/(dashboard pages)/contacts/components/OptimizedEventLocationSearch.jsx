// OptimizedEventLocationSearch.jsx
"use client"
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from 'uuid'; // Import uuid to generate session tokens

// Optimized Event Location Search Component
function OptimizedEventLocationSearch({ onLocationSelect, selectedLocation }) {
    const { currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [error, setError] = useState(null);
    const [sessionToken, setSessionToken] = useState(null); // New state for session token
    
    // Refs for optimization
    const debounceRef = useRef(null);
    const abortControllerRef = useRef(null);
    const lastSearchRef = useRef('');

    // Generate a new session token on mount or when search is explicitly cleared
    useEffect(() => {
        setSessionToken(uuidv4());
    }, []); 

    // Reset search when location is cleared or when a new session should start
    useEffect(() => {
        if (!selectedLocation) { // This means the parent explicitly cleared the location
            setSearchQuery('');
            setSearchResults([]);
            setShowResults(false);
            setError(null);
            lastSearchRef.current = '';
            setSessionToken(uuidv4()); // Generate new session token on clear
        } else { // This means a location has just been selected (selectedLocation is now populated)
            // Ensure search results are hidden immediately after selection
            setShowResults(false);
        }
    }, [selectedLocation]);

    // Get Firebase Auth token with caching
    const getAuthToken = useCallback(async () => {
        if (!currentUser) {
            console.error("No current user found for auth token retrieval.");
            setError("You are not authenticated. Please sign in again.");
            return null;
        }
        try {
            const token = await currentUser.getIdToken();
            return token;
        } catch (error) {
            console.error("Error getting auth token:", error);
            setError("Failed to get authentication token.");
            return null;
        }
    }, [currentUser]);

    // Function to perform Autocomplete search
    const searchPredictions = useCallback(async (query) => {
        // Input validation
        if (!query || query.trim().length < 3) {
            setSearchResults([]);
            setShowResults(false);
            setError(null);
            return;
        }

        // Prevent duplicate searches for the same query
        if (query === lastSearchRef.current) {
            return;
        }
        lastSearchRef.current = query;

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        // Create new abort controller
        abortControllerRef.current = new AbortController();

        setIsSearching(true);
        setError(null);

        const token = await getAuthToken();
        if (!token) {
            setIsSearching(false);
            return;
        }

        try {
            console.log('🔍 Starting autocomplete search for:', query);
            
            const response = await fetch('/api/user/contacts/places/autocomplete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    input: query.trim(),
                    sessiontoken: sessionToken, // Pass the session token
                    // REMOVED (regions) as it cannot be mixed
                    types: 'establishment|geocode' // Allows searching for businesses/venues and general geocodable locations
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get predictions');
            }

            const data = await response.json();
            const predictions = data.predictions || [];

            if (predictions.length > 0) {
                console.log(`✅ Found ${predictions.length} predictions`);
                const formattedResults = formatAutocompletePredictions(predictions);
                setSearchResults(formattedResults);
                setShowResults(true); // Show results if found
            } else {
                console.log('❌ No predictions found');
                setSearchResults([]);
                setShowResults(true); // Still show the empty results box if query is long enough
            }

        } catch (err) {
            // Don't show error if request was aborted (user typed new query)
            if (err.name === 'AbortError') {
                console.log('🔄 Autocomplete request aborted (user typing)');
                return;
            }
            console.error('❌ Error searching predictions:', err);
            setError(`Failed to get suggestions: ${err.message}`);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [getAuthToken, sessionToken]);

    // Function to get Place Details after a prediction is selected
    const getPlaceDetails = useCallback(async (placeId, sessionToken) => {
        setIsSearching(true);
        setError(null);
        
        const token = await getAuthToken();
        if (!token) {
            setIsSearching(false);
            return null;
        }

        try {
            console.log('🔍 Getting place details for place_id:', placeId);
            const response = await fetch('/api/user/contacts/places/details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    place_id: placeId,
                    sessiontoken: sessionToken,
                    // Request minimal fields to reduce potential cost if not session-billed
                    fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types'] 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get place details');
            }

            const data = await response.json();
            // Google Places Details API returns 'result' object for successful queries
            if (data.result && data.result.geometry && data.result.geometry.location) {
                console.log('✅ Place details retrieved:', data.result.name);
                return {
                    placeId: data.result.place_id,
                    name: data.result.name,
                    address: data.result.formatted_address,
                    lat: data.result.geometry.location.lat,
                    lng: data.result.geometry.location.lng,
                    types: data.result.types || [],
                    isEstablishment: data.result.types?.includes('establishment'),
                    isAddress: data.result.types?.some(type => 
                        ['street_address', 'route', 'postal_code', 'locality', 'sublocality'].includes(type)
                    )
                };
            } else {
                setError('No valid location data returned for the selected place.');
                return null;
            }

        } catch (err) {
            console.error('❌ Error getting place details:', err);
            setError(`Failed to get location details: ${err.message}`);
            return null;
        } finally {
            setIsSearching(false);
        }
    }, [getAuthToken]);

    // Format autocomplete predictions consistently
    const formatAutocompletePredictions = useCallback((predictions) => {
        return predictions.map(prediction => ({
            placeId: prediction.place_id,
            name: prediction.structured_formatting.main_text,
            address: prediction.description,
            lat: null, 
            lng: null,
            types: prediction.types || [],
            isEstablishment: null,
            isAddress: null 
        })).slice(0, 8); // Limit to top 8 results
    }, []);

    // Optimized debounced search with 300ms delay
    useEffect(() => {
        // Clear previous timeout
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // IMPORTANT: Only trigger search if no location is currently selected.
        // This prevents re-searching after a selection has been made.
        if (selectedLocation) {
            setSearchResults([]); // Hide any lingering suggestions
            setShowResults(false);
            return; 
        }

        // Set new timeout for search predictions
        debounceRef.current = setTimeout(() => {
            if (searchQuery.length >= 3) {
                searchPredictions(searchQuery);
            } else if (searchQuery.length === 0) {
                setSearchResults([]);
                setShowResults(false);
                setError(null);
                lastSearchRef.current = '';
            }
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [searchQuery, searchPredictions, selectedLocation]); // Add selectedLocation as a dependency

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleLocationSelect = useCallback(async (prediction) => {
        const details = await getPlaceDetails(prediction.placeId, sessionToken); // Get full details
        if (details) {
            setSearchQuery(details.name); // Set input to the place's name (will trigger effect, but now it's guarded)
            setShowResults(false); // Explicitly hide results immediately
            setError(null);
            onLocationSelect(details); // Pass full details to parent
            setSessionToken(uuidv4()); // Start a new session after selection
        }
    }, [onLocationSelect, getPlaceDetails, sessionToken]);

    const clearLocation = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
        setError(null);
        lastSearchRef.current = '';
        onLocationSelect(null);
        setSessionToken(uuidv4()); // Start a new session on clear
    }, [onLocationSelect]);

    // Get icon for result type (updated to handle prediction context)
    const getResultIcon = (result) => {
        if (result.types?.includes('establishment')) return '🏢';
        if (result.types?.some(type => ['street_address', 'route', 'postal_code', 'locality', 'sublocality'].includes(type))) return '🏠';
        return '📍';
    };

    // Get result type label (updated for prediction context)
    const getResultTypeLabel = (result) => {
        if (result.types?.includes('establishment')) return 'Business/Venue';
        if (result.types?.some(type => ['street_address', 'route', 'postal_code', 'locality', 'sublocality'].includes(type))) return 'Address';
        return 'Location';
    };
    
    return (
        <div className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for event venue, business, or address... (min 3 chars)"
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    autoComplete="off"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                
                {(searchQuery || selectedLocation) && (
                    <button 
                        onClick={clearLocation} 
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                        type="button"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {isSearching && (
                    <div className="absolute right-8 top-2.5">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    </div>
                )}
            </div>

            {/* No searchStrategy for autocomplete, as it's a direct prediction service */}
            {searchQuery.length > 0 && searchQuery.length < 3 && !isSearching && (
                <div className="mt-2 text-xs text-orange-600">
                    ⚠️ Type at least 3 characters to search
                </div>
            )}

            {error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                    {error}
                </div>
            )}

            {selectedLocation && (
                <div className="mt-3 p-3 bg-green-100 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <div className="text-lg">{getResultIcon(selectedLocation)}</div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-green-900 text-sm">{selectedLocation.name}</h4>
                            <p className="text-green-700 text-xs mt-1 break-words">{selectedLocation.address}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <p className="text-green-600 text-xs">📍 {selectedLocation.lat?.toFixed(6)}, {selectedLocation.lng?.toFixed(6)}</p>
                                <span className="text-xs text-green-600 bg-green-200 px-2 py-0.5 rounded">
                                    {getResultTypeLabel(selectedLocation)}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={clearLocation} 
                            className="text-green-600 hover:text-green-800 p-1 transition-colors flex-shrink-0"
                            type="button"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {showResults && searchResults.length > 0 && !selectedLocation && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {/* Search results header */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                        <span>💡 Select a suggestion: {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                        <span className="text-green-600 font-medium ml-2">⚡ Fast</span>
                    </div>
                    
                    {searchResults.map((result, index) => (
                        <button 
                            key={result.placeId || index} 
                            onClick={() => handleLocationSelect(result)} 
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 focus:bg-gray-50 focus:outline-none transition-colors"
                            type="button"
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-lg mt-0.5 flex-shrink-0">{getResultIcon(result)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 text-sm truncate">{result.name}</div>
                                    <div className="text-gray-600 text-xs mt-1 truncate">{result.address}</div>
                                    {result.types && result.types.length > 0 && (
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                {getResultTypeLabel(result)}
                                            </span>
                                            <span className="text-xs text-gray-400 truncate">
                                                {result.types[0].replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {showResults && searchResults.length === 0 && searchQuery.length >= 3 && !isSearching && !selectedLocation && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                    <div className="text-center text-gray-500 text-sm">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        No suggestions found for &quot;{searchQuery}&quot;
                        <br />
                        <span className="text-xs mt-1 block">
                            Try a different search term or check spelling
                        </span>
                    </div>
                </div>
            )}

            <div className="mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span>💡 Start typing an address, venue name, or landmark to get suggestions.</span>
                </div>
            </div>
        </div>
    );
}

export default OptimizedEventLocationSearch;