// app/dashboard/(dashboard pages)/contacts/components/ContactsMap/GroupClusterManager.js
// Enhanced Group Cluster Manager Class - Client-side Google Maps visualization

export default class GroupClusterManager {
    constructor(map, groups, contacts, options = {}) {
        console.log('🆕 GroupClusterManager v2.3 constructor called');
        this.map = map;
        this.groups = groups;
        this.contacts = contacts;
        this.options = {
            groupColors: [
                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
            ],
            zoomThresholds: {
                groupClusters: 12,  // Below zoom 12: show group clusters
                individualMarkers: 15 // Above zoom 15: show individual markers
            },
            collisionOffset: 0.015,
            // Maximum distance threshold for "wide" groups (in kilometers)
            wideGroupThreshold: 500, // 500km - groups wider than this are considered "wide"
            ...options
        };

        this.groupMarkers = new Map();
        this.individualMarkers = new Map();
        this.wideGroups = new Set(); // Track which groups are "wide"
        this.directionalArrows = new Map();
        this.currentZoom = this.map.getZoom();
        this.isInitialized = false;

        // Initialize activeContactIds to include all contacts by default
        this.activeContactIds = new Set(this.contacts.map(c => c.id));
    }

  async initialize() {
    console.log('🚀 Initializing group cluster visualization v2.3');
    console.log('🆕 VERSION 2.3 - Enhanced with Wide Group Detection');

    if (this.isInitialized) {
        console.log('⚠️ Already initialized, skipping...');
        return;
    }

    // Add these debug logs
    console.log('📊 About to process groups. Groups count:', this.groups.length);
    console.log('📊 About to process contacts. Contacts count:', this.contacts.length);

    // Set up zoom change listener
    this.map.addListener('zoom_changed', () => {
        const newZoom = this.map.getZoom();
        if (Math.abs(newZoom - this.currentZoom) > 0.5) {
            this.currentZoom = newZoom;
            this.updateMarkersForZoom();
        }
    });

    await this.processGroups();
    console.log('✅ processGroups() completed. Markers created:', this.groupMarkers.size);
    
    await this.processUngroupedContacts();
    console.log('✅ processUngroupedContacts() completed');
    
    this.updateMarkersForZoom();

    this.isInitialized = true;
    console.log('✅ Group cluster visualization initialized');
}
    async processGroups() {
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

        const positionCounts = new Map();

        for (const [index, group] of this.groups.entries()) {
            const groupContacts = this.contacts.filter(contact =>
                group.contactIds.includes(contact.id)
            );

            const contactsWithLocation = groupContacts.filter(contact =>
                contact.location?.latitude && contact.location?.longitude
            );
              console.log(`Group "${group.name}":`, {
            totalContacts: groupContacts.length,
            withLocation: contactsWithLocation.length
        });

            if (contactsWithLocation.length === 0) continue;

            const groupData = this.calculateGroupClusterData(group, contactsWithLocation, index);

            // Check if this is a "wide" group
            const isWideGroup = this.isWideGroup(contactsWithLocation);
            if (isWideGroup) {
                this.wideGroups.add(group.id);
                groupData.isWide = true;
                console.log(`📏 Wide group detected: ${group.name} (max distance: ${groupData.maxDistance.toFixed(2)}km)`);
            }

            // Spider-fying logic
            const originalPosition = groupData.center;
            const posKey = `${originalPosition.lat.toFixed(5)},${originalPosition.lng.toFixed(5)}`;

            const countAtPosition = positionCounts.get(posKey) || 0;

            const { newPosition, adjusted } = this.getSpiderfiedPosition(originalPosition, countAtPosition);

            groupData.adjustedPosition = newPosition;
            groupData.isAdjusted = adjusted;

            positionCounts.set(posKey, countAtPosition + 1);

            // Create marker using the (potentially adjusted) position
            const groupClusterMarker = await this.createGroupClusterMarker(groupData);

            const individualMarkers = await this.createIndividualMarkersForGroup(groupData);

            this.groupMarkers.set(group.id, {
                marker: groupClusterMarker,
                data: groupData,
                visible: false
            });

            this.individualMarkers.set(group.id, {
                markers: individualMarkers,
                data: groupData,
                visible: false
            });
        }
    }

