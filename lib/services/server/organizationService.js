// lib/services/server/organizationService.js

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_ORGANIZATION_SETTINGS } from '@/lib/services/constants';
export class OrganizationService {

    /**
     * Fetches a single organization document by its ID.
     * @param {object} options
     * @param {string} options.organizationId - The ID of the organization to fetch.
     * @returns {Promise<object|null>} The organization data or null if not found.
     */
    static async getOrganizationById({ organizationId }) {
        if (!organizationId) {
            console.warn('OrganizationService: organizationId was not provided.');
            return null;
        }
        
        const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            console.warn(`OrganizationService: Organization with ID ${organizationId} not found.`);
            return null;
        }
        return { id: orgDoc.id, ...orgDoc.data() };
    }

    /**
     * Fetches all members of an organization.
     * @param {object} options
     * @param {string} options.organizationId - The ID of the organization.
     * @returns {Promise<Array>} A list of user data objects for all members.
     */
    static async getOrganizationMembers({ organizationId }) {
        const membersSnapshot = await adminDb.collection('users')
            .where('enterprise.organizationId', '==', organizationId)
            .get();
        
        if (membersSnapshot.empty) {
            return [];
        }

        return membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Creates a new organization document.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {object} options.orgData - Organization data { name, domain, subscriptionLevel, etc. }.
     * @returns {Promise<object>} The newly created organization data.
     */
    static async createOrganization({ session, orgData }) {
        const { name, domain, subscriptionLevel, billing, settings } = orgData;
        const { userId } = session;
        
        // Check if domain already exists (if domain is provided)
        if (domain) {
            const existingOrgQuery = await adminDb.collection('organizations')
                .where('domain', '==', domain.toLowerCase())
                .limit(1)
                .get();
                
            if (!existingOrgQuery.empty) {
                throw new Error('An organization with this domain already exists');
            }
        }
        
        const orgRef = adminDb.collection('organizations').doc(); // Auto-generate ID
        const timestamp = new Date();
        
        const newOrganizationData = {
            id: orgRef.id,
            name: name.trim(),
            domain: domain ? domain.toLowerCase() : null,
            subscriptionLevel: subscriptionLevel || 'business',
            createdAt: timestamp,
            lastModified: timestamp,
            createdBy: userId,
            // Merge with default settings
            settings: { ...DEFAULT_ORGANIZATION_SETTINGS, ...settings },
            billing: billing || {},
            verificationStatus: 'pending',
            // Initialize empty collections
            banners: {},
            templates: {
                linkTemplates: {},
                appearanceTemplates: {}
            }
        };

        await orgRef.set(newOrganizationData);

        // Note: Audit logging would be handled by a separate service
        // await SecurityService.logAuditEvent({ ... })

        return newOrganizationData;
    }

    /**
     * Updates organization settings.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The ID of the organization to update.
     * @param {object} options.updates - An object with fields to update.
     * @returns {Promise<object>} The update object.
     */
    static async updateOrganizationSettings({ session, organizationId, updates }) {
        const allowedFields = ['name', 'settings', 'billing', 'industry', 'country'];
        const sanitizedUpdates = {};
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                sanitizedUpdates[key] = value;
            }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
            throw new Error('No valid update fields provided');
        }

        sanitizedUpdates.lastModified = FieldValue.serverTimestamp();
        
        const orgRef = adminDb.collection('organizations').doc(organizationId);
        await orgRef.update(sanitizedUpdates);

        // Note: Audit logging would be handled by SecurityService
        // await SecurityService.logAuditEvent({ ... })

        return sanitizedUpdates;
    }

    /**
     * Manages organization banners.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     * @param {object} options.bannerData - Banner configuration data.
     * @returns {Promise<object>} The created banner data.
     */
    static async addBanner({ session, organizationId, bannerData }) {
        const { title, content, type, isActive = true, targetAudience } = bannerData;
        
        const bannerRef = adminDb.collection('organizations').doc(organizationId);
        const bannerId = `banner_${Date.now()}`;
        const timestamp = new Date();
        
        const newBanner = {
            id: bannerId,
            title: title.trim(),
            content: content.trim(),
            type: type || 'info', // info, warning, success, error
            isActive,
            targetAudience: targetAudience || 'all', // all, teams, managers, etc.
            createdAt: timestamp,
            createdBy: session.userId,
            lastModified: timestamp
        };

        await bannerRef.update({
            [`banners.${bannerId}`]: newBanner,
            lastModified: FieldValue.serverTimestamp()
        });

        return newBanner;
    }

    /**
     * Manages organization link templates.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     * @param {object} options.templateData - Template configuration data.
     * @returns {Promise<object>} The created template data.
     */
    static async addLinkTemplate({ session, organizationId, templateData }) {
        const { name, description, urlPattern, isDefault = false } = templateData;
        
        const orgRef = adminDb.collection('organizations').doc(organizationId);
        const templateId = `template_${Date.now()}`;
        const timestamp = new Date();
        
        const newTemplate = {
            id: templateId,
            name: name.trim(),
            description: description?.trim() || '',
            urlPattern: urlPattern.trim(),
            isDefault,
            createdAt: timestamp,
            createdBy: session.userId,
            lastModified: timestamp
        };

        await orgRef.update({
            [`templates.linkTemplates.${templateId}`]: newTemplate,
            lastModified: FieldValue.serverTimestamp()
        });

        return newTemplate;
    }

    /**
     * Manages organization appearance templates.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     * @param {object} options.templateData - Appearance template data.
     * @returns {Promise<object>} The created template data.
     */
    static async addAppearanceTemplate({ session, organizationId, templateData }) {
        const { name, description, styles, isDefault = false } = templateData;
        
        const orgRef = adminDb.collection('organizations').doc(organizationId);
        const templateId = `appearance_${Date.now()}`;
        const timestamp = new Date();
        
        const newTemplate = {
            id: templateId,
            name: name.trim(),
            description: description?.trim() || '',
            styles: styles || {}, // CSS styles object
            isDefault,
            createdAt: timestamp,
            createdBy: session.userId,
            lastModified: timestamp
        };

        await orgRef.update({
            [`templates.appearanceTemplates.${templateId}`]: newTemplate,
            lastModified: FieldValue.serverTimestamp()
        });

        return newTemplate;
    }

    /**
     * Updates organization branding settings.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     * @param {object} options.brandingData - Branding configuration.
     * @returns {Promise<object>} The updated branding data.
     */
    static async updateBranding({ session, organizationId, brandingData }) {
        const { logoUrl, primaryColor, secondaryColor, companyName } = brandingData;
        
        const updates = {
            'settings.branding': {
                logoUrl: logoUrl || null,
                primaryColor: primaryColor || '#000000',
                secondaryColor: secondaryColor || '#ffffff',
                companyName: companyName?.trim() || null,
                lastUpdated: new Date(),
                updatedBy: session.userId
            },
            lastModified: FieldValue.serverTimestamp()
        };

        const orgRef = adminDb.collection('organizations').doc(organizationId);
        await orgRef.update(updates);

        return updates['settings.branding'];
    }

    /**
     * Manages cross-team sharing settings.
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     * @param {boolean} options.allowCrossTeamSharing - Whether to allow cross-team sharing.
     * @param {boolean} options.requireManagerApproval - Whether manager approval is required.
     * @returns {Promise<object>} The updated sharing settings.
     */
    static async updateCrossTeamSharingSettings({ session, organizationId, allowCrossTeamSharing, requireManagerApproval }) {
        const updates = {
            'settings.allowCrossTeamSharing': allowCrossTeamSharing,
            'settings.requireManagerApprovalForSharing': requireManagerApproval,
            lastModified: FieldValue.serverTimestamp()
        };

        const orgRef = adminDb.collection('organizations').doc(organizationId);
        await orgRef.update(updates);

        return {
            allowCrossTeamSharing,
            requireManagerApprovalForSharing: requireManagerApproval
        };
    }

    /**
     * Gets organization statistics and analytics data.
     * @param {object} options
     * @param {string} options.organizationId - The organization ID.
     * @returns {Promise<object>} Organization statistics.
     */
    static async getOrganizationStats({ organizationId }) {
        // Get member count
        const membersSnapshot = await adminDb.collection('users')
            .where('enterprise.organizationId', '==', organizationId)
            .get();

        // Get team count
        const teamsSnapshot = await adminDb.collection('teams')
            .where('organizationId', '==', organizationId)
            .get();

        return {
            memberCount: membersSnapshot.size,
            teamCount: teamsSnapshot.size,
            // Add more statistics as needed
        };
    }

    /**
     * Deletes an organization (use with extreme caution).
     * @param {object} options
     * @param {object} options.session - The authenticated user session.
     * @param {string} options.organizationId - The organization ID.
     */
    static async deleteOrganization({ session, organizationId }) {
        const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            throw new Error('Organization not found');
        }

        // This would require extensive cleanup of teams, members, etc.
        // Implementation depends on your specific requirements
        
        const batch = adminDb.batch();
        batch.delete(adminDb.collection('organizations').doc(organizationId));

        // Add cleanup for related documents (teams, user associations, etc.)
        
        await batch.commit();

        // Note: Critical audit logging would be handled by SecurityService
    }
}
