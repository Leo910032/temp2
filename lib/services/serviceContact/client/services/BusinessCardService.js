"use client";

import { ContactApiClient } from '@/lib/services/core/ApiClient';
import imageCompression from 'browser-image-compression';

/**
 * A dedicated client-side service for all Business Card Scanner operations.
 * This class uses static methods and can be imported directly without a factory.
 * It is responsible for pre-processing images and communicating with the backend API.
 */
export class BusinessCardService {

    /**
     * Takes one or more images, compresses and converts them, sends them to the server for scanning,
     * and returns the final merged result. This is the primary orchestration method for the client.
     * @param {{ front: File, back?: File }} images - An object containing the front and optional back image files.
     * @returns {Promise<object>} An object containing the merged `standardFields`, `dynamicFields`, and `metadata`.
     */
    static async scanImages(images) {
        if (!images || !images.front) {
            throw new Error('Front image is required for scanning.');
        }

        const scanPromises = Object.entries(images).map(([side, file]) => {
            if (file) {
                return this._processAndScanSingleImage(file, side);
            }
            return null;
        }).filter(Boolean);

        const results = await Promise.all(scanPromises);
        
        return this._mergeSideResults(results);
    }

    /**
     * Takes the final, user-approved fields and saves them as a new contact.
     * @param {object} finalFields - The object containing `standardFields` and `dynamicFields`.
     * @returns {Promise<object>} The newly created contact object from the server.
     */
    static async saveScannedContact(finalFields) {
        console.log('BusinessCardService: Saving scanned contact...');
        return ContactApiClient.post('/api/user/contacts/from-scan', {
            parsedFields: finalFields
        });
    }

    // --- Private Helper Methods ---

    /**
     * Handles the full lifecycle for a single image: compress, convert, and scan.
     * @private
     */
    static async _processAndScanSingleImage(file, side) {
        try {
            console.log(`[BusinessCardService] Processing ${side} side...`);
            const compressedFile = await this._compressImage(file);
            const base64 = await this._convertFileToBase64(compressedFile);

            const scanResult = await ContactApiClient.post('/api/user/contacts/scan', {
                imageBase64: base64,
                side: side,
            });
            
            if (!scanResult.success) {
                throw new Error(scanResult.error || `Scanning ${side} side failed.`);
            }
            
            return { side, success: true, ...scanResult };
        } catch (error) {
            console.error(`[BusinessCardService] Error processing ${side} side:`, error);
            // Return a structured error object so Promise.all doesn't fail completely
            return { side, success: false, error: error.message };
        }
    }

    /**
     * Compresses an image file for faster uploads.
     * @private
     */
    static async _compressImage(file) {
        const options = {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8
        };
        try {
            const compressedFile = await imageCompression(file, options);
            console.log(`[BusinessCardService] Image compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(compressedFile.size / 1024).toFixed(1)}KB`);
            return compressedFile;
        } catch (error) {
            console.warn('[BusinessCardService] Image compression failed, using original file.', error);
            return file; // Fallback to original file if compression fails
        }
    }

    /**
     * Converts a File or Blob to a base64 string.
     * @private
     */
    static _convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Result includes the data URL prefix, so we strip it.
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Merges the results from front and back card scans.
     * @private
     */
    static _mergeSideResults(sideResults) {
        const mergedStandardFields = new Map();
        const mergedDynamicFields = new Map();
        const metadata = {
            sidesProcessed: sideResults.length,
            successfulSides: sideResults.filter(r => r.success).length,
            hasQRCode: false,
        };

        sideResults.forEach(({ side, success, parsedFields, dynamicFields, metadata: sideMetadata }) => {
            if (success) {
                if (sideMetadata?.hasQRCode) metadata.hasQRCode = true;

                // Process standard fields, keeping the one with higher confidence
                (parsedFields || []).forEach(field => {
                    const key = field.label.toLowerCase();
                    const existing = mergedStandardFields.get(key);
                    if (!existing || field.confidence > existing.confidence) {
                        mergedStandardFields.set(key, field);
                    }
                });
                
                // Process dynamic fields, keeping them all and namespacing by side
                (dynamicFields || []).forEach(field => {
                    const key = `${field.label.toLowerCase()}_${side}`;
                    mergedDynamicFields.set(key, { ...field, side });
                });
            }
        });
        
        const finalStandardFields = Array.from(mergedStandardFields.values());
        const finalDynamicFields = Array.from(mergedDynamicFields.values());
        
        return {
            success: metadata.successfulSides > 0,
            standardFields: finalStandardFields,
            dynamicFields: finalDynamicFields,
            metadata: {
                ...metadata,
                totalFields: finalStandardFields.length + finalDynamicFields.length,
            }
        };
    }
}