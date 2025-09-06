// components/ContactsMap/utils.js - Utility functions

/**
 * Get unique companies from contacts array
 * @param {Array} contacts - Array of contact objects
 * @returns {Array} Sorted array of unique company names
 */
export function getUniqueCompanies(contacts) {
    return [...new Set(contacts.map(c => c.company).filter(Boolean))].sort();
}

/**
 * Get color for a group based on its position in the groups array
 * @param {string} groupId - The ID of the group
 * @param {Array} groups - Array of all groups
 * @returns {string} Hex color code
 */
export function getGroupColor(groupId, groups) {
    const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}

/**
 * Calculate distance between two geographic points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
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

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
    return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

/**
 * Format contact status with proper styling
 * @param {string} status - Contact status
 * @returns {object} Object with CSS classes
 */
export function getStatusColor(status) {
    switch (status) {
        case 'new': return { bg: 'bg-blue-100', text: 'text-blue-800' };
        case 'viewed': return { bg: 'bg-green-100', text: 'text-green-800' };
        case 'archived': return { bg: 'bg-gray-100', text: 'text-gray-800' };
        default: return { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
}

/**
 * Check if a contact has valid location data
 * @param {object} contact - Contact object
 * @returns {boolean} True if contact has valid latitude and longitude
 */
export function hasValidLocation(contact) {
    return contact.location &&
           contact.location.latitude &&
           contact.location.longitude &&
           !isNaN(contact.location.latitude) &&
           !isNaN(contact.location.longitude);
}

/**
 * Generate a unique ID for groups
 * @returns {string} Unique identifier
 */
export function generateGroupId() {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function for search and filter operations
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}