    // Check if a group is "wide" (members are geographically far apart)
    isWideGroup(contacts) {
        if (contacts.length < 2) return false;

        let maxDistance = 0;
        for (let i = 0; i < contacts.length; i++) {
            for (let j = i + 1; j < contacts.length; j++) {
                const distance = this.calculateDistance(
                    contacts[i].location.latitude,
                    contacts[i].location.longitude,
                    contacts[j].location.latitude,
                    contacts[j].location.longitude
                ) / 1000; // Convert to kilometers

                maxDistance = Math.max(maxDistance, distance);
            }
        }

        return maxDistance > this.options.wideGroupThreshold;
    }

    getSpiderfiedPosition(position, count) {
        if (count === 0) {
            console.log(`📍 Placing first marker for position: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`);
            return { newPosition: position, adjusted: false };
        }

        console.log(`💥 Collision #${count} detected at ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}. Spider-fying...`);

        const angle = count * 0.5;
        const separation = this.options.collisionOffset * Math.sqrt(count);

        const newPosition = {
            lat: position.lat + separation * Math.cos(angle),
            lng: position.lng + separation * Math.sin(angle),
        };

        console.log(`➡️ Offset applied. New position: ${newPosition.lat.toFixed(5)}, ${newPosition.lng.toFixed(5)}`);

        return { newPosition, adjusted: true };
    }

    calculateGroupClusterData(group, contactsWithLocation, colorIndex) {
        const center = this.calculateCenter(contactsWithLocation);
        const radius = this.calculateRadius(contactsWithLocation, center);
        const color = this.options.groupColors[colorIndex % this.options.groupColors.length];

        // Calculate maximum distance between any two contacts
        let maxDistance = 0;
        for (let i = 0; i < contactsWithLocation.length; i++) {
            for (let j = i + 1; j < contactsWithLocation.length; j++) {
                const distance = this.calculateDistance(
                    contactsWithLocation[i].location.latitude,
                    contactsWithLocation[i].location.longitude,
                    contactsWithLocation[j].location.latitude,
                    contactsWithLocation[j].location.longitude
                ) / 1000; // Convert to kilometers

                maxDistance = Math.max(maxDistance, distance);
            }
        }

        return {
            group: group,
            contacts: contactsWithLocation,
            center: center,
            radius: radius,
            color: color,
            memberCount: contactsWithLocation.length,
            bounds: this.calculateBounds(contactsWithLocation),
            maxDistance: maxDistance
        };
    }

    calculateCenter(contacts) {
        const avgLat = contacts.reduce((sum, contact) => sum + contact.location.latitude, 0) / contacts.length;
        const avgLng = contacts.reduce((sum, contact) => sum + contact.location.longitude, 0) / contacts.length;
        return { lat: avgLat, lng: avgLng };
    }

    calculateRadius(contacts, center) {
        let maxDistance = 0;
        contacts.forEach(contact => {
            const distance = this.calculateDistance(
                center.lat, center.lng,
                contact.location.latitude, contact.location.longitude
            );
            maxDistance = Math.max(maxDistance, distance);
        });
        return Math.max(50, Math.min(500, maxDistance));
    }

