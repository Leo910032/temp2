// lib/services/serviceContact/client/services/AutoGroupService.js
// Client-side service for auto-generating contact groups.

"use client";
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';

export class AutoGroupService extends BaseContactService {
  constructor() {
    super('AutoGroupService');
  }

  /**
   * Triggers the server to generate automatic groups based on provided options.
   * @param {object} options - Configuration for group generation.
   */
  async generateAutoGroups(options = {}) {
        console.log("📡 [Client Service] Sending request to /api/user/contacts/groups/auto-generate", { options });

    // Make the API call to our dedicated endpoint
    const result = await ContactApiClient.post('/api/user/contacts/groups/auto-generate', {
      options
    });
    console.log("✅ [Client Service] Received response from API", result);

    // Invalidate the main groups cache so the UI re-fetches the new list
    this.invalidateCache(['group']);

    return result;
  }
}
