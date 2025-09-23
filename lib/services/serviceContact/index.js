//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// lib/services/serviceContact/index.js - UPDATED with enhanced integration
"use client"

// Enhanced service factory imports
import { ContactServiceFactory } from './client/factories/ContactServiceFactory';
import { EnhancedExchangeService } from './client/services/EnhancedExchangeService';

// ==================== ENHANCED SERVICE INSTANCES ====================
const contactService = () => ContactServiceFactory.getContactService();
const contactGroupService = () => ContactServiceFactory.getContactGroupService();
const contactSubscriptionService = () => ContactServiceFactory.getContactSubscriptionService();

// Enhanced exchange service that includes integrated business card scanning
const enhancedExchangeService = () => new EnhancedExchangeService();

const businessCardService = () => ContactServiceFactory.getBusinessCardService();
import { SemanticSearchService } from './client/services/SemanticSearchService';

// ==================== ENHANCED EXCHANGE FUNCTIONS ====================
// These now use the unified enhanced service

/**
 * Verify if a profile exists by username (enhanced)
 */
export const verifyProfileByUsername = (username) => enhancedExchangeService().verifyProfileByUsername(username);

/**
 * Verify if a profile exists by user ID (enhanced)
 */
export const verifyProfileByUserId = (userId) => enhancedExchangeService().verifyProfileByUserId(userId);

/**
 * Submit contact via enhanced exchange form with integrated scanning support
 */
export const submitExchangeContact = (exchangeData) => enhancedExchangeService().submitExchangeContact(exchangeData);

/**
 * Request secure scan token for business card scanning
 */
export const requestScanToken = (profileIdentifier, identifierType = 'username') => 
  enhancedExchangeService().requestScanToken(profileIdentifier, identifierType);

/**
 * Enhanced business card scanning with proper service integration
 */
export const scanBusinessCard = (imageData, options = {}) => 
  enhancedExchangeService().scanBusinessCard(imageData, options);

/**
 * Get enhanced location with improved accuracy
 */
export const getCurrentLocation = (options) => enhancedExchangeService().getCurrentLocation(options);

/**
 * Check location permission status
 */
export const checkLocationPermission = () => enhancedExchangeService().checkLocationPermission();

/**
 * Get enhanced scanning capabilities
 */
export const getScanningCapabilities = () => enhancedExchangeService().getScanningCapabilities();

// ==================== DIRECT FUNCTION EXPORTS ====================
// Contact management functions remain the same

// --- From ContactService ---
export const getContacts = (filters) => contactService().getContacts(filters);
export const createContact = (contactData) => contactService().createContact(contactData);
export const updateContact = (contactId, updates) => contactService().updateContact(contactId, updates);
export const deleteContact = (contactId) => contactService().deleteContact(contactId);
export const updateContactStatus = (contactId, status) => contactService().updateContactStatus(contactId, status);
export const bulkUpdateContacts = (contactIds, updates) => contactService().bulkUpdateContacts(contactIds, updates);
export const importContacts = (file, format) => contactService().importContacts(file, format);
export const exportContacts = (format, filters) => contactService().exportContacts(format, filters);
export const getContactStats = () => contactService().getContactStats();

// --- From SemanticSearchService ---
export const searchContacts = async (query, options = {}) => {
  return await SemanticSearchService.search(query, options);
};
export const checkSemanticSearchAvailability = () => SemanticSearchService().checkAvailability();
export const generateSearchSuggestions = (contacts) => SemanticSearchService().generateSearchSuggestions(contacts);
export const formatSearchResults = (results) => SemanticSearchService().formatSearchResults(results);
export const getSemanticSearchUsageStats = () => SemanticSearchService().getUsageStats();

// --- From ContactGroupService ---
export const getContactGroups = () => contactGroupService().getContactGroups();
export const createContactGroup = (groupData) => contactGroupService().createContactGroup(groupData);
export const updateContactGroup = (groupId, updates) => contactGroupService().updateContactGroup(groupId, updates);
export const deleteContactGroup = (groupId) => contactGroupService().deleteContactGroup(groupId);
export const generateAutoGroups = (options) => contactGroupService().generateAutoGroups(options);
export const addContactsToGroup = (groupId, contactIds) => contactGroupService().addContactsToGroup(groupId, contactIds);
export const removeContactsFromGroup = (groupId, contactIds) => contactGroupService().removeContactsFromGroup(groupId, contactIds);
export const searchGroups = (query, filters) => contactGroupService().searchGroups(query, filters);
export const getGroupAnalytics = () => contactGroupService().getGroupAnalytics();
export const exportContactGroups = (format) => contactGroupService().exportContactGroups(format);

