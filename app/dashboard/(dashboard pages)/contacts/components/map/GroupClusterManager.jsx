// Enhanced GroupClusterManager.jsx - With Directional Arrows for Off-Screen Markers
export default class GroupClusterManager {
    constructor(map, groups, contacts, options = {}) {
        console.log('🆕 GroupClusterManager v3.0 constructor called - Enhanced with directional arrows');
        this.map = map;
        this.groups = groups;
        this.contacts = contacts;
        this.options = {
            groupColors: [
                '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
            ],
            zoomThresholds: {
                groupClusters: 12,
                individualMarkers: 15
            },
            ...options
        };
        
        this.groupMarkers = new Map();
        this.individualMarkers = new Map();
        this.directionalArrows = new Map(); // NEW: Store directional arrows
        this.currentZoom = this.map.getZoom();
        this.isInitialized = false;
        this.offScreenCheckInterval = null; // NEW: Interval for checking off-screen markers
        this.arrowContainer = null; // NEW: Container for arrows
    }

    async initialize() {
        console.log('🚀 Initializing enhanced group cluster visualization v3.0');
        
        if (this.isInitialized) {
            console.log('⚠️ Already initialized, skipping...');
            return;
        }
        
        // Create arrow container
        this.createArrowContainer();
        
        // Set up zoom change listener
        this.map.addListener('zoom_changed', () => {
            const newZoom = this.map.getZoom();
            if (Math.abs(newZoom - this.currentZoom) > 0.5) {
                this.currentZoom = newZoom;
                this.updateMarkersForZoom();
            }
        });

        // Set up bounds change listener for arrow updates
        this.map.addListener('bounds_changed', () => {
            this.updateDirectionalArrows();
        });

        await this.processGroups();
        await this.processUngroupedContacts();
        this.updateMarkersForZoom();
        
        // Start checking for off-screen markers
        this.startOffScreenCheck();
        
        this.isInitialized = true;
        console.log('✅ Enhanced group cluster visualization initialized');
    }

