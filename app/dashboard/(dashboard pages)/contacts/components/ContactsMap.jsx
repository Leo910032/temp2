/////////////////////////////////////////////////////////////////////////////////////////////////////////////
'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useTranslation } from "@/lib/translation/useTranslation";
import GroupClusterManager from './ContactsMap/GroupClusterManager';
import ContactProfileModal from './ContactsMap/ContactProfileModal';
import { ZoomIndicator } from './ContactsMap/ZoomIndicator';
import { MapLegend } from './ContactsMap/MapLegend';

export default function ContactsMap({ 
    contacts = [], 
    selectedContactId = null, 
    onMarkerClick = null,
    groups = [],
    selectedGroupIds = [],
    onGroupToggle = null,
    onContactsUpdate = null,
    isOpen = false,
    onClose = null
}) {
    const { t } = useTranslation();
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const groupClusterManagerRef = useRef(null);
    
    const [isMapReady, setIsMapReady] = useState(false);
    const [error, setError] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [currentZoom, setCurrentZoom] = useState(2);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showContactProfile, setShowContactProfile] = useState(false);
    const [showLegend, setShowLegend] = useState(false);
    const [clusterState, setClusterState] = useState(null); // Keep this if ZoomIndicator uses it

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const contactsWithLocation = useMemo(() => {
        const baseContacts = contacts.filter(c => c.location?.latitude && c.location?.longitude);
        if (!selectedGroupIds || selectedGroupIds.length === 0) return baseContacts;
        const selectedGroup = groups.find(g => g.id === selectedGroupIds[0]);
        if (!selectedGroup) return [];
        const contactIdsInGroup = new Set(selectedGroup.contactIds);
        return baseContacts.filter(contact => contactIdsInGroup.has(contact.id));
    }, [contacts, selectedGroupIds, groups]);

    const filteredGroups = useMemo(() => {
        if (!groups.length) return [];
        return groups.map(group => ({
            ...group,
            contactIds: group.contactIds ? group.contactIds.filter(id => contacts.some(c => c.id === id)) : []
        })).filter(group => group.contactIds.length > 0);
    }, [groups, contacts]);

    // Centralized click handler using useCallback for stability
    const handleMarkerClick = useCallback((contact) => {
        console.log(`🗺️ Marker clicked: ${contact.name}`);
        const map = mapInstanceRef.current; // Get the LATEST map instance

        if (map && contact.location) {
            console.log(` panning to:`, { lat: contact.location.latitude, lng: contact.location.longitude });
            map.panTo({
                lat: contact.location.latitude,
                lng: contact.location.longitude,
            });
            if (map.getZoom() < 14) {
                 map.setZoom(14);
            }
        } else {
            console.warn("Could not pan map. Map instance or contact location missing.");
        }

        if (onMarkerClick) onMarkerClick(contact);
        setSelectedContact(contact);
        setShowContactProfile(true);
    }, [onMarkerClick]); // Dependency array ensures this function is stable

    // Effect 1: Initialize the Google Map instance
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
                await loader.importLibrary('maps'); // This populates google.maps
                if (!isMounted) return;

                let center = { lat: 20, lng: 0 };
                let zoom = 2;
                const bounds = new google.maps.LatLngBounds();

                const contactToFocus = selectedContactId ? contactsWithLocation.find(c => c.id === selectedContactId) : null;

                if (contactToFocus) {
                    center = { lat: contactToFocus.location.latitude, lng: contactToFocus.location.longitude };
                    zoom = 16;
                } else if (contactsWithLocation.length > 0) {
                    contactsWithLocation.forEach(c => bounds.extend({ lat: c.location.latitude, lng: c.location.longitude }));
                }

                const map = new google.maps.Map(mapRef.current, {
                    center,
                    zoom,
                    mapId: 'CONTACTS_MAP_ID',
                    disableDefaultUI: true,
                    zoomControl: true,
                });

                if (!contactToFocus && contactsWithLocation.length > 1) {
                    map.fitBounds(bounds, { padding: 50 });
                }
                
                mapInstanceRef.current = map;
                
                map.addListener('zoom_changed', () => {
                    if (isMounted) setCurrentZoom(map.getZoom());
                });

                map.addListener('idle', () => {
                    if (isMounted && !isMapReady) {
                        setIsMapReady(true);
                        console.log('✅ Map is ready and idle');
                    }
                });

            } catch (e) {
                console.error("Failed to load Google Maps", e);
                if (isMounted) setError(e.message);
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
            console.log('🧹 Cleaned up map resources.');
        };
    }, [isOpen, selectedContactId]); // Re-init map only when modal opens or a specific contact is pre-selected

    // Effect 2: Initialize and update the GroupClusterManager (with integrated centering)
    useEffect(() => {
        if (!isMapReady || !mapInstanceRef.current) return;

        const map = mapInstanceRef.current;

        if (!groupClusterManagerRef.current) {
            console.log('🎯 Initializing GroupClusterManager...');
            const manager = new GroupClusterManager(map, filteredGroups, contactsWithLocation);
            groupClusterManagerRef.current = manager;
            manager.setContactClickHandler(handleMarkerClick);
            manager.initialize();
        } else {
            console.log('🔄 Updating GroupClusterManager data...');
            groupClusterManagerRef.current.setContactClickHandler(handleMarkerClick);
            groupClusterManagerRef.current.updateData(filteredGroups, contactsWithLocation);
        }

        // IMPORTANT: Add a small delay before centering to ensure markers are rendered
        const timeoutId = setTimeout(() => {
            // Only center if a specific group is selected
            if (selectedGroupIds && selectedGroupIds.length > 0) {
                const selectedGroupId = selectedGroupIds[0];
                const selectedGroup = filteredGroups.find(g => g.id === selectedGroupId);
                
                if (selectedGroup) {
                    const groupContactIds = new Set(selectedGroup.contactIds);
                    const groupContactsWithLocation = contactsWithLocation.filter(contact => 
                        groupContactIds.has(contact.id)
                    );

                    if (groupContactsWithLocation.length > 0) {
                        console.log(`🎯 Centering map on group: ${selectedGroup.name} with ${groupContactsWithLocation.length} contacts`);

                        if (groupContactsWithLocation.length === 1) {
                            // Single contact - center and zoom to it
                            const contact = groupContactsWithLocation[0];
                            map.panTo({
                                lat: contact.location.latitude,
                                lng: contact.location.longitude
                            });
                            if (map.getZoom() < 14) {
                                map.setZoom(14);
                            }
                        } else {
                            // Multiple contacts - fit bounds to show all contacts in the group
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
        }, 300); // 300ms delay to ensure markers are rendered

        return () => {
            clearTimeout(timeoutId);
        };
    }, [isMapReady, filteredGroups, contactsWithLocation, handleMarkerClick, selectedGroupIds]);

    const groupStats = useMemo(() => {
        return filteredGroups.map(group => ({
            id: group.id,
            name: group.name,
            type: group.type,
            contactCount: group.contactIds.length,
        })).sort((a, b) => b.contactCount - a.contactCount);
    }, [filteredGroups]);
    
    const contactCounts = useMemo(() => ({
        total: contacts.length,
        withLocation: contactsWithLocation.length
    }), [contacts.length, contactsWithLocation.length]);

    // A simple color generator for groups in the legend
    const getGroupColor = useCallback((groupId) => {
        // Simple hash function to get a color from a string
        let hash = 0;
        for (let i = 0; i < groupId.length; i++) {
            hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - c.length) + c;
    }, []);
    
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
        }
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {t('contacts.map_view') || 'Contacts Map'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {contactsWithLocation.length} contacts with location data
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Map Container */}
                <div className="flex-1 relative">
                    {/* Loading state */}
                    {!isMapReady  && (
                        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                            <div className="flex flex-col items-center space-y-3">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                                <span className="text-gray-500 text-sm font-medium">
                                    Loading contact map...
                                </span>
                            </div>
                        </div>
                    )}
                    
                    {/* Map */}
                    <div 
                        className="h-full w-full"
                        ref={mapRef}
                    />

                    {/* Map Controls */}
                    {isMapReady  && (
                        <>
                            {/* Zoom Indicator */}
                            <ZoomIndicator 
                                isMapReady ={isMapReady }
                                currentZoom={currentZoom}
                                clusterState={clusterState}
                            />

                            {/* Navigation Controls */}
                            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
                                <button
                                    onClick={fitToAllContacts}
                                    disabled={contactsWithLocation.length === 0}
                                    className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Fit to all contacts"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                    <span className="hidden sm:inline">Fit All</span>
                                </button>
                                
                                <button
                                    onClick={resetToWorldView}
                                    className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                    title="Reset to world view"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">World</span>
                                </button>
                            </div>

                            {/* Helper Text */}
                            {!isMobile && contactsWithLocation.length > 1 && (
                                <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow border text-xs text-gray-500 max-w-64 z-20">
                                    <div className="font-medium text-gray-700 mb-1">
                                        Contact Map Guide
                                    </div>
                                    {currentZoom < 11 && (
                                        <div>Group clusters view - Zoom in to see individual contacts</div>
                                    )}
                                    {currentZoom >= 11 && currentZoom < 14 && (
                                        <div>Mixed view - Large groups as clusters, individuals separate</div>
                                    )}
                                    {currentZoom >= 14 && (
                                        <div>Individual view - All contacts visible as markers</div>
                                    )}
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div>Click markers to view contact details</div>
                                    </div>
                                </div>
                            )}
                             
                        {/* Map Legend Component */}
                        <MapLegend
                            isLoaded={isMapReady}
                            isMobile={isMobile}
                            showLegend={showLegend}
                            setShowLegend={setShowLegend}
                            groupStats={groupStats}
                            contactCounts={contactCounts}
                            onGroupToggle={onGroupToggle} // Pass the prop through
                            getGroupColor={getGroupColor}
                            contactsWithLocation={contactsWithLocation}
                        />
                        </>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-50 border border-red-200 rounded-lg p-4 z-50">
                            <div className="flex items-center gap-2 text-red-800">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="font-medium">Map Error</span>
                            </div>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200 transition-colors"
                            >
                                Dismiss
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
                    onContactUpdate={onContactsUpdate}
                />
            </div>
        </div>
    );

}