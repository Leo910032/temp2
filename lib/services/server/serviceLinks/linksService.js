/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// lib/services/server/serviceLinks/linksService.js

import { adminDb } from '@/lib/firebaseAdmin';

// Enhanced validation function - moved from API route to service
function validateAndSanitizeLinksArray(links) {
    if (!Array.isArray(links)) {
        throw new Error("Input must be an array.");
    }
    if (links.length > 50) {
        throw new Error("Cannot have more than 50 links.");
    }

    const seenIds = new Set();
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i; // Stricter URL regex

    for (const link of links) {
        // --- Structural Validation ---
        if (typeof link !== 'object' || link === null) throw new Error("Invalid link item found.");
        if (typeof link.id !== 'string' || typeof link.title !== 'string' || typeof link.isActive !== 'boolean' || typeof link.type !== 'number') {
            throw new Error(`Invalid link object structure for ID: ${link.id}`);
        }

        // --- Uniqueness and Content Validation ---
        if (seenIds.has(link.id)) throw new Error(`Duplicate link ID found: ${link.id}`);
        seenIds.add(link.id);

        if (link.type === 1) { // Type 1 is a standard link with a URL
            if (!link.url || typeof link.url !== 'string') throw new Error("URL is required for standard links.");
            if (link.url.length > 2048) throw new Error("URL exceeds maximum length of 2048 characters.");
            if (!urlRegex.test(link.url)) throw new Error(`Invalid URL format for link titled: "${link.title}"`);
        }
        
        // --- Sanitization ---
        if (link.title.length > 100) throw new Error("Link title exceeds maximum length of 100 characters.");
        // Basic sanitization: remove script tags to prevent stored XSS
     // ✅ REPLACE the regex with a robust sanitizer
        link.title = sanitizeHtml(link.title, {
            allowedTags: [], // Allow no HTML tags in the title
            allowedAttributes: {} // Allow no attributes
        });

        if (link.type === 1) {
            // You should also sanitize the URL to prevent things like `javascript:alert(1)`
            if (link.url.toLowerCase().startsWith('javascript:')) {
                throw new Error(`Invalid URL format for link titled: "${link.title}"`);
            }
        }       }
    
    return links; // Return the validated and sanitized array
}

export class LinksService {
    /**
     * Fetches the links for a given user.
     * It relies on the session to provide the user's data.
     * @param {object} options
     * @param {object} options.session - The authenticated user session from createApiSession.
     * @returns {Promise<Array>} The user's links.
     */
    static async getUserLinks({ session }) {
        // No DB call needed here! We use the data fetched by createApiSession.
        const links = session.userData.links || [];
        console.log(`✅ LinksService: Fetched ${links.length} links for user ${session.userId}`);
        return links;
    }

    /**
     * Updates the links for a given user.
     * @param {object} options
     * @param {Array} options.linksData - The new array of links.
     * @param {object} options.session - The authenticated user session.
     * @returns {Promise<{success: boolean, count: number}>}
     */
    static async updateUserLinks({ linksData, session }) {
        // 1. The service is responsible for validation.
        const validatedLinks = validateAndSanitizeLinksArray(linksData);

        // 2. The service performs the database operation.
        const userDocRef = adminDb.collection('AccountData').doc(session.userId);
        await userDocRef.update({ links: validatedLinks });

        console.log(`✅ LinksService: Updated links for user ${session.userId}`);
        return { success: true, count: validatedLinks.length };
    }
}