    createArrowContainer() {
        // Create a container for directional arrows
        this.arrowContainer = document.createElement('div');
        this.arrowContainer.id = 'directional-arrows-container';
        this.arrowContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
        `;
        
        // Add to map container
        const mapContainer = this.map.getDiv();
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(this.arrowContainer);
    }

    startOffScreenCheck() {
        // Check for off-screen markers every 500ms
        this.offScreenCheckInterval = setInterval(() => {
            this.updateDirectionalArrows();
        }, 500);
    }

    updateDirectionalArrows() {
        if (!this.isInitialized) return;
        
        // Clear existing arrows
        this.clearDirectionalArrows();
        
        const bounds = this.map.getBounds();
        if (!bounds) return;
        
        const mapDiv = this.map.getDiv();
        const mapRect = mapDiv.getBoundingClientRect();
        
        // Check all visible individual markers
        this.individualMarkers.forEach((markerInfo, groupId) => {
            if (!markerInfo.visible) return;
            
            markerInfo.markers.forEach(({ marker, contact }) => {
                const position = marker.position;
                if (!bounds.contains(position)) {
                    // Marker is off-screen, create directional arrow
                    this.createDirectionalArrow(contact, position, bounds, mapRect, groupId);
                }
            });
        });
    }

    createDirectionalArrow(contact, markerPosition, bounds, mapRect, groupId) {
        const mapCenter = bounds.getCenter();
        const mapCenterLat = mapCenter.lat();
        const mapCenterLng = mapCenter.lng();
        
        const markerLat = markerPosition.lat;
        const markerLng = markerPosition.lng;
        
        // Calculate direction from map center to marker
        const deltaLat = markerLat - mapCenterLat;
        const deltaLng = markerLng - mapCenterLng;
        
        // Calculate angle (in degrees)
        const angle = Math.atan2(deltaLat, deltaLng) * (180 / Math.PI);
        
        // Calculate arrow position on map edge
        const mapCenterX = mapRect.width / 2;
        const mapCenterY = mapRect.height / 2;
        
        // Distance from center to edge (considering margin)
        const margin = 60;
        const maxDistanceX = mapCenterX - margin;
        const maxDistanceY = mapCenterY - margin;
        
        // Calculate position on edge
        const radians = angle * (Math.PI / 180);
        let arrowX, arrowY;
        
        // Determine which edge the arrow should be on
        const absAngle = Math.abs(angle);
        if (absAngle < 45 || absAngle > 135) {
            // Right or left edge
            if (deltaLng > 0) {
                // Right edge
                arrowX = mapCenterX + maxDistanceX;
                arrowY = mapCenterY + Math.tan(radians) * maxDistanceX;
            } else {
                // Left edge
                arrowX = mapCenterX - maxDistanceX;
                arrowY = mapCenterY - Math.tan(radians) * maxDistanceX;
            }
        } else {
            // Top or bottom edge
            if (deltaLat > 0) {
                // Top edge (note: screen coordinates are inverted)
                arrowY = mapCenterY - maxDistanceY;
                arrowX = mapCenterX + (maxDistanceY / Math.tan(radians));
            } else {
                // Bottom edge
                arrowY = mapCenterY + maxDistanceY;
                arrowX = mapCenterX - (maxDistanceY / Math.tan(radians));
            }
        }
        
        // Clamp to map bounds
        arrowX = Math.max(margin, Math.min(mapRect.width - margin, arrowX));
        arrowY = Math.max(margin, Math.min(mapRect.height - margin, arrowY));
        
        // Create arrow element
        const arrow = this.createArrowElement(contact, angle, groupId);
        
        // Position the arrow
        arrow.style.left = `${arrowX}px`;
        arrow.style.top = `${arrowY}px`;
        
        // Add click handler to pan to marker
        arrow.addEventListener('click', () => {
            this.panToMarker(markerPosition, contact);
        });
        
        this.arrowContainer.appendChild(arrow);
        
        // Store reference for cleanup
        const arrowId = `${groupId}-${contact.id}`;
        this.directionalArrows.set(arrowId, arrow);
    }

    createArrowElement(contact, angle, groupId) {
        const container = document.createElement('div');
        container.className = 'directional-arrow-container';
        container.style.cssText = `
            position: absolute;
            width: 50px;
            height: 50px;
            pointer-events: auto;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
            z-index: 1001;
        `;

        // Create the arrow circle background
        const circle = document.createElement('div');
        circle.style.cssText = `
            width: 40px;
            height: 40px;
            background: white;
            border: 3px solid ${this.getGroupColor(groupId)};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
            transition: all 0.2s ease;
        `;

        // Create the arrow icon
        const arrowIcon = document.createElement('div');
        arrowIcon.innerHTML = '➤';
        arrowIcon.style.cssText = `
            color: ${this.getGroupColor(groupId)};
            font-size: 16px;
            font-weight: bold;
            transform: rotate(${angle + 90}deg);
            transition: transform 0.2s ease;
        `;

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            margin-bottom: 8px;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            z-index: 1002;
        `;
        tooltip.textContent = `${contact.name} →`;

        // Add tooltip arrow
        const tooltipArrow = document.createElement('div');
        tooltipArrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 4px solid transparent;
            border-top-color: rgba(0,0,0,0.8);
        `;
        tooltip.appendChild(tooltipArrow);

        // Hover effects
        container.addEventListener('mouseenter', () => {
            circle.style.transform = 'scale(1.2)';
            circle.style.background = this.getGroupColor(groupId);
            arrowIcon.style.color = 'white';
            tooltip.style.opacity = '1';
        });

        container.addEventListener('mouseleave', () => {
            circle.style.transform = 'scale(1)';
            circle.style.background = 'white';
            arrowIcon.style.color = this.getGroupColor(groupId);
            tooltip.style.opacity = '0';
        });

        circle.appendChild(arrowIcon);
        container.appendChild(circle);
        container.appendChild(tooltip);

        // Add pulsing animation CSS if not already added
        if (!document.getElementById('arrow-animations')) {
            const style = document.createElement('style');
            style.id = 'arrow-animations';
            style.textContent = `
                @keyframes pulse {
                    0% { box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 0 0 rgba(59, 130, 246, 0.7); }
                    70% { box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 0 10px rgba(59, 130, 246, 0); }
                    100% { box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 0 0 rgba(59, 130, 246, 0); }
                }
                .directional-arrow-container:hover .arrow-circle {
                    animation-play-state: paused;
                }
            `;
            document.head.appendChild(style);
        }

        return container;
    }

    getGroupColor(groupId) {
        if (groupId === 'ungrouped') return '#6B7280';
        const groupIndex = this.groups.findIndex(g => g.id === groupId);
        return this.options.groupColors[groupIndex % this.options.groupColors.length] || '#6B7280';
    }

    panToMarker(markerPosition, contact) {
        console.log(`🎯 Panning to marker for: ${contact.name}`);
        
        // Pan to the marker position
        this.map.panTo(markerPosition);
        
        // Optionally zoom in a bit if we're too far out
        const currentZoom = this.map.getZoom();
        if (currentZoom < 14) {
            setTimeout(() => {
                this.map.setZoom(Math.min(16, currentZoom + 2));
            }, 300);
        }
        
        // Highlight the marker briefly
        this.highlightMarker(contact);
        
        // Show notification
        this.showNavigationNotification(contact);
    }

    highlightMarker(contact) {
        // Find the marker for this contact
        this.individualMarkers.forEach((markerInfo) => {
            if (!markerInfo.visible) return;
            
            const foundMarker = markerInfo.markers.find(({ contact: c }) => c.id === contact.id);
            if (foundMarker) {
                const element = foundMarker.element;
                const circle = element.querySelector('div');
                
                if (circle) {
                    // Add highlight animation
                    const originalTransform = circle.style.transform;
                    const originalBoxShadow = circle.style.boxShadow;
                    
                    // Animate highlight
                    circle.style.transition = 'all 0.3s ease';
                    circle.style.transform = 'scale(1.5)';
                    circle.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.8)';
                    
                    setTimeout(() => {
                        circle.style.transform = originalTransform;
                        circle.style.boxShadow = originalBoxShadow;
                    }, 1000);
                }
            }
        });
    }

    showNavigationNotification(contact) {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = `Navigated to ${contact.name}`;
        
        // Add slide animation
        if (!document.getElementById('notification-animations')) {
            const style = document.createElement('style');
            style.id = 'notification-animations';
            style.textContent = `
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    clearDirectionalArrows() {
        // Remove all existing arrows
        this.directionalArrows.forEach((arrow) => {
            if (arrow.parentNode) {
                arrow.parentNode.removeChild(arrow);
            }
        });
        this.directionalArrows.clear();
    }

    showOffScreenGuide() {
        const offScreenCount = this.directionalArrows.size;
        if (offScreenCount === 0) return;
        
        // Show guide message
        const guide = document.createElement('div');
        guide.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: fadeInUp 0.5s ease;
            max-width: 300px;
            text-align: center;
        `;
        
        guide.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
                <span style="font-size: 16px;">📍</span>
                <span>${offScreenCount} contact${offScreenCount > 1 ? 's' : ''} nearby</span>
            </div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">
                Click the pulsing arrows to navigate
            </div>
        `;
        
        document.body.appendChild(guide);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (guide.parentNode) {
                guide.style.animation = 'fadeInUp 0.5s ease reverse';
                setTimeout(() => {
                    if (guide.parentNode) {
                        guide.parentNode.removeChild(guide);
                    }
                }, 500);
            }
        }, 5000);
    }

    // Override the existing updateMarkersForZoom to trigger arrow updates
    updateMarkersForZoom() {
        const zoom = this.currentZoom;
        const showGroupClusters = zoom < this.options.zoomThresholds.groupClusters;
        const showIndividualMarkers = zoom >= this.options.zoomThresholds.individualMarkers;
        const showMixed = zoom >= this.options.zoomThresholds.groupClusters && zoom < this.options.zoomThresholds.individualMarkers;

        if (showGroupClusters) {
            this.showGroupClusters();
            this.hideIndividualMarkers();
            this.clearDirectionalArrows(); // Clear arrows when showing clusters
        } else if (showIndividualMarkers) {
            this.hideGroupClusters();
            this.showIndividualMarkers();
            // Arrows will be updated by bounds_changed listener
        } else if (showMixed) {
            this.showMixedView();
            // Arrows will be updated by bounds_changed listener
        }
        
        // Show guide if there are off-screen markers
        setTimeout(() => {
            if (this.directionalArrows.size > 0) {
                this.showOffScreenGuide();
            }
        }, 1000);
    }

    // Add the rest of your existing methods here...
    async processGroups() {
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker');
        
        for (const [index, group] of this.groups.entries()) {
            const groupContacts = this.contacts.filter(contact => 
                group.contactIds.includes(contact.id)
            );
            
            const contactsWithLocation = groupContacts.filter(contact =>
                contact.location?.latitude && contact.location?.longitude
            );

            if (contactsWithLocation.length === 0) continue;

            const groupData = this.calculateGroupClusterData(group, contactsWithLocation, index);
            
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

    calculateGroupClusterData(group, contactsWithLocation, colorIndex) {
        const center = this.calculateCenter(contactsWithLocation);
        const radius = this.calculateRadius(contactsWithLocation, center);
        const color = this.options.groupColors[colorIndex % this.options.groupColors.length];
        
        return {
            group: group,
            contacts: contactsWithLocation,
            center: center,
            radius: radius,
            color: color,
            memberCount: contactsWithLocation.length,
            bounds: this.calculateBounds(contactsWithLocation)
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
        
        const clusterElement = this.createClusterElement(groupData);
        
        const marker = new AdvancedMarkerElement({
            map: null,
            position: groupData.center,
            content: clusterElement,
            title: `${groupData.group.name} (${groupData.memberCount} members)`,
        });

        clusterElement.addEventListener('click', () => {
            this.zoomToGroup(groupData);
        });

        return marker;
    }

    createClusterElement(groupData) {
        const container = document.createElement('div');
        container.className = 'group-cluster-container';
        container.style.cssText = `
            position: relative;
            cursor: pointer;
            transform: translateX(-50%) translateY(-50%);
        `;

        const circle = document.createElement('div');
        circle.className = 'group-cluster-circle';
        circle.style.cssText = `
            width: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
            height: ${Math.max(40, Math.min(80, groupData.memberCount * 8))}px;
            background: ${groupData.color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;

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

        popup.innerHTML = `${groupData.group.name}<br><small>${groupData.memberCount} members</small>` + popup.innerHTML;

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
                console.log('📍 Marker clicked directly:', contact.name);
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

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('📍 Marker clicked directly:', contact.name);
            if (this.onContactClick) {
                this.onContactClick(contact);
            }
        });

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
                console.log('📍 Ungrouped marker clicked directly:', contact.name);
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

        container.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('📍 Ungrouped marker clicked directly:', contact.name);
            if (this.onContactClick) {
                this.onContactClick(contact);
            }
        });

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

    showGroupClusters() {
        this.groupMarkers.forEach((groupInfo, groupId) => {
            if (!groupInfo.visible) {
                groupInfo.marker.map = this.map;
                groupInfo.visible = true;
            }
        });
        this.hideIndividualMarkers();
    }

    hideGroupClusters() {
        this.groupMarkers.forEach((groupInfo, groupId) => {
            if (groupInfo.visible) {
                groupInfo.marker.map = null;
                groupInfo.visible = false;
            }
        });
    }

    showIndividualMarkers() {
        this.individualMarkers.forEach((markerInfo, groupId) => {
            if (!markerInfo.visible) {
                markerInfo.markers.forEach(({ marker }) => {
                    marker.map = this.map;
                });
                markerInfo.visible = true;
            }
        });
    }

    hideIndividualMarkers() {
        this.individualMarkers.forEach((markerInfo, groupId) => {
            if (markerInfo.visible) {
                markerInfo.markers.forEach(({ marker }) => {
                    marker.map = null;
                });
                markerInfo.visible = false;
            }
        });
    }

    showMixedView() {
        this.groupMarkers.forEach((groupInfo, groupId) => {
            const shouldShowCluster = groupInfo.data.memberCount >= 3;
            
            if (shouldShowCluster && !groupInfo.visible) {
                groupInfo.marker.map = this.map;
                groupInfo.visible = true;
                
                const individualInfo = this.individualMarkers.get(groupId);
                if (individualInfo?.visible) {
                    individualInfo.markers.forEach(({ marker }) => {
                        marker.map = null;
                    });
                    individualInfo.visible = false;
                }
            } else if (!shouldShowCluster && groupInfo.visible) {
                groupInfo.marker.map = null;
                groupInfo.visible = false;
                
                const individualInfo = this.individualMarkers.get(groupId);
                if (individualInfo && !individualInfo.visible) {
                    individualInfo.markers.forEach(({ marker }) => {
                        marker.map = this.map;
                    });
                    individualInfo.visible = true;
                }
            }
        });

        const ungroupedInfo = this.individualMarkers.get('ungrouped');
        if (ungroupedInfo && !ungroupedInfo.visible) {
            ungroupedInfo.markers.forEach(({ marker }) => {
                marker.map = this.map;
            });
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
        this.cleanup();
        this.groups = groups;
        this.contacts = contacts;
        this.isInitialized = false;
        await this.initialize();
        
        // Re-set the contact click handler after updating data
        console.log('🔧 Re-setting contact click handler after data update');
        this.individualMarkers.forEach((markerInfo) => {
            markerInfo.markers.forEach(({ element, contact }) => {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();
                    console.log('📍 Contact clicked after update:', contact.name);
                    if (this.onContactClick) {
                        this.onContactClick(contact);
                    }
                });
            });
        });
    }

    cleanup() {
        // Stop the off-screen check interval
        if (this.offScreenCheckInterval) {
            clearInterval(this.offScreenCheckInterval);
            this.offScreenCheckInterval = null;
        }
        
        // Clear directional arrows
        this.clearDirectionalArrows();
        
        // Remove arrow container
        if (this.arrowContainer && this.arrowContainer.parentNode) {
            this.arrowContainer.parentNode.removeChild(this.arrowContainer);
            this.arrowContainer = null;
        }
        
        // Clear existing markers
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
    }

    getState() {
        return {
            currentZoom: this.currentZoom,
            groupMarkersVisible: Array.from(this.groupMarkers.values()).filter(g => g.visible).length,
            individualMarkersVisible: Array.from(this.individualMarkers.values())
                .reduce((total, markerInfo) => total + (markerInfo.visible ? markerInfo.markers.length : 0), 0),
            directionalArrowsVisible: this.directionalArrows.size
        };
    }
}