// --- From ContactSubscriptionService ---
export const getContactSubscriptionStatus = () => contactSubscriptionService().getSubscriptionStatus();
export const hasContactFeature = (level, feature) => contactSubscriptionService().hasContactFeature(level, feature);
export const getContactUpgradeMessage = (feature) => contactSubscriptionService().getUpgradeMessage(feature);

// ==================== LEGACY EXCHANGE FUNCTIONS ====================
// These are kept for backward compatibility but now use the enhanced service

/**
 * @deprecated Use enhanced functions above. This is kept for backward compatibility.
 */
export const getExchangeStats = (profileId) => {
  console.warn('getExchangeStats is deprecated. Use the enhanced exchange service directly.');
  // You could implement this by calling the server API directly if needed
  return Promise.resolve({ stats: { total: 0 } });
};

/**
 * @deprecated Use enhanced functions above. This is kept for backward compatibility.
 */
export const getExchangeHistory = (filters) => {
  console.warn('getExchangeHistory is deprecated. Use the enhanced exchange service directly.');
  // You could implement this by calling the server API directly if needed
  return Promise.resolve({ exchanges: [], total: 0 });
};

// ==================== BUSINESS CARD FUNCTIONS ====================
// Legacy business card functions (enhanced versions are now in the enhanced exchange service)

/**
 * Create contact from scanned business card fields
 */
export const createContactFromScan = (userId, scanData) => 
    // 2. Now, these variables exist and can be passed correctly
    businessCardService().createContactFromScan(userId, scanData);  
/**
 * Validate image data input
 */
export const validateImageDataInput = (imageData) => businessCardService().validateImageDataInput(imageData);

/**
 * Get supported image formats
 */
export const getSupportedImageFormats = () => businessCardService().getSupportedFormats();

/**
 * Estimate scan success probability
 */
export const estimateScanSuccess = (imageData) => businessCardService().estimateScanSuccess(imageData);

// --- Legacy sharing functions (keeping for backward compatibility) ---
export const shareContactsWithTeam = async (contactIds, teamMemberIds, permissions) => {
  console.log('DUMMY: Sharing contacts', { contactIds, teamMemberIds, permissions });
  return { success: true };
};
export const getTeamMembersForSharing = async () => {
  console.log('DUMMY: Getting team members for sharing');
  return [{ id: 'user1', name: 'John Doe' }, { id: 'user2', name: 'Jane Smith' }];
};

// ==================== ERROR HANDLER ====================
export { ContactErrorHandler as ErrorHandler } from './client/core/contactErrorHandler';

// ==================== HOOKS & CONSTANTS ====================
export { contactCache } from './client/core/contactCacheManager';
export { useContactsManager } from './client/hooks/useContactsManager';
export { useExchange } from './client/hooks/useExchange';
export * from './client/constants/contactConstants';

// ==================== ENHANCED EXCHANGE HOOK ====================
/**
 * Enhanced hook for exchange functionality with integrated scanning
 */
export const useEnhancedExchange = () => {
  const service = enhancedExchangeService();
  
  return {
    // Profile verification
    verifyProfileByUsername: service.verifyProfileByUsername.bind(service),
    verifyProfileByUserId: service.verifyProfileByUserId.bind(service),
    
    // Contact exchange
    submitExchangeContact: service.submitExchangeContact.bind(service),
    
    // Scanning functionality
    requestScanToken: service.requestScanToken.bind(service),
    scanBusinessCard: service.scanBusinessCard.bind(service),
    getScanningCapabilities: service.getScanningCapabilities.bind(service),
    
    // Location services
    getCurrentLocation: service.getCurrentLocation.bind(service),
    checkLocationPermission: service.checkLocationPermission.bind(service),
    
    // Utility methods
    generateScanId: service.generateScanId.bind(service),
    validateExchangeData: service.validateExchangeData.bind(service),
    sanitizeContactData: service.sanitizeContactData.bind(service)
  };
};