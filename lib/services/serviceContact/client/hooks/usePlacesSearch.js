"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { PlacesService } from '../services/PlacesService';

export function usePlacesSearch({ onLocationSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const [sessionToken, setSessionToken] = useState(uuidv4());

  const debounceRef = useRef(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (query, token) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const data = await PlacesService.getPredictions({
        input: query.trim(),
        sessiontoken: token,
      });

      const predictions = (data.predictions || []).map(p => ({
        placeId: p.place_id,
        name: p.structured_formatting.main_text,
        address: p.description,
        types: p.types || [],
      }));

      setSearchResults(predictions);
      setShowResults(true);
    } catch (err) {
      console.error("Error fetching predictions:", err);
      setError('Could not fetch suggestions.');
      setSearchResults([]);
      setShowResults(true); // Show the error state
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Effect to trigger debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      debouncedSearch(searchQuery, sessionToken);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, sessionToken, debouncedSearch]);

  const handleLocationSelect = useCallback(async (prediction) => {
    setIsSearching(true);
    setError(null);
    try {
      const data = await PlacesService.getDetails({
        place_id: prediction.placeId,
        sessiontoken: sessionToken,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types']
      });

      if (data.result?.geometry?.location) {
        const fullDetails = {
          placeId: data.result.place_id,
          name: data.result.name,
          address: data.result.formatted_address,
          lat: data.result.geometry.location.lat,
          lng: data.result.geometry.location.lng,
          types: data.result.types || [],
        };
        onLocationSelect(fullDetails); // Pass full details to parent
        setSearchQuery(fullDetails.name);
        setShowResults(false);
        setSessionToken(uuidv4()); // Start a new session for the next search
      } else {
        throw new Error("Invalid location data received.");
      }
    } catch (err) {
      console.error("Error fetching place details:", err);
      toast.error("Could not get location details.");
    } finally {
      setIsSearching(false);
    }
  }, [sessionToken, onLocationSelect]);

  const clearLocation = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setError(null);
    onLocationSelect(null);
    setSessionToken(uuidv4()); // Start a new session
  }, [onLocationSelect]);

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    searchResults,
    showResults,
    error,
    handleLocationSelect,
    clearLocation,
  };
}
