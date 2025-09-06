// lib/services/serviceEnterprise/server/enterpriseOrganizationService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { EnterpriseSecurityService } from './enterpriseSecurityService';
import { enterpriseConfig } from '../../../config/enterpriseConfig';

export class EnterpriseOrganizationService {

  static async createOrganization(creatorId, orgData) {
    const { name, domain, subscriptionLevel, billing, settings } = orgData;
    
    // Check if domain already exists
    const existingOrgQuery = await adminDb.collection('Organizations').where('domain', '==', domain.toLowerCase()).limit(1).get();
    if (!existingOrgQuery.empty) {
      throw new Error('An organization with this domain already exists');
    }
    
    const orgId = `org_${Date.now()}`;
    const newOrganizationData = {
      name: name.trim(),
      domain: domain.toLowerCase(),
      subscriptionLevel: subscriptionLevel || enterpriseConfig.defaults.organization.subscriptionLevel,
      createdAt: FieldValue.serverTimestamp(),
      billing: { ...enterpriseConfig.defaults.organization.billing, ...billing },
      settings: { ...enterpriseConfig.defaults.organization.settings, ...settings },
      teams: {},
      verificationStatus: 'pending',
    };

    await adminDb.collection('Organizations').doc(orgId).set(newOrganizationData);

    await EnterpriseSecurityService.logAuditEvent({
      userId: creatorId,
      organizationId: orgId,
      action: 'organization_created',
      resourceType: 'organization',
      resourceId: orgId,
      details: { name: newOrganizationData.name, domain: newOrganizationData.domain }
    });

    return { id: orgId, ...newOrganizationData };
  }

  static async getOrganizationDetails(orgId) {
    const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
    if (!orgDoc.exists) {
      throw new Error('Organization not found');
    }
    return { id: orgDoc.id, ...orgDoc.data() };
  }

  static async updateOrganization(updaterId, orgId, updates) {
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
    await adminDb.collection('Organizations').doc(orgId).update(sanitizedUpdates);

    await EnterpriseSecurityService.logAuditEvent({
      userId: updaterId,
      organizationId: orgId,
      action: 'organization_updated',
      resourceType: 'organization',
      resourceId: orgId,
      details: { updatedFields: Object.keys(sanitizedUpdates) }
    });

    return sanitizedUpdates;
  }

  static async deleteOrganization(deleterId, orgId) {
    const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
    if (!orgDoc.exists) throw new Error('Organization not found');

    // Add more safety checks here in a real app (e.g., check for active members)

    const batch = adminDb.batch();
    batch.delete(adminDb.collection('Organizations').doc(orgId));

    // You would also delete related invitations, teams, etc. here
    await batch.commit();

    await EnterpriseSecurityService.logAuditEvent({
      userId: deleterId,
      organizationId: orgId,
      action: 'organization_deleted',
      resourceType: 'organization',
      resourceId: orgId,
      severity: 'critical'
    });
  }
}