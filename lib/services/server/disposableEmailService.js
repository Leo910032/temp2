// lib/services/server/disposableEmailService.js

import { validateEmail as isValidEmail } from '@/lib/utilities';

// Cache for disposable domains to avoid repeated API calls
let disposableDomainsCache = new Set();
let lastCacheUpdate = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export class DisposableEmailService {
    /**
     * Fetches the latest list of disposable email domains
     * @param {boolean} strict - Whether to use strict mode (includes greylist domains)
     * @returns {Promise<Set<string>>} - Set of disposable domains
     */
    static async fetchDisposableDomains(strict = false) {
        try {
            const url = strict 
                ? 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains_strict.txt'
                : 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt';
            
            console.log(`Fetching disposable email domains from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const domains = text
                .split('\n')
                .map(domain => domain.trim().toLowerCase())
                .filter(domain => domain.length > 0);
            
            console.log(`Loaded ${domains.length} disposable email domains`);
            
            return new Set(domains);
            
        } catch (error) {
            console.error('Failed to fetch disposable email domains:', error);
            throw new Error(`Failed to update disposable email domains: ${error.message}`);
        }
    }

    /**
     * Updates the cached list of disposable domains if needed
     * @param {boolean} forceUpdate - Force update even if cache is still valid
     * @param {boolean} strict - Whether to use strict mode
     * @returns {Promise<void>}
     */
    static async updateCache(forceUpdate = false, strict = false) {
        const now = Date.now();
        
        // Check if cache is still valid
        if (!forceUpdate && disposableDomainsCache.size > 0 && (now - lastCacheUpdate) < CACHE_DURATION) {
            console.log('Disposable email domains cache is still valid, skipping update');
            return;
        }
        
        try {
            console.log('Updating disposable email domains cache...');
            disposableDomainsCache = await this.fetchDisposableDomains(strict);
            lastCacheUpdate = now;
            console.log(`Cache updated with ${disposableDomainsCache.size} domains`);
        } catch (error) {
            console.error('Failed to update disposable email domains cache:', error);
            
            // If cache is empty and update failed, load a minimal fallback list
            if (disposableDomainsCache.size === 0) {
                console.log('Loading fallback disposable email domains list...');
                disposableDomainsCache = this.getFallbackDomains();
                lastCacheUpdate = now;
            }
        }
    }

    /**
     * Provides a fallback list of common disposable email domains
     * @returns {Set<string>} - Set of fallback domains
     */
    static getFallbackDomains() {
        // Common disposable email domains as fallback
        const fallbackDomains = [
            '10minutemail.com', '10minutemail.net', 'guerrillamail.com', 'guerrillamail.net',
            'guerrillamail.org', 'guerrillaemail.com', 'mailinator.com', 'mailinator.net',
            'tempmail.org', 'temp-mail.org', 'throwaway.email', 'trashmail.com',
            'maildrop.cc', 'yopmail.com', 'sharklasers.com', 'getairmail.com',
            'emailondeck.com', 'mytrashmail.com', 'mohmal.com', 'anonymbox.com',
            'discardmail.com', 'spambox.us', 'tempinbox.com', '20minutemail.com',
            'notmailinator.com', 'fakeinbox.com', 'guerrillamail.biz', 'guerrillamail.de',
            'guerrillamailblock.com', 'pokemail.net', 'spamgourmet.com', 'tempail.com',
            'tempemail.net', 'throwawaymail.com', 'armyspy.com', 'cuvox.de',
            'dayrep.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com',
            'rhyta.com', 'superrito.com', 'teleworm.us', 'drdrb.net',
            'getnada.com', 'incognitomail.org', 'jetable.org', 'nwldx.com',
            'rcpt.at', 'recv.ml', 'sogetthis.com', 'sute.jp',
            'tmail.ws', 'tmails.net', 'thunkychase.com', 'upup.guru',
            '20email.tk', 'anonbox.net', 'drdrb.com', 'brefmail.com',
            'meltmail.com', 'mintemail.com', 'emailtemporario.com.br', 'correotemporal.org'
        ];
        
        console.log(`Using fallback list with ${fallbackDomains.length} disposable email domains`);
        return new Set(fallbackDomains);
    }

    /**
     * Checks if an email address uses a disposable email domain
     * @param {string} email - Email address to check
     * @param {object} options - Configuration options
     * @param {boolean} options.strict - Use strict mode (default: false)
     * @param {boolean} options.updateCache - Update cache if needed (default: true)
     * @returns {Promise<{isDisposable: boolean, domain: string, confidence: string}>}
     */
    static async isDisposableEmail(email, options = {}) {
        const { strict = false, updateCache = true } = options;
        
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email address is required');
        }
        
        // Validate email format first
        if (!isValidEmail(email)) {
            throw new Error('Invalid email format');
        }
        
        const cleanEmail = email.trim().toLowerCase();
        const domain = cleanEmail.split('@')[1];
        
        if (!domain) {
            throw new Error('Unable to extract domain from email address');
        }
        
        // Update cache if needed
        if (updateCache) {
            await this.updateCache(false, strict);
        }
        
        // Check if domain is in disposable list
        const isDisposable = disposableDomainsCache.has(domain);
        
        // Determine confidence level based on cache age
        const cacheAge = Date.now() - lastCacheUpdate;
        let confidence = 'high';
        
        if (cacheAge > CACHE_DURATION) {
            confidence = 'medium'; // Cache is stale
        } else if (disposableDomainsCache.size < 1000) {
            confidence = 'low'; // Using fallback list
        }
        
        console.log(`Email ${cleanEmail} check: domain=${domain}, disposable=${isDisposable}, confidence=${confidence}`);
        
        return {
            isDisposable,
            domain,
            confidence,
            cacheAge,
            cacheSize: disposableDomainsCache.size
        };
    }

    /**
     * Validates multiple email addresses against disposable domains
     * @param {string[]} emails - Array of email addresses
     * @param {object} options - Configuration options
     * @returns {Promise<object[]>} - Array of validation results
     */
    static async validateMultipleEmails(emails, options = {}) {
        if (!Array.isArray(emails)) {
            throw new Error('Emails must be provided as an array');
        }
        
        // Update cache once for all validations
        await this.updateCache(false, options.strict);
        
        const results = [];
        
        for (const email of emails) {
            try {
                const result = await this.isDisposableEmail(email, { 
                    ...options, 
                    updateCache: false // Skip individual cache updates
                });
                results.push({
                    email,
                    ...result,
                    valid: true
                });
            } catch (error) {
                results.push({
                    email,
                    valid: false,
                    error: error.message,
                    isDisposable: false
                });
            }
        }
        
        return results;
    }

    /**
     * Gets statistics about the disposable domains cache
     * @returns {object} - Cache statistics
     */
    static getCacheStats() {
        const now = Date.now();
        const ageInHours = (now - lastCacheUpdate) / (1000 * 60 * 60);
        
        return {
            size: disposableDomainsCache.size,
            lastUpdate: new Date(lastCacheUpdate).toISOString(),
            ageInHours: Math.round(ageInHours * 100) / 100,
            isStale: (now - lastCacheUpdate) > CACHE_DURATION,
            maxAge: CACHE_DURATION / (1000 * 60 * 60) // in hours
        };
    }

    /**
     * Forces a cache refresh
     * @param {boolean} strict - Whether to use strict mode
     * @returns {Promise<void>}
     */
    static async refreshCache(strict = false) {
        console.log('Forcing disposable email domains cache refresh...');
        await this.updateCache(true, strict);
    }

    /**
     * Clears the cache (useful for testing)
     * @returns {void}
     */
    static clearCache() {
        disposableDomainsCache.clear();
        lastCacheUpdate = 0;
        console.log('Disposable email domains cache cleared');
    }
}
