// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// lib/config/publicEmailDomains.js

/**
 * A comprehensive list of public email domains to be excluded from company-based grouping.
 * This list helps differentiate between personal/public email providers and corporate domains.
 * The list is organized by provider and region for easier maintenance.
 */
export const PUBLIC_EMAIL_DOMAINS = new Set([
  // --- Major International Providers ---

  // Google
  'gmail.com',
  'googlemail.com',

  // Microsoft
  'hotmail.com',
  'live.com',
  'msn.com',
  'outlook.com',
  'windowslive.com',

  // Yahoo
  'yahoo.ca',
  'yahoo.co.in',
  'yahoo.co.jp',
  'yahoo.co.uk',
  'yahoo.com',
  'yahoo.com.au',
  'yahoo.de',
  'yahoo.es',
  'yahoo.fr',
  'yahoo.in',
  'yahoo.it',
  'ymail.com',

  // Apple
  'icloud.com',
  'mac.com',
  'me.com',

  // AOL / Verizon
  'aol.com',
  'verizon.net',

  // --- Major US ISPs (often used as personal email) ---
  'att.net',
  'comcast.net',
  'sbcglobal.net',
  'earthlink.net',
  'cox.net',

  // --- Major UK ISPs ---
  'btinternet.com',
  'sky.com',
  'talktalk.net',
  'virginmedia.com',

  // --- Privacy-Focused Providers ---
  'fastmail.com',
  'hey.com',
  'hushmail.com',
  'mailbox.org',
  'pm.me',
  'proton.me',
  'protonmail.com',
  'tutanota.com',
  'zoho.com', // Also used for business, but the public domain is common

  // --- Russian & Eastern European Providers ---
  'bk.ru',
  'inbox.ru',
  'list.ru',
  'mail.ru',
  'rambler.ru',
  'yandex.com',
  'yandex.ru',
  
  // --- Chinese Providers ---
  '126.com',
  '163.com',
  'qq.com',
  'sina.com',
  'sohu.com',
  'yeah.net',

  // --- German Providers ---
  'gmx.de',
  'gmx.net',
  't-online.de',
  'web.de',

  // --- French Providers ---
  'free.fr',
  'laposte.net',
  'orange.fr',
  'sfr.fr',
  'wanadoo.fr',

  // --- Other European Providers ---
  'libero.it',
  'seznam.cz',
  'virgilio.it',
  'wp.pl', // Poland

  // --- Other International Providers ---
  'daum.net',     // Korea
  'hanmail.net',  // Korea
  'mail.com',     // Global
  'naver.com',    // Korea
  'rediffmail.com', // India
  
  // --- Common Disposable/Temporary Email Services ---
  '10minutemail.com',
  'getnada.com',
  'guerrillamail.com',
  'mail.tm',
  'mailinator.com',
  'temp-mail.org',
  'tempail.com',
  'throwawaymail.com',
]);

/**
 * Checks if an email domain is a public/personal email provider.
 * This function uses the comprehensive list and also checks for broad categories like .edu and .gov.
 * @param {string} domain - The email domain to check.
 * @returns {boolean} - True if it's a public domain, false if it's likely a company domain.
 */
export function isPublicEmailDomain(domain) {
  if (!domain) return true;
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  // 1. Direct match in our Set (very fast).
  if (PUBLIC_EMAIL_DOMAINS.has(normalizedDomain)) {
    return true;
  }
  
  // 2. Pattern matching for broad categories not suitable for the Set.
  // Note: These are kept in the function instead of the Set to catch all variants.
  
  // Check for educational domains (e.g., stanford.edu, cam.ac.uk)
  if (normalizedDomain.endsWith('.edu') || normalizedDomain.includes('.ac.')) {
    return true;
  }
  
  // Check for government domains (e.g., nasa.gov, gov.uk)
  if (normalizedDomain.endsWith('.gov') || normalizedDomain.includes('.gov.') || normalizedDomain.includes('.gouv.')) {
    return true;
  }
  
  return false;
}


/**
 * Extracts the domain from an email address.
 * @param {string} email - The email address.
 * @returns {string|null} - The domain part or null if invalid.
 */
export function extractEmailDomain(email) {
  if (!email || typeof email !== 'string') return null;
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) return null;
  return email.substring(atIndex + 1).toLowerCase().trim();
}

/**
 * Gets a company identifier from an email domain.
 * Removes common prefixes like 'mail.', 'email.', etc.
 * @param {string} domain - The email domain.
 * @returns {string} - Cleaned company identifier.
 */
export function getCompanyIdentifierFromDomain(domain) {
  if (!domain) return '';
  
  let cleanDomain = domain.toLowerCase().trim();
  const prefixesToRemove = ['mail.', 'email.', 'smtp.', 'webmail.', 'mx.'];
  for (const prefix of prefixesToRemove) {
    if (cleanDomain.startsWith(prefix)) {
      cleanDomain = cleanDomain.substring(prefix.length);
      break;
    }
  }
  
  return cleanDomain;
}

/**
 * Adds a new public domain to the list for the current session (for dynamic updates).
 * @param {string} domain - Domain to add to the public list.
 */
export function addPublicDomain(domain) {
  if (domain && typeof domain === 'string') {
    PUBLIC_EMAIL_DOMAINS.add(domain.toLowerCase().trim());
  }
}

/**
 * Analyzes if a domain looks like a company domain based on patterns.
 * @param {string} domain - The domain to analyze.
 * @returns {object} - Analysis result with confidence score.
 */
export function analyzeEmailDomain(domain) {
  if (!domain) return { isCompanyDomain: false, confidence: 0, reason: 'No domain' };
  
  const normalizedDomain = domain.toLowerCase().trim();
  
  if (isPublicEmailDomain(normalizedDomain)) {
    return { isCompanyDomain: false, confidence: 0.95, reason: 'Known public email provider' };
  }
  
  let companyScore = 0;
  const reasons = [];
  
  if (normalizedDomain.match(/\.(com|co\.|org|net|io|ai|tech|app)$/)) {
    companyScore += 0.3;
    reasons.push('Business TLD');
  }
  
  if (!/\d/.test(normalizedDomain)) {
    companyScore += 0.2;
    reasons.push('No numbers in domain');
  }
  
  if (normalizedDomain.split('.')[0].length <= 10) {
    companyScore += 0.2;
    reasons.push('Short domain name');
  }
  
  const companyWords = ['corp', 'inc', 'ltd', 'llc', 'tech', 'group', 'systems', 'solutions', 'labs'];
  if (companyWords.some(word => normalizedDomain.includes(word))) {
    companyScore += 0.3;
    reasons.push('Contains business keywords');
  }
  
  return {
    isCompanyDomain: companyScore > 0.5,
    confidence: Math.min(companyScore, 0.95),
    reason: reasons.join(', ') || 'General pattern match'
  };
}