// lib/services/serviceContact/server/businessCardOCR.js
/**
 * OCR Processing Module for Business Cards
 * Handles text extraction using Google Cloud Vision API
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';

export class BusinessCardOCR {
    
    /**
     * Process image and extract text using OCR
     */
    static async processImage(imageBase64) {
        try {
            console.log('[OCR] 🔍 Starting OCR processing...');

            const result = await this._callGoogleVisionAPI(imageBase64);
            
            if (!result.success) {
                return {
                    success: false,
                    text: '',
                    blocks: [],
                    confidence: 0,
                    error: result.error
                };
            }

            const processed = this._processOCRResponse(result);
            
            console.log(`[OCR] ✅ Extraction complete. Confidence: ${processed.confidence}`);
            return processed;

        } catch (error) {
            console.error('[OCR] ❌ Processing failed:', error);
            return {
                success: false,
                text: '',
                blocks: [],
                confidence: 0,
                error: error.message
            };
        }
    }

    /**
     * Call Google Cloud Vision API
     */
    static async _callGoogleVisionAPI(imageBase64) {
        try {
            // Initialize client with credentials from environment
            const credentials = {
                project_id: process.env.FIREBASE_PROJECT_ID,
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            };

            const client = new ImageAnnotatorClient({
                projectId: credentials.project_id,
                credentials,
            });

            // Use DOCUMENT_TEXT_DETECTION for business cards
            const request = {
                image: { content: imageBase64 },
                features: [
                    { type: 'DOCUMENT_TEXT_DETECTION' },
                    { type: 'TEXT_DETECTION' }
                ],
            };

            const [result] = await client.annotateImage(request);

            if (!result) {
                throw new Error('No response from Vision API');
            }

            return {
                success: true,
                fullText: result.fullTextAnnotation?.text || '',
                textAnnotations: result.textAnnotations || [],
                confidence: this._calculateConfidence(result.textAnnotations),
                provider: 'google-vision'
            };

        } catch (error) {
            console.error('[OCR] ❌ Google Vision API error:', error);
            
            // Log detailed auth info for debugging
            console.error('[OCR] Auth check:', {
                projectId: process.env.FIREBASE_PROJECT_ID ? '✓' : '✗',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? '✓' : '✗',
                privateKey: process.env.FIREBASE_PRIVATE_KEY ? '✓' : '✗'
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process OCR response into structured format
     */
    static _processOCRResponse(ocrResult) {
        if (!ocrResult.success) {
            return {
                success: false,
                text: '',
                blocks: [],
                confidence: 0,
                provider: ocrResult.provider
            };
        }

        const textBlocks = (ocrResult.textAnnotations || []).map(annotation => ({
            text: annotation.description,
            confidence: annotation.confidence || 0,
            boundingBox: annotation.boundingPoly,
            vertices: annotation.boundingPoly?.vertices || []
        }));

        return {
            success: true,
            text: ocrResult.fullText,
            blocks: textBlocks,
            confidence: ocrResult.confidence,
            provider: 'google-vision',
            wordCount: ocrResult.fullText.split(/\s+/).length,
            lineCount: ocrResult.fullText.split('\n').length
        };
    }

    /**
     * Calculate overall confidence score
     */
    static _calculateConfidence(textAnnotations) {
        if (!textAnnotations || textAnnotations.length === 0) {
            return 0;
        }

        const confidenceScores = textAnnotations
            .filter(annotation => typeof annotation.confidence === 'number')
            .map(annotation => annotation.confidence);

        if (confidenceScores.length === 0) {
            return 0.75; // Default confidence when not provided
        }

        const averageConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
        return Math.round(averageConfidence * 100) / 100;
    }
}