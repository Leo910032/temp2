// /////////////////////////////////////////////////////////////////////////////////////////////////////////////
//lib/services/serviceContact/client/services/PlacesService.js
// Client-side service for interacting with the Places API proxy.

"use client"
import { BaseContactService } from '../abstractions/BaseContactService';
import { ContactApiClient } from '../core/contactApiClient';
import { ContactErrorHandler } from '../core/contactErrorHandler';

export class PlacesService extends BaseContactService {
  constructor() {
    super('PlacesService');
  }

  /**
   * Get place predictions from our backend API.
   * @param {object} params - { input, sessiontoken, types }
   */
  async getPredictions(params) {
    try {
      this.validateParams(params, ['input', 'sessiontoken']);
      return await ContactApiClient.post('/api/user/contacts/places/autocomplete', params);
    } catch (error) {
      console.error("PlacesService Error (getPredictions):", error);
      throw ContactErrorHandler.handle(error, 'getPredictions');
    }
  }

  /**
   * Get place details from our backend API.
   * @param {object} params - { place_id, sessiontoken, fields }
   */
  async getDetails(params) {
    try {
      this.validateParams(params, ['place_id', 'sessiontoken']);
      return await ContactApiClient.post('/api/user/contacts/places/details', params);
    } catch (error) {
      console.error("PlacesService Error (getDetails):", error);
      throw ContactErrorHandler.handle(error, 'getDetails');
    }
  }
}