    calculateBounds(contacts) {
        const bounds = new google.maps.LatLngBounds();
        contacts.forEach(contact => {
            bounds.extend({
                lat: contact.location.latitude,
                lng: contact.location.longitude
            });
        });
        return bounds;
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    async createGroupClusterMarker(groupData) {
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');

        const clusterElement = this.createClusterElement(groupData, groupData.isAdjusted);

        const marker = new AdvancedMarkerElement({
            map: null,
            position: groupData.adjustedPosition,
            content: clusterElement,
            title: `${groupData.group.name} (${groupData.memberCount} members)${groupData.isWide ? ' - Wide group' : ''}`,
        });

        clusterElement.addEventListener('click', () => {
            if (groupData.isWide) {
                // For wide groups, show a message and then zoom to bounds
                this.showWideGroupMessage(groupData);
                setTimeout(() => {
                    this.zoomToGroup(groupData);
                }, 1500); // Delay to let user read the message
            } else {
                this.zoomToGroup(groupData);
            }
        });

        return marker;
    }

    // Show message for wide groups
    showWideGroupMessage(groupData) {
        // Create a temporary message overlay
        const messageContainer = document.createElement('div');
        messageContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 500;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            line-height: 1.4;
        `;

        messageContainer.innerHTML = `
            <div style="margin-bottom: 8px;">📏 Wide Group Detected</div>
            <div style="font-size: 14px; opacity: 0.9;">
                "${groupData.group.name}" has members spread across
                ${Math.round(groupData.maxDistance)}km.
                Zooming to show all members...
            </div>
        `;

        document.body.appendChild(messageContainer);

        // Fade in
        messageContainer.style.opacity = '0';
        requestAnimationFrame(() => {
            messageContainer.style.transition = 'opacity 0.3s ease';
            messageContainer.style.opacity = '1';
        });

        // Remove after delay
        setTimeout(() => {
            messageContainer.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(messageContainer)) {
                    document.body.removeChild(messageContainer);
                }
            }, 300);
        }, 1200);
    }

    createClusterElement(groupData, isAdjusted = false) {
        const container = document.createElement('div');
        container.className = 'group-cluster-container';
        if(isAdjusted) container.title = 'Position adjusted to avoid overlap';
        if(groupData.isWide) container.title += ' - Wide group (members far apart)';

        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        const circle = document.createElement('div');
        circle.className = 'group-cluster-circle';

        // Different styling for wide groups
        const borderStyle = groupData.isWide
            ? '3px dotted white'
            : isAdjusted
                ? '3px dashed white'
                : '3px solid white';

        circle.style.cssText = `
            width: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
            height: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
            background: ${groupData.color};
            border: ${borderStyle};
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            ${groupData.isWide ? 'animation: pulse-wide 2s infinite;' : ''}
        `;

        // Add CSS animation for wide groups
        if (groupData.isWide && !document.getElementById('wide-group-animation')) {
            const style = document.createElement('style');
            style.id = 'wide-group-animation';
            style.textContent = `
                @keyframes pulse-wide {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(style);
        }

        const count = document.createElement('span');
        count.textContent = groupData.memberCount.toString();
        count.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: ${groupData.memberCount > 99 ? '10px' : '12px'};
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(count);

        const popup = document.createElement('div');
        popup.className = 'group-cluster-popup';
        popup.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 6px 10px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 12px;
            font-weight: 500;
            color: #374151;
            white-space: nowrap;
            margin-bottom: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            z-index: 1000;
        `;

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: white;
        `;
        popup.appendChild(arrow);

        let popupText = groupData.group.name;
        if (groupData.isWide) {
            popupText += ` (Wide: ${Math.round(groupData.maxDistance)}km)`;
        } else if (isAdjusted) {
            popupText += ` (Position adjusted)`;
        }

        popup.innerHTML = `${popupText}<br><small>${groupData.memberCount} members</small>` + popup.innerHTML;

        container.addEventListener('mouseenter', () => {
            circle.style.transform = 'scale(1.1)';
            popup.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            circle.style.transform = 'scale(1)';
            popup.style.opacity = '0';
        });

        container.appendChild(circle);
        container.appendChild(popup);

        return container;
    }

    async createIndividualMarkersForGroup(groupData) {
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
        const markers = [];

        for (const contact of groupData.contacts) {
            const markerElement = this.createIndividualMarkerElement(contact, groupData);

            const marker = new AdvancedMarkerElement({
                map: null,
                position: { lat: contact.location.latitude, lng: contact.location.longitude },
                content: markerElement,
                title: contact.name,
            });

            markerElement.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onContactClick) {
                    this.onContactClick(contact);
                }
            });

