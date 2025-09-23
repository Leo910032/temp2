//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// lib/services/serviceContact/client/services/ContactService.js
// Main contact service following enterprise pattern
// ✅ ADD THIS IMPORT STATEMENT
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { ContactErrorHandler } from '../core/contactErrorHandler'; // This seems to be used implicitly, good to have.
import { validateContactData } from '../constants/contactConstants';
import { auth } from '@/important/firebase';

export class ContactService extends BaseContactService {
  constructor() {
    super('ContactService');
  }

  // ==================== CORE CONTACT OPERATIONS ====================

  /**
   * Get all contacts with filtering and pagination
   */
  async getContacts(filters = {}) {
    try {
      const { status, search, limit = 100, offset = 0 } = filters;

      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());

      const url = `/api/user/contacts${params.toString() ? `?${params.toString()}` : ''}`;

      return this.cachedRequest(
        'contacts',
        () => ContactApiClient.get(url),
        'contacts',
        { status, search, limit, offset }
      );
    } catch (error) {
      throw ContactErrorHandler.handle(error, 'getContacts');
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId) {
    this.validateParams({ contactId }, ['contactId']);

    return this.cachedRequest(
      'contact',
      () => ContactApiClient.get(`/api/user/contacts/${contactId}`),
      'contacts',
      { contactId }
    );
  }

  /**
   * Create new contact
   */
  async createContact(contactData) {
    const validation = validateContactData(contactData);
    if (!validation.isValid) {
      throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
    }

    const result = await ContactApiClient.post('/api/user/contacts', {
      action: 'create',
      contact: contactData
    });

    // Invalidate contacts cache
    this.invalidateCache(['contact']);

    return result;
  }

  /**
   * Update existing contact
   */
  async updateContact(contactId, contactData) {
    this.validateParams({ contactId }, ['contactId']);
    
    const validation = validateContactData(contactData);
    if (!validation.isValid) {
      throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
    }

    const result = await ContactApiClient.put(`/api/user/contacts/${contactId}`, {
      action: 'update',
      contact: contactData
    });

    // Invalidate specific contact and list caches
    this.invalidateCache(['contact', `contact_${contactId}`]);

    return result;
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId) {
    this.validateParams({ contactId }, ['contactId']);

    const result = await ContactApiClient.delete(`/api/user/contacts/${contactId}`);

    // Invalidate caches
    this.invalidateCache(['contact', `contact_${contactId}`]);

    return result;
  }

  /**
   * Update contact status
   */
  async updateContactStatus(contactId, newStatus) {
    this.validateParams({ contactId, newStatus }, ['contactId', 'newStatus']);

    const result = await ContactApiClient.patch(`/api/user/contacts/${contactId}/status`, {
      status: newStatus
    });

    // Invalidate caches
    this.invalidateCache(['contact', `contact_${contactId}`]);

    return result;
  }

  /**
   * Bulk operations on contacts
   */
  async bulkUpdateContacts(contactIds, updates) {
    this.validateParams({ contactIds, updates }, ['contactIds', 'updates']);

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new Error('Contact IDs must be a non-empty array');
    }

    const result = await ContactApiClient.post('/api/user/contacts/bulk', {
      action: 'bulkUpdate',
      contactIds,
      updates
    });

    // Invalidate all contact caches
    this.invalidateCache(['contact']);

