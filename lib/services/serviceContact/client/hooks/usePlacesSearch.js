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
  const [sessionToken, setSessionToken] = useState(uuidv4()); // Google Maps session token

  const debounceRef = useRef(null);
  // Use ref for sessionId to keep it stable across re-renders
  const sessionIdRef = useRef(`session_${Date.now()}_${uuidv4()}`);
  // Flag to prevent search when location is being selected
  const isSelectingRef = useRef(false);

  // Debounced search function
  const debouncedSearch = useCallback(async (query, token, trackingSessionId) => {
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
        sessionId: trackingSessionId, // Pass cost tracking session ID
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

    // If a selection is in progress, do not trigger a new search
    if (isSelectingRef.current) {
      isSelectingRef.current = false; // Reset the flag and stop
      return;
    }

    debounceRef.current = setTimeout(() => {
      debouncedSearch(searchQuery, sessionToken, sessionIdRef.current);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, sessionToken, debouncedSearch]);

  const handleLocationSelect = useCallback(async (prediction) => {
    isSelectingRef.current = true; // Prevent search from triggering when we update searchQuery
    setIsSearching(true);
    setError(null);
    try {
      const data = await PlacesService.getDetails({
        place_id: prediction.placeId,
        sessiontoken: sessionToken,
        sessionId: sessionIdRef.current, // Pass cost tracking session ID (will finalize the session)
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
        // Start new sessions for the next search
        setSessionToken(uuidv4()); // Google Maps session token
        sessionIdRef.current = `session_${Date.now()}_${uuidv4()}`; // Reset cost tracking session ID
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
    // Start new sessions
    setSessionToken(uuidv4()); // Google Maps session token
    sessionIdRef.current = `session_${Date.now()}_${uuidv4()}`; // Reset cost tracking session ID
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
