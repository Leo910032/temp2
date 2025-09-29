// lib/services/serviceLinks/server/linksService.js

 
import { adminDb } from '@/lib/firebaseAdmin';
import sanitizeHtml from 'sanitize-html';

// ✅ Enhanced validation function - works with the user document structure
function validateAndSanitizeLinksArray(links) {
    if (!Array.isArray(links)) {
        throw new Error("Links must be an array.");
    }
    if (links.length > 50) {
        throw new Error("Cannot have more than 50 links.");
    }

    const seenIds = new Set();
    // More permissive URL regex that allows various TLDs and domains
    const urlRegex = /^https?:\/\/([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/i;

    for (const link of links) {
        // ✅ Structural Validation - matches your ManageLinks component structure
        if (typeof link !== 'object' || link === null) {
            throw new Error("Invalid link item found.");
        }
        
        // ✅ Required fields validation
        if (typeof link.id !== 'string' || !link.id.trim()) {
            throw new Error("Each link must have a valid id string.");
        }
        if (typeof link.title !== 'string') {
            throw new Error(`Invalid title for link ID: ${link.id}. Must be a string.`);
        }
        if (typeof link.isActive !== 'boolean') {
            throw new Error(`Invalid isActive for link ID: ${link.id}. Must be a boolean.`);
        }
        if (typeof link.type !== 'number') {
            throw new Error(`Invalid type for link ID: ${link.id}. Must be a number.`);
        }

        // ✅ Uniqueness validation
        if (seenIds.has(link.id)) {
            throw new Error(`Duplicate link ID found: ${link.id}`);
        }
        seenIds.add(link.id);

        // ✅ Type-specific validation
        if (link.type === 1) { // Standard link with URL
            // ✅ Auto-deactivate links that are active but missing valid URLs
            if (link.isActive && (!link.url || typeof link.url !== 'string' || link.url.trim() === '')) {
                console.warn(`Auto-deactivating link "${link.title}" (ID: ${link.id}) because it's active but has no URL`);
                link.isActive = false;
            }
            
            // ✅ Validate URL format if URL is provided (for both active and inactive links)
            if (link.url && typeof link.url === 'string' && link.url.trim() !== '') {
                // ✅ Auto-fix URLs that don't start with http/https
                let urlToValidate = link.url.trim();
                if (!urlToValidate.startsWith('http://') && !urlToValidate.startsWith('https://')) {
                    urlToValidate = 'https://' + urlToValidate;
                    link.url = urlToValidate; // Update the link with the fixed URL
                    console.log(`Auto-fixed URL for link "${link.title}": ${link.url}`);
                }
                
                if (urlToValidate.length > 2048) {
                    throw new Error(`URL exceeds maximum length of 2048 characters for link: "${link.title}"`);
                }
                if (!urlRegex.test(urlToValidate)) {
                    // ✅ If still invalid after auto-fix and link is active, deactivate it
                    if (link.isActive) {
                        console.warn(`Auto-deactivating link "${link.title}" (ID: ${link.id}) because URL "${urlToValidate}" is invalid`);
                        link.isActive = false;
                    } else {
                        // ✅ For inactive links, just warn but don't throw error
                        console.warn(`Invalid URL format for inactive link "${link.title}": "${urlToValidate}"`);
                    }
                } else {
                    // ✅ Security check for javascript: URLs
                    if (urlToValidate.toLowerCase().startsWith('javascript:')) {
                        if (link.isActive) {
                            console.warn(`Auto-deactivating link "${link.title}" (ID: ${link.id}) because JavaScript URLs are not allowed`);
                            link.isActive = false;
                        } else {
                            console.warn(`JavaScript URL detected in inactive link "${link.title}" - will be blocked if activated`);
                        }
                    }
                }
            }
            
            // ✅ Validate urlKind if provided (optional field from your component)
            if (link.urlKind !== undefined && typeof link.urlKind !== 'string') {
                throw new Error(`Invalid urlKind for link ID: ${link.id}. Must be a string if provided.`);
            }
        } else if (link.type === 0) { // Header type - no URL required
            // Headers don't need URLs, just validate they don't have them
            if (link.url !== undefined && link.url !== '') {
                console.warn(`Header link "${link.title}" has URL but shouldn't. Removing URL.`);
                delete link.url;
                delete link.urlKind;
            }
        }
        
        // ✅ Title validation and sanitization
        if (link.title.length > 100) {
            throw new Error(`Link title exceeds maximum length of 100 characters for ID: ${link.id}`);
        }
        
        // ✅ Sanitize title to prevent XSS
        link.title = sanitizeHtml(link.title.trim(), {
            allowedTags: [], // Allow no HTML tags
            allowedAttributes: {} // Allow no attributes
        });
        
        // ✅ Sanitize URL if present
        if (link.url) {
            link.url = link.url.trim();
        }
        
        // ✅ Sanitize urlKind if present
        if (link.urlKind) {
            link.urlKind = sanitizeHtml(link.urlKind.trim(), {
                allowedTags: [],
                allowedAttributes: {}
            });
        }
    }
    
    return links; // Return the validated and sanitized array
}

export class LinksService {
    /**
     * Fetches the links array from the user document.
     * Uses the session userData which contains the complete user document.
     * @param {object} options
     * @param {object} options.session - The authenticated user session from createApiSession.
     * @returns {Promise<Array>} The user's links array from their document.
     */
    static async getUserLinks({ session }) {
        try {
            // ✅ Extract links from the user document structure
            // The session.userData should contain the full user document
            const links = session.userData?.links || [];
            
            // ✅ Ensure it's always an array (defensive programming)
            const validLinks = Array.isArray(links) ? links : [];
            
            console.log(`✅ LinksService: Fetched ${validLinks.length} links for user ${session.userId}`);
            return validLinks;
        } catch (error) {
            console.error(`❌ LinksService: Error fetching links for user ${session.userId}:`, error);
            throw new Error("Failed to retrieve user links.");
        }
    }
    /**
     * Updates the links array in the user document.
     * This directly modifies the `links` field in the user document structure.
     * @param {object} options
     * @param {Array} options.linksData - The new array of links.
     * @param {object} options.session - The authenticated user session.
     * @returns {Promise<{success: boolean, count: number, links: Array}>}
     */
     static async updateUserLinks({ linksData, session }) {
        try {
            // ✅ 1. Validate and sanitize the incoming links
            const validatedLinks = validateAndSanitizeLinksArray(linksData);

            // ✅ 2. Update the user document in Firestore
            // This targets the exact user document structure you specified
            const userDocRef = adminDb.collection('users').doc(session.userId);
            
            await userDocRef.update({ 
                links: validatedLinks // This directly updates the links array in the user document
            });

            console.log(`✅ LinksService: Updated ${validatedLinks.length} links for user ${session.userId}`);
            
            return { 
                success: true, 
                count: validatedLinks.length,
                links: validatedLinks // Return the updated links for immediate use
            };
        } catch (error) {
            console.error(`❌ LinksService: Error updating links for user ${session.userId}:`, error);
            
            // ✅ Provide more specific error messages
            if (error.message.includes('permission') || error.message.includes('denied')) {
                throw new Error("Permission denied. Unable to update links.");
            } else if (error.message.includes('not found')) {
                throw new Error("User document not found. Unable to update links.");
            } else {
                throw error; // Re-throw validation errors as-is
            }
        }
    }


    
  
    /**
     * Helper method to get the current links count for a user
     * Useful for dashboard statistics or limits checking
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @returns {Promise<number>}
     */
     static async getLinksCount({ session }) {
        try {
            const links = await this.getUserLinks({ session });
            return links.length;
        } catch (error) {
            console.error(`❌ LinksService: Error getting links count for user ${session.userId}:`, error);
            throw new Error("Failed to get links count.");
        }
    }

    /**
     * Helper method to validate links structure without saving
     * Useful for client-side validation before API calls
     * @param {Array} linksData - The links array to validate
     * @returns {boolean} - Returns true if valid, throws error if invalid
     */
    static validateLinks(linksData) {
        return validateAndSanitizeLinksArray(linksData);
    }
}