            markers.push({
                marker: marker,
                contact: contact,
                element: markerElement
            });
        }

        return markers;
    }

    createIndividualMarkerElement(contact, groupData) {
        const container = document.createElement('div');
        container.className = 'individual-contact-marker NEW_MARKER';
        container.setAttribute('data-contact-id', contact.id);
        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        const circle = document.createElement('div');
        circle.style.cssText = `
            width: 32px;
            height: 32px;
            background: ${groupData.color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;

        const initials = document.createElement('span');
        initials.textContent = this.getInitials(contact.name);
        initials.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: 10px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(initials);

        const popup = document.createElement('div');
        popup.className = 'contact-popup';
        popup.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 12px;
            color: #374151;
            white-space: nowrap;
            margin-bottom: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            z-index: 1000;
        `;

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: white;
        `;
        popup.appendChild(arrow);

        popup.innerHTML = `
            <div style="font-weight: 500;">${contact.name}</div>
            ${contact.company ? `<div style="font-size: 10px; color: #6B7280;">${contact.company}</div>` : ''}
        ` + popup.innerHTML;

        container.addEventListener('mouseenter', () => {
            circle.style.transform = 'scale(1.2)';
            popup.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            circle.style.transform = 'scale(1)';
            popup.style.opacity = '0';
        });

        container.appendChild(circle);
        container.appendChild(popup);

        return container;
    }

    async processUngroupedContacts() {
        const groupedContactIds = new Set();
        this.groups.forEach(group => {
            group.contactIds.forEach(id => groupedContactIds.add(id));
        });

        const ungroupedContacts = this.contacts.filter(contact =>
            !groupedContactIds.has(contact.id) &&
            contact.location?.latitude && contact.location?.longitude
        );

        if (ungroupedContacts.length === 0) return;

        const ungroupedMarkers = [];
        for (const contact of ungroupedContacts) {
            const markerElement = this.createUngroupedMarkerElement(contact);

            const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
            const marker = new AdvancedMarkerElement({
                map: null,
                position: { lat: contact.location.latitude, lng: contact.location.longitude },
                content: markerElement,
                title: contact.name,
            });

            markerElement.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onContactClick) {
                    this.onContactClick(contact);
                }
            });

            ungroupedMarkers.push({
                marker: marker,
                contact: contact,
                element: markerElement
            });
        }

        this.individualMarkers.set('ungrouped', {
            markers: ungroupedMarkers,
            data: { contacts: ungroupedContacts },
            visible: false
        });
    }

    createUngroupedMarkerElement(contact) {
        const container = document.createElement('div');
        container.className = 'ungrouped-contact-marker NEW_MARKER';
        container.setAttribute('data-contact-id', contact.id);
        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        const circle = document.createElement('div');
        circle.style.cssText = `
            width: 28px;
            height: 28px;
            background: #6B7280;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;

        const initials = document.createElement('span');
        initials.textContent = this.getInitials(contact.name);
        initials.style.cssText = `
            color: white;
            font-weight: bold;
            font-size: 9px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        circle.appendChild(initials);

        const popup = document.createElement('div');
        popup.className = 'contact-popup';
        popup.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 8px 12px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 12px;
            color: #374151;
            white-space: nowrap;
            margin-bottom: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            z-index: 1000;
        `;

        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: white;
        `;
        popup.appendChild(arrow);

        popup.innerHTML = `
            <div style="font-weight: 500;">${contact.name}</div>
            ${contact.company ? `<div style="font-size: 10px; color: #6B7280;">${contact.company}</div>` : ''}
            <div style="font-size: 10px; color: #9CA3AF;">No group</div>
        ` + popup.innerHTML;

        container.addEventListener('mouseenter', () => {
            circle.style.transform = 'scale(1.2)';
            popup.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            circle.style.transform = 'scale(1)';
            popup.style.opacity = '0';
        });

        container.appendChild(circle);
        container.appendChild(popup);

        return container;
    }

    getInitials(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    updateMarkersForZoom() {
        console.log(`🔄 Updating markers for zoom level: ${this.currentZoom}`);
        const zoom = this.currentZoom;
         console.log('Zoom thresholds check:', {
        zoom,
        showGroupClusters: zoom < this.options.zoomThresholds.groupClusters,
        showIndividual: zoom >= this.options.zoomThresholds.individualMarkers,
        showMixed: zoom >= this.options.zoomThresholds.groupClusters && zoom < this.options.zoomThresholds.individualMarkers
    });
    
        const showGroupClusters = zoom < this.options.zoomThresholds.groupClusters;
        const showIndividualMarkers = zoom >= this.options.zoomThresholds.individualMarkers;
        const showMixed = zoom >= this.options.zoomThresholds.groupClusters && zoom < this.options.zoomThresholds.individualMarkers;

        if (showGroupClusters) {
            console.log('📍 Low zoom - showing group clusters');
            this.showGroupClusters();
            this.hideIndividualMarkers();
        } else if (showIndividualMarkers) {
            console.log('📍 High zoom - showing individual markers');
            this.hideGroupClusters();
            this.showIndividualMarkers();
        } else if (showMixed) {
            console.log('📍 Medium zoom - showing mixed view');
            this.showMixedView();
        }
    }

  showGroupClusters() {
    console.log('👁️ Showing group clusters...');
    let visibleCount = 0;
    this.groupMarkers.forEach((groupInfo) => {
        if (!groupInfo.visible) {
            groupInfo.marker.map = this.map;
            groupInfo.visible = true;
            visibleCount++;
        }
    });
    if (visibleCount > 0) console.log(`✅ Displayed ${visibleCount} group clusters.`);
    
    // Hide grouped individual markers but keep ungrouped visible
    this.hideIndividualMarkers();
}

    hideGroupClusters() {
        console.log('👁️ Hiding group clusters...');
        let hiddenCount = 0;
        this.groupMarkers.forEach((groupInfo) => {
            if (groupInfo.visible) {
                groupInfo.marker.map = null;
                groupInfo.visible = false;
                hiddenCount++;
            }
        });
        if (hiddenCount > 0) console.log(`✅ Hid ${hiddenCount} group clusters.`);
    }

    showIndividualMarkers() {
        console.log('👁️ Showing individual markers...');
        this.individualMarkers.forEach((markerInfo, groupId) => {
            if (!markerInfo.visible) {
                markerInfo.markers.forEach(({ marker }) => marker.map = this.map);
                markerInfo.visible = true;
                console.log(`✅ Displayed ${markerInfo.markers.length} individual markers for group: ${groupId}`);
            }
        });
        this.hideGroupClusters();
    }

  hideIndividualMarkers() {
    console.log('👁️ Hiding individual markers...');
    this.individualMarkers.forEach((markerInfo, groupId) => {
        // Keep ungrouped contacts always visible
        if (groupId === 'ungrouped') {
            if (!markerInfo.visible) {
                markerInfo.markers.forEach(({ marker }) => marker.map = this.map);
                markerInfo.visible = true;
                console.log(`✅ Keeping ungrouped contacts visible (${markerInfo.markers.length} markers)`);
            }
            return;
        }
        
        if (markerInfo.visible) {
            markerInfo.markers.forEach(({ marker }) => marker.map = null);
            markerInfo.visible = false;
        }
    });
}

    showMixedView() {
        this.groupMarkers.forEach((groupInfo, groupId) => {
            const shouldShowCluster = groupInfo.data.memberCount >= 3;
            const individualInfo = this.individualMarkers.get(groupId);

            if (shouldShowCluster) {
                if (!groupInfo.visible) {
                    groupInfo.marker.map = this.map;
                    groupInfo.visible = true;
                }
                if (individualInfo?.visible) {
                    individualInfo.markers.forEach(({ marker }) => marker.map = null);
                    individualInfo.visible = false;
                }
            } else {
                if (groupInfo.visible) {
                    groupInfo.marker.map = null;
                    groupInfo.visible = false;
                }
                if (individualInfo && !individualInfo.visible) {
                    individualInfo.markers.forEach(({ marker }) => marker.map = this.map);
                    individualInfo.visible = true;
                }
            }
        });

        const ungroupedInfo = this.individualMarkers.get('ungrouped');
        if (ungroupedInfo && !ungroupedInfo.visible) {
            ungroupedInfo.markers.forEach(({ marker }) => marker.map = this.map);
            ungroupedInfo.visible = true;
        }
    }

    zoomToGroup(groupData) {
        this.map.fitBounds(groupData.bounds, {
            padding: { top: 50, right: 50, bottom: 50, left: 50 }
        });
    }

    setContactClickHandler(handler) {
        this.onContactClick = handler;
    }

    async updateData(groups, contacts) {
        console.log('🔄 Updating data and re-initializing...');
        this.cleanup();
        this.groups = groups;
        this.contacts = contacts;
        this.wideGroups.clear(); // Clear wide groups tracking
        this.isInitialized = false;
        await this.initialize();
    }

    cleanup() {
        this.groupMarkers.forEach((groupInfo) => {
            groupInfo.marker.map = null;
        });

        this.individualMarkers.forEach((markerInfo) => {
            markerInfo.markers.forEach(({ marker }) => {
                marker.map = null;
            });
        });

        this.groupMarkers.clear();
        this.individualMarkers.clear();
        this.wideGroups.clear();
        console.log('🧹 Cleaned up old markers.');
    }

    getState() {
        return {
            currentZoom: this.currentZoom,
            groupMarkersVisible: Array.from(this.groupMarkers.values()).filter(g => g.visible).length,
            individualMarkersVisible: Array.from(this.individualMarkers.values())
                .reduce((total, markerInfo) => total + (markerInfo.visible ? markerInfo.markers.length : 0), 0),
            wideGroupsCount: this.wideGroups.size
        };
    }
}
