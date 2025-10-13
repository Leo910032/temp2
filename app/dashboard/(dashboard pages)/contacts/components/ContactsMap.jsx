'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import GroupClusterManager from './ContactsMap/GroupClusterManager';
import ContactProfileModal from './ContactsMap/ContactProfileModal';
import { MapLegend } from './ContactsMap/MapLegend';
import { useTranslation } from '@/lib/translation/useTranslation';

// Modern minimalist map styles - Light theme
const lightMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f8fafc" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcfce7" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#16a34a" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#475569" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#f1f5f9" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3b82f6" }] },
];

// Dark theme for modern look
const darkMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#334155" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14532d" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4ade80" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#475569" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#64748b" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#334155" }] },
    { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#475569" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#1e3a8a" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#60a5fa" }] },
];

/**
 * ContactsMap Component - Refactored to use the new data model
 *
 * Props are now minimal - relies on context for data management
 * State management follows the ContactsContext pattern
 */
export default function ContacctsMap({
    isOpen = false,
    onClose = null,
    contacts = [],
    groups = [],
    selectedContactId = null,
    onContactUpdate = null,
    focusLocation = null
}) {
    // Map refs
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const groupClusterManagerRef = useRef(null);
    
    // UI state
    const [isMapReady, setIsMapReady] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(2);
    const [showLegend, setShowLegend] = useState(false);
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const [mapType, setMapType] = useState('roadmap'); // 'roadmap' or 'satellite'
    const [searchQuery, setSearchQuery] = useState('');

    // Selection state
    const [selectedContact, setSelectedContact] = useState(null);
    const [showContactProfile, setShowContactProfile] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);

    const { t } = useTranslation();

    const translate = useCallback((key, fallback) => {
        const value = t(key);
        return value && value !== key ? value : fallback;
    }, [t]);

    const mapTexts = useMemo(() => ({
        title: translate('contacts.map.title', 'Contacts Map'),
        searchPlaceholder: translate('contacts.map.search_placeholder', 'Search contacts...'),
        searchUnknownLocation: translate('contacts.map.search_unknown_location', 'Unknown location'),
        themeLight: translate('contacts.map.theme.light', 'Light theme'),
        themeDark: translate('contacts.map.theme.dark', 'Dark theme'),
        mapTypeToggle: translate('contacts.map.map_type_toggle', 'Toggle map type'),
        mapTypeSatellite: translate('contacts.map.map_type_satellite', 'Satellite'),
        mapTypeRoadmap: translate('contacts.map.map_type_roadmap', 'Roadmap'),
        close: translate('contacts.map.close', 'Close map'),
        loading: translate('contacts.map.loading', 'Loading map...'),
        zoomLabel: translate('contacts.map.zoom_label', 'Zoom'),
        worldView: translate('contacts.map.world_view', '🌍 World view'),
        regionalView: translate('contacts.map.regional_view', '🗺️ Regional view'),
        streetView: translate('contacts.map.street_view', '📍 Street view'),
        totalLabel: translate('contacts.map.total_label', 'Total'),
        contactsSuffix: translate('contacts.map.contacts_suffix', 'contacts'),
        withLocationLabel: translate('contacts.map.with_location_label', 'with location data'),
        fitAll: translate('contacts.map.controls.fit_all', 'Fit to all contacts'),
        resetWorld: translate('contacts.map.controls.reset', 'Reset to world view'),
        zoomIn: translate('contacts.map.controls.zoom_in', 'Zoom in'),
        zoomOut: translate('contacts.map.controls.zoom_out', 'Zoom out'),
        errorTitle: translate('contacts.map.error.title', 'Map Error'),
        dismiss: translate('contacts.map.error.dismiss', 'Dismiss'),
        ariaLabel: translate('contacts.map.aria_label', 'Interactive contacts map')
    }), [translate]);

    // Responsive detection
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Update map theme when changed
    useEffect(() => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setOptions({
                styles: isDarkTheme ? darkMapStyles : lightMapStyles
            });
        }
    }, [isDarkTheme, mapType]);

    // Filter contacts with valid location data (MUST be defined before filteredContactsBySearch)
    const contactsWithLocation = useMemo(() => {
        const baseContacts = contacts.filter(c => 
            c.location?.latitude && 
            c.location?.longitude &&
            typeof c.location.latitude === 'number' &&
            typeof c.location.longitude === 'number'
        );
        
        // If no group filter, return all contacts with location
        if (!selectedGroupIds || selectedGroupIds.length === 0) {
            return baseContacts;
        }
        
        // Filter by selected group
        const selectedGroup = groups.find(g => g.id === selectedGroupIds[0]);
        if (!selectedGroup || !selectedGroup.contactIds) {
            return [];
        }
        
        const contactIdsInGroup = new Set(selectedGroup.contactIds);
        return baseContacts.filter(contact => contactIdsInGroup.has(contact.id));
    }, [contacts, selectedGroupIds, groups]);

    // Filter contacts by search query
    const filteredContactsBySearch = useMemo(() => {
        if (!searchQuery.trim()) return contactsWithLocation;

        const query = searchQuery.toLowerCase();
        return contactsWithLocation.filter(contact =>
            contact.name?.toLowerCase().includes(query) ||
            contact.displayName?.toLowerCase().includes(query) ||
            contact.location?.city?.toLowerCase().includes(query) ||
            contact.location?.country?.toLowerCase().includes(query)
        );
    }, [contactsWithLocation, searchQuery]);

    // Filter groups to only include those with contacts that have location data
    const filteredGroups = useMemo(() => {
        if (!groups || groups.length === 0) return [];

        const contactIdsWithLocation = new Set(
            contactsWithLocation.map(c => c.id)
        );

        return groups
            .map(group => ({
                ...group,
                contactIds: (group.contactIds || []).filter(id =>
                    contactIdsWithLocation.has(id)
                )
            }))
            .filter(group => group.contactIds.length > 0);
    }, [groups, contactsWithLocation]);

    // Color generator for groups (stable hash)
    const getGroupColor = useCallback((groupId) => {
        let hash = 0;
        for (let i = 0; i < groupId.length; i++) {
            hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - c.length) + c;
    }, []);

    // Group statistics for legend
    const groupStats = useMemo(() => {
        return filteredGroups
            .map(group => ({
                id: group.id,
                name: group.name,
                type: group.type,
                contactCount: group.contactIds.length,
                color: getGroupColor(group.id)
            }))
            .sort((a, b) => b.contactCount - a.contactCount);
    }, [filteredGroups, getGroupColor]);

    // Contact count statistics
    const contactCounts = useMemo(() => ({
        total: contacts.length,
        withLocation: contactsWithLocation.length
    }), [contacts.length, contactsWithLocation.length]);

    // Centralized marker click handler
    const handleMarkerClick = useCallback((contact) => {
        console.log(`🗺️ Marker clicked: ${contact.name || contact.displayName}`);
        
        const map = mapInstanceRef.current;
        if (map && contact.location) {
            map.panTo({
                lat: contact.location.latitude,
                lng: contact.location.longitude,
            });
            
            if (map.getZoom() < 14) {
                map.setZoom(14);
            }
        }

        setSelectedContact(contact);
        setShowContactProfile(true);
    }, []);

    // Handle search contact selection
    const handleSearchSelect = useCallback((contact) => {
        if (mapInstanceRef.current && contact.location) {
            mapInstanceRef.current.panTo({
                lat: contact.location.latitude,
                lng: contact.location.longitude
            });
            if (mapInstanceRef.current.getZoom() < 14) {
                mapInstanceRef.current.setZoom(14);
            }
            handleMarkerClick(contact);
            setSearchQuery('');
        }
    }, [handleMarkerClick]);

    // Handle group toggle from legend
    const handleGroupToggle = useCallback((groupId) => {
        setSelectedGroupIds(prev => {
            const isSelected = prev.includes(groupId);
            if (isSelected) {
                // Remove from selection
                return prev.filter(id => id !== groupId);
            } else {
                // Add to selection (single selection for now)
                return [groupId];
            }
        });
    }, []);

    // Initialize Google Map once per open; avoid feeding readiness state back into dependencies
    useEffect(() => {
        if (!isOpen || mapInstanceRef.current) return;
        
        let isMounted = true;

        const initializeMap = async () => {
            if (!mapRef.current) return;
            
            console.log('🗺️ Initializing map instance');
            
            try {
                const loader = new Loader({
                    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
                    version: 'weekly',
                    libraries: ['maps', 'marker'],
                });
                
                await loader.importLibrary('maps');
                
                if (!isMounted) return;

                // Determine initial center and zoom
                let center = { lat: 20, lng: 0 };
                let zoom = 2;
                const bounds = new google.maps.LatLngBounds();

                // Check for pre-selected contact
                const contactToFocus = selectedContactId 
                    ? contactsWithLocation.find(c => c.id === selectedContactId) 
                    : null;

                if (contactToFocus) {
                    center = { 
                        lat: contactToFocus.location.latitude, 
                        lng: contactToFocus.location.longitude 
                    };
                    zoom = 16;
                } else if (contactsWithLocation.length > 0) {
                    contactsWithLocation.forEach(c => 
                        bounds.extend({ 
                            lat: c.location.latitude, 
                            lng: c.location.longitude 
                        })
                    );
                }

                // Create map instance
                const map = new google.maps.Map(mapRef.current, {
                    center,
                    zoom,
                    styles: isDarkTheme ? darkMapStyles : lightMapStyles,
                    mapTypeId: mapType,
                    mapId: 'CONTACTS_MAP_ID',
                    disableDefaultUI: true,
                    zoomControl: false, // We'll use custom controls
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    gestureHandling: 'greedy'
                });

                // Fit bounds if multiple contacts and no specific focus
                if (!contactToFocus && contactsWithLocation.length > 1) {
                    map.fitBounds(bounds, { padding: 50 });
                }
                
                mapInstanceRef.current = map;
                
                // Attach event listeners
                map.addListener('zoom_changed', () => {
                    if (isMounted) {
                        setCurrentZoom(map.getZoom());
                    }
                });

                map.addListener('idle', () => {
                    if (!isMounted) return;
                    setIsMapReady((prev) => {
                        if (!prev) {
                            console.log('✅ Map is ready');
                        }
                        return true;
                    });
                });

            } catch (e) {
                console.error("Failed to load Google Maps", e);
                if (isMounted) {
                    setError(e.message);
                }
            }
        };

        initializeMap();

        return () => {
            isMounted = false;
            if (groupClusterManagerRef.current) {
                groupClusterManagerRef.current.cleanup();
                groupClusterManagerRef.current = null;
            }
            mapInstanceRef.current = null;
            setIsMapReady(false);
            console.log('🧹 Cleaned up map resources');
        };
    }, [isOpen, selectedContactId, contactsWithLocation, isDarkTheme, mapType]);

    // Initialize and update GroupClusterManager
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current) return;

        const map = mapInstanceRef.current;

        if (!groupClusterManagerRef.current) {
            console.log('🎯 Initializing GroupClusterManager');
            const manager = new GroupClusterManager(
                map, 
                filteredGroups, 
                contactsWithLocation
            );
            groupClusterManagerRef.current = manager;
            manager.setContactClickHandler(handleMarkerClick);
 manager.initialize().then(() => {
    console.log('✅ Manager initialized, marker counts:', {
        groups: manager.groupMarkers.size,
        individuals: manager.individualMarkers.size
    });
    // Force a refresh
    manager.updateMarkersForZoom();
});
            } else {
            console.log('🔄 Updating GroupClusterManager data');
            groupClusterManagerRef.current.setContactClickHandler(handleMarkerClick);
            groupClusterManagerRef.current.updateData(
                filteredGroups, 
                contactsWithLocation
            );
        }

        // Auto-center on selected group
        const timeoutId = setTimeout(() => {
            if (selectedGroupIds && selectedGroupIds.length > 0) {
                const selectedGroupId = selectedGroupIds[0];
                const selectedGroup = filteredGroups.find(g => g.id === selectedGroupId);
                
                if (selectedGroup) {
                    const groupContactIds = new Set(selectedGroup.contactIds);
                    const groupContactsWithLocation = contactsWithLocation.filter(
                        contact => groupContactIds.has(contact.id)
                    );

                    if (groupContactsWithLocation.length > 0) {
                        console.log(`🎯 Centering on group: ${selectedGroup.name}`);

                        if (groupContactsWithLocation.length === 1) {
                            const contact = groupContactsWithLocation[0];
                            map.panTo({
                                lat: contact.location.latitude,
                                lng: contact.location.longitude
                            });
                            if (map.getZoom() < 14) {
                                map.setZoom(14);
                            }
                        } else {
                            const bounds = new google.maps.LatLngBounds();
                            groupContactsWithLocation.forEach(contact => {
                                bounds.extend({
                                    lat: contact.location.latitude,
                                    lng: contact.location.longitude
                                });
                            });
                            map.fitBounds(bounds, {
                                padding: { top: 80, right: 80, bottom: 80, left: 80 }
                            });
                        }
                    }
                }
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        isMapReady, 
        filteredGroups, 
        contactsWithLocation, 
        handleMarkerClick, 
        selectedGroupIds
    ]);

    // Effect to focus on a specific location (e.g., group event location)
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current || !focusLocation) return;

        const map = mapInstanceRef.current;
        const lat = focusLocation.latitude || focusLocation.lat;
        const lng = focusLocation.longitude || focusLocation.lng;

        if (lat && lng) {
            console.log('🎯 Focusing on location:', focusLocation.name || 'Event Location');
            map.panTo({ lat, lng });

            // Zoom in to show the location clearly
            if (map.getZoom() < 15) {
                map.setZoom(15);
            }

            // Optionally add a marker for the focused location
            if (window.google && window.google.maps) {
                // Remove any existing focus marker
                if (mapInstanceRef.current.focusMarker) {
                    mapInstanceRef.current.focusMarker.setMap(null);
                }

                // Create a new marker for the focused location
                const marker = new google.maps.Marker({
                    position: { lat, lng },
                    map: map,
                    title: focusLocation.name || 'Event Location',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#10b981',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3,
                        scale: 10
                    },
                    animation: google.maps.Animation.DROP
                });

                // Store reference to remove later
                mapInstanceRef.current.focusMarker = marker;

                // Add info window if location has a name
                if (focusLocation.name) {
                    const infoWindow = new google.maps.InfoWindow({
                        content: `<div style="padding: 8px; font-weight: 500;">${focusLocation.name}</div>`
                    });
                    infoWindow.open(map, marker);

                    // Auto-close after 5 seconds
                    setTimeout(() => {
                        infoWindow.close();
                    }, 5000);
                }
            }
        }
    }, [isMapReady, focusLocation]);

    // Navigation functions
    const fitToAllContacts = useCallback(() => {
        if (contactsWithLocation.length > 0 && mapInstanceRef.current) {
            const bounds = new google.maps.LatLngBounds();
            contactsWithLocation.forEach(contact => {
                bounds.extend({
                    lat: contact.location.latitude,
                    lng: contact.location.longitude
                });
            });
            
            mapInstanceRef.current.fitBounds(bounds, {
                padding: { top: 50, right: 50, bottom: 50, left: 50 }
            });
        }
    }, [contactsWithLocation]);

    const resetToWorldView = useCallback(() => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: 20, lng: 0 });
            mapInstanceRef.current.setZoom(2);
            setSelectedGroupIds([]);
        }
    }, []);

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 md:px-4 md:pt-20 md:pb-4">
            <div className="bg-white w-full h-full md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden relative md:border md:border-gray-200">
                {/* Minimal Top Bar */}
                <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                    <div className="flex items-center justify-between p-3 md:p-4">
                        {/* Left side - Title & Search */}
                        <div className="flex items-center gap-3 pointer-events-auto">
                            {/* Compact title badge - Just icon and title */}
                            <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-4 py-2.5 border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <h2 className="text-sm font-semibold text-gray-900">
                                        {mapTexts.title}
                                    </h2>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="relative hidden md:block">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={mapTexts.searchPlaceholder}
                                    className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl pl-10 pr-4 py-2.5 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-64 transition-all"
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>

                                {/* Search Results Dropdown */}
                                {searchQuery && filteredContactsBySearch.length > 0 && (
                                    <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-md shadow-xl rounded-xl border border-gray-100 max-h-64 overflow-y-auto">
                                        {filteredContactsBySearch.slice(0, 5).map(contact => (
                                            <button
                                                key={contact.id}
                                                onClick={() => handleSearchSelect(contact)}
                                                className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-purple-700 text-sm font-medium">
                                                        {(contact.name || contact.displayName || '?').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {contact.name || contact.displayName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 truncate">
                                                        {contact.location?.city && contact.location?.country
                                                            ? `${contact.location.city}, ${contact.location.country}`
                                                            : contact.location?.country || mapTexts.searchUnknownLocation}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right side - Controls */}
                        <div className="flex items-center gap-2 pointer-events-auto">
                            {/* Theme Toggle */}
                            <button
                                onClick={() => setIsDarkTheme(!isDarkTheme)}
                                className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl p-2.5 border border-gray-100 hover:bg-gray-50 transition-all group"
                                title={isDarkTheme ? mapTexts.themeLight : mapTexts.themeDark}
                            >
                                {isDarkTheme ? (
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                )}
                            </button>

                            {/* Map Type Toggle */}
                            <button
                                onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
                                className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-3 py-2.5 border border-gray-100 hover:bg-gray-50 transition-all text-xs font-medium text-gray-700 hidden md:block"
                                title={mapTexts.mapTypeToggle}
                            >
                                {mapType === 'roadmap' ? (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {mapTexts.mapTypeSatellite}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                        {mapTexts.mapTypeRoadmap}
                                    </div>
                                )}
                            </button>

                            {/* Close button - More prominent */}
                            <button
                                onClick={onClose}
                                className="bg-red-500 hover:bg-red-600 backdrop-blur-md shadow-lg rounded-xl p-2.5 border border-red-600 transition-all group"
                                aria-label={mapTexts.close}
                                title={mapTexts.close}
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

               

                {/* Map Container - Full Screen */}
                <div className="absolute inset-0">
                    {/* Loading State */}
                    {!isMapReady && (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center z-10">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200"></div>
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent absolute inset-0"></div>
                                </div>
                                <div className="bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg">
                                    <span className="text-gray-700 text-sm font-medium">
                                        {mapTexts.loading}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Map Element */}
                    <div 
                        className="h-full w-full"
                        ref={mapRef}
                        aria-label={mapTexts.ariaLabel}
                    />

                    {/* Modern Floating Controls (only show when ready) */}
                    {isMapReady && (
                        <>
                            {/* Bottom Left - Zoom Indicator & Map Info */}
                            <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
                                {/* Zoom Level */}
                                <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-3 py-2 border border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        <span className="text-xs font-medium text-gray-700">
                                            {`${mapTexts.zoomLabel} ${currentZoom}`}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Info */}
                                {!isMobile && (
                                    <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-3 py-2 border border-gray-100 text-xs text-gray-600">
                                        {currentZoom < 11 && mapTexts.worldView}
                                        {currentZoom >= 11 && currentZoom < 14 && mapTexts.regionalView}
                                        {currentZoom >= 14 && mapTexts.streetView}
                                    </div>
                                )}

                                {/* Contact Statistics */}
                                <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl px-3 py-2 border border-gray-100">
                                    <div className="text-xs space-y-1">
                                        <div className="font-medium text-gray-700">
                                            {`${mapTexts.totalLabel}: ${contacts.length} ${mapTexts.contactsSuffix}`}
                                        </div>
                                        <div className="text-gray-600">
                                            {`📍 ${contactsWithLocation.length} ${mapTexts.withLocationLabel}`}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Right - Navigation Controls */}
                            <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
                                {/* Fit All Button */}
                                <button
                                    onClick={fitToAllContacts}
                                    disabled={contactsWithLocation.length === 0}
                                    className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl p-3 border border-gray-100 text-gray-700 hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                    title={mapTexts.fitAll}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>

                                {/* Reset View Button */}
                                <button
                                    onClick={resetToWorldView}
                                    className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl p-3 border border-gray-100 text-gray-700 hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all group"
                                    title={mapTexts.resetWorld}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>

                                {/* Custom Zoom Controls */}
                                <div className="bg-white/95 backdrop-blur-md shadow-lg rounded-xl border border-gray-100 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            const map = mapInstanceRef.current;
                                            if (map) map.setZoom(map.getZoom() + 1);
                                        }}
                                        className="p-3 text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 block w-full"
                                        title={mapTexts.zoomIn}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const map = mapInstanceRef.current;
                                            if (map) map.setZoom(map.getZoom() - 1);
                                        }}
                                        className="p-3 text-gray-700 hover:bg-gray-50 transition-colors block w-full"
                                        title={mapTexts.zoomOut}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                          
                        </>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-50 border border-red-200 rounded-lg p-4 z-50 max-w-md">
                            <div className="flex items-center gap-2 text-red-800">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="font-medium">{mapTexts.errorTitle}</span>
                            </div>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200 transition-colors"
                            >
                                {mapTexts.dismiss}
                            </button>
                        </div>
                    )}
                </div>

                {/* Contact Profile Modal */}
                <ContactProfileModal
                    isOpen={showContactProfile}
                    onClose={() => {
                        setShowContactProfile(false);
                        setSelectedContact(null);
                    }}
                    contact={selectedContact}
                    groups={groups}
                    onContactUpdate={onContactUpdate}
                />
            </div>
        </div>
    );
}
