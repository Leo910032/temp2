// lib/services/serviceContact/index.js - UPDATED
"use client"

// This file is the main entry point for the entire contact service library.

import { ContactServiceFactory } from './client/factories/ContactServiceFactory';

// ==================== SERVICE INSTANCES ====================
// Create singleton instances of each service for easy access.
const contactService = () => ContactServiceFactory.getContactService();
const contactGroupService = () => ContactServiceFactory.getContactGroupService();
const contactSubscriptionService = () => ContactServiceFactory.getContactSubscriptionService();
const exchangeService = () => ContactServiceFactory.getExchangeService();
const businessCardService = () => ContactServiceFactory.getBusinessCardService();

// ==================== DIRECT FUNCTION EXPORTS ====================
// This is what allows for clean imports like `import { createContact } from '...'`

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

// --- From ExchangeService ---
export const verifyProfileByUsername = (username) => exchangeService().verifyProfileByUsername(username);
export const verifyProfileByUserId = (userId) => exchangeService().verifyProfileByUserId(userId);
export const submitExchangeContact = (exchangeData) => exchangeService().submitExchangeContact(exchangeData);
export const getExchangeStats = (profileId) => exchangeService().getExchangeStats(profileId);
export const getExchangeHistory = (filters) => exchangeService().getExchangeHistory(filters);
export const getCurrentLocation = (options) => exchangeService().getCurrentLocation(options);
export const checkLocationPermission = () => exchangeService().checkLocationPermission();

// --- NEW: From BusinessCardService ---
export const scanBusinessCard = (imageData) => businessCardService().scanBusinessCard(imageData);
export const createContactFromScan = (scannedFields) => businessCardService().createContactFromScan(scannedFields);
export const validateImageDataInput = (imageData) => businessCardService().validateImageDataInput(imageData);
export const getSupportedImageFormats = () => businessCardService().getSupportedFormats();
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
export * from './client/services/constants/contactConstants';