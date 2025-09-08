// app/dashboard/(dashboard pages)/contacts/hooks/useSearchHistory.js
"use client";

import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'contactSearchHistory';
const MAX_HISTORY_SIZE = 10; // Keep the last 10 unique searches

export function useSearchHistory() {
    const [history, setHistory] = useState([]);

    // Load history from localStorage on initial component mount
    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem(CACHE_KEY);
            if (storedHistory) {
                setHistory(JSON.parse(storedHistory));
            }
        } catch (error) {
            console.error("Failed to load search history from localStorage:", error);
        }
    }, []);

    // Function to add a new query to the history
    const addSearchHistory = useCallback((query) => {
        if (!query || typeof query !== 'string' || query.trim().length < 3) {
            return; // Don't save empty or very short queries
        }

        const normalizedQuery = query.trim().toLowerCase();

        setHistory(prevHistory => {
            // Remove existing instances of the same query to avoid duplicates
            const filteredHistory = prevHistory.filter(item => item.toLowerCase() !== normalizedQuery);
            
            // Add the new query to the front and limit the history size
            const newHistory = [query.trim(), ...filteredHistory].slice(0, MAX_HISTORY_SIZE);

            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(newHistory));
            } catch (error) {
                console.error("Failed to save search history to localStorage:", error);
            }
            
            return newHistory;
        });
    }, []);

    // Function to clear the history
    const clearSearchHistory = useCallback(() => {
        setHistory([]);
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (error) {
            console.error("Failed to clear search history from localStorage:", error);
        }
    }, []);

    return { history, addSearchHistory, clearSearchHistory };
}