    return result;
  }

  /**
   * Search contacts with advanced filters
   */
  async searchContacts(searchQuery, filters = {}) {
    const { status, hasLocation, source, dateRange } = filters;
    
    return this.cachedRequest(
      'search',
      () => ContactApiClient.post('/api/user/contacts/search', {
        query: searchQuery,
        filters: {
          status,
          hasLocation,
          source,
          dateRange
        }
      }),
      'contacts',
      { searchQuery, ...filters }
    );
  }

  /**
   * Get contact statistics
   */
  async getContactStats() {
    return this.cachedRequest(
      'stats',
      () => ContactApiClient.get('/api/user/contacts/stats/'),
      'analytics'
    );
  }

  // ==================== IMPORT/EXPORT OPERATIONS ====================

  /**
   * Import contacts from file
   */
 
  /**
   * Import contacts from file
   */
  async importContacts(file, format = 'csv') {
    if (!file) {
      throw new Error('File is required for import');
    }

    // 1. Get the current user's auth token
    const user = auth.currentUser;
    if (!user) {
        throw new Error('Authentication required. Please sign in again.');
    }
    const token = await user.getIdToken();

    // 2. Prepare the FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    try {
      // 3. ✅ FIXED: Use `fetch` directly to bypass the JSON-only ContactApiClient
      const response = await fetch('/api/user/contacts/import', {
        method: 'POST',
        headers: {
          // Do NOT set 'Content-Type'. The browser will do it automatically
          // for FormData, including the crucial 'boundary' part.
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // 4. Handle the response from the API
      const result = await response.json();

      if (!response.ok) {
        // Throw an error with the message from the server's JSON response
        throw new Error(result.error || `Import failed with status: ${response.status}`);
      }

      // 5. Invalidate cache and return the successful result
      this.invalidateCache(['contact']);
      return result;

    } catch (error) {
        // Re-throw the error so the UI can catch it
        throw error;
    }
  }


  /**
   * Export contacts to file
   */
   async exportContacts(format = 'csv', filters = {}) {
    const params = new URLSearchParams();
    params.append('format', format);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          // Use getAll('contactIds') on the server
          value.forEach(item => params.append('contactIds', item));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    // ✅ CORRECT PATH
    const url = `/api/user/contacts/export?${params.toString()}`;

    // ✅ CORRECT LOGIC: await the blob and construct the return object
    const blob = await ContactApiClient.get(url, {
      responseType: 'blob'
    });
    
    const filename = `contacts_${new Date().toISOString().split('T')[0]}.${format}`;

    return { data: blob, filename };
  }


  // ==================== BUSINESS CARD SCANNING ====================

  /**
   * Scan business card from image
   */
  async scanBusinessCard(imageData) {
    if (!imageData) {
      throw new Error('Image data is required for scanning');
    }

    // Handle different image data formats
    let processedData;
    
    if (imageData instanceof File || imageData instanceof Blob) {
      processedData = await this.convertFileToBase64(imageData);
    } else if (typeof imageData === 'string') {
      processedData = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    } else {
      throw new Error('Unsupported image data format');
    }

    const result = await ContactApiClient.post('/api/user/contacts/scan', {
      imageBase64: processedData
    });

    return result;
  }

  /**
   * Create contact from scanned business card data
   */
  // lib/services/serviceContact/client/services/ContactService.js

// ... (class definition) ...

  /**
   * Create new contact
   */
  // ✅ 1. UPDATE THE METHOD SIGNATURE
  async createContact(userId, contactData) {
    // 2. VALIDATE THE CORRECT OBJECT
    const validation = validateContactData(contactData);
    if (!validation.isValid) {
      throw new Error(`Invalid contact data: ${validation.errors.join(', ')}`);
    }

    // 3. PASS THE USERID AND CONTACTDATA TO THE API
    // (Your API likely needs the userId to associate the contact correctly)
    const result = await ContactApiClient.post('/api/user/contacts', {
      action: 'create',
      userId: userId, // Assuming your API expects this
      contact: contactData
    });

    // Invalidate contacts cache
    this.invalidateCache(['contact']);

    return result;
  }

// ... (rest of the file) ...

  // ==================== HELPER METHODS ====================

  /**
   * Convert file to base64
   */
  convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const result = event.target.result;
          if (!result || typeof result !== 'string') {
            reject(new Error('Failed to read file'));
            return;
          }

          const base64Part = result.split(',')[1];
          if (!base64Part) {
            reject(new Error('Could not extract base64 data'));
            return;
          }

          resolve(base64Part);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extract contact data from scanned business card fields
   */
  extractContactDataFromScan(scannedFields) {
    const contactData = {
      source: 'business_card_scan',
      status: 'new',
      submittedAt: new Date().toISOString()
    };

    // Map scanned fields to contact data
    scannedFields.forEach(field => {
      const label = field.label.toLowerCase();
      const value = field.value.trim();

      if (!value) return;

      if (label.includes('name')) {
        contactData.name = value;
      } else if (label.includes('email')) {
        contactData.email = value.toLowerCase();
      } else if (label.includes('phone') || label.includes('tel')) {
        contactData.phone = value;
      } else if (label.includes('company')) {
        contactData.company = value;
      } else if (label.includes('title') || label.includes('position')) {
        contactData.jobTitle = value;
      } else if (label.includes('website') || label.includes('url')) {
        contactData.website = value;
      }
    });

    // Ensure we have at least a name
    if (!contactData.name) {
      contactData.name = 'Unnamed Contact';
    }

    // Store all scanned fields as details
    contactData.details = scannedFields.filter(f => f.value.trim() !== '');

    return contactData;
  }

  /**
   * Format contact for display
   */
  formatContactForDisplay(contact) {
    return {
      ...contact,
      displayName: contact.name || 'Unnamed Contact',
      displayEmail: contact.email || 'No email',
      displayPhone: contact.phone || 'No phone',
      displayCompany: contact.company || 'No company',
      isRecent: this.isRecentContact(contact.submittedAt),
      hasLocation: !!(contact.location && contact.location.latitude),
      statusColor: this.getStatusColor(contact.status),
      sourceIcon: this.getSourceIcon(contact.source)
    };
  }

  /**
   * Check if contact is recent (within last 7 days)
   */
  isRecentContact(submittedAt) {
    if (!submittedAt) return false;
    
    const contactDate = new Date(submittedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return contactDate > sevenDaysAgo;
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status) {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'viewed': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Get source icon for UI
   */
  getSourceIcon(source) {
    switch (source) {
      case 'business_card_scan': return '📇';
      case 'manual': return '✏️';
      case 'import_csv': return '📊';
      case 'import_json': return '📄';
      case 'exchange_form': return '🔗';
      case 'team_share': return '👥';
      case 'api': return '🔌';
      default: return '📋';
    }
  }
}
