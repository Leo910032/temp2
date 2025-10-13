// lib/services/serviceContact/server/businessCardQR.js
/**
 * QR Code Processing Module for Business Cards
 * Handles QR code detection and vCard parsing
 */

export class BusinessCardQR {
    
    /**
     * Process image to detect and parse QR codes
     */
    static async processImage(imageBase64) {
        try {
            console.log('[QR] 🔳 Scanning for QR codes...');

            const sharp = (await import('sharp')).default;
            const jsQR = (await import('jsqr')).default;

            const imageBuffer = Buffer.from(imageBase64, 'base64');

            const { data, info } = await sharp(imageBuffer)
                .raw()
                .ensureAlpha()
                .toBuffer({ resolveWithObject: true });

            const imageData = {
                data: new Uint8ClampedArray(data),
                width: info.width,
                height: info.height
            };

            const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

            if (qrCode) {
                console.log('[QR] ✅ QR code detected');
                const parsedData = this._parseQRData(qrCode.data);

                return {
                    success: true,
                    hasQRCode: true,
                    qrData: qrCode.data,
                    qrLocation: qrCode.location,
                    parsedQRData: parsedData
                };
            }

            console.log('[QR] No QR code found');
            return {
                success: true,
                hasQRCode: false,
                qrData: null,
                parsedQRData: null
            };

        } catch (error) {
            console.error('[QR] ❌ Processing failed:', error);
            return {
                success: false,
                hasQRCode: false,
                error: error.message
            };
        }
    }

    /**
     * Parse QR code data (vCard, URL, or text)
     */
    static _parseQRData(qrData) {
        try {
            // vCard format
            if (qrData.startsWith('BEGIN:VCARD')) {
                return this._parseVCard(qrData);
            }

            // URL
            if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
                return { type: 'url', url: qrData };
            }

            // Structured contact data
            if (qrData.includes('@') && qrData.includes('\n')) {
                return this._parseStructuredContactData(qrData);
            }

            // Plain text
            return { type: 'text', data: qrData };

        } catch (error) {
            return {
                type: 'raw',
                data: qrData,
                parseError: error.message
            };
        }
    }

    /**
     * Parse vCard format (standard contact data format)
     */
    static _parseVCard(vCardData) {
        const lines = vCardData.split('\n').map(l => l.trim());
        const contactData = {};

        lines.forEach(line => {
            // Name
            if (line.startsWith('FN:')) {
                contactData.name = line.substring(3);
            } else if (line.startsWith('N:')) {
                const nameParts = line.substring(2).split(';');
                contactData.lastName = nameParts[0];
                contactData.firstName = nameParts[1];
            }
            // Email
            else if (line.includes('EMAIL')) {
                const email = line.split(':').pop();
                contactData.email = email;
            }
            // Phone
            else if (line.includes('TEL')) {
                const phone = line.split(':').pop();
                if (!contactData.phone) {
                    contactData.phone = phone;
                }
            }
            // Organization
            else if (line.startsWith('ORG:')) {
                contactData.company = line.substring(4);
            }
            // Title
            else if (line.startsWith('TITLE:')) {
                contactData.jobTitle = line.substring(6);
            }
            // Website
            else if (line.startsWith('URL:')) {
                contactData.website = line.substring(4);
            }
            // Address
            else if (line.startsWith('ADR')) {
                const addr = line.split(':').pop();
                contactData.address = addr.replace(/;/g, ', ');
            }
        });

        // Combine first and last name if both exist
        if (contactData.firstName && contactData.lastName) {
            contactData.name = `${contactData.firstName} ${contactData.lastName}`.trim();
            delete contactData.firstName;
            delete contactData.lastName;
        }

        return {
            type: 'vcard',
            contactData
        };
    }

    /**
     * Parse structured contact data (simple format)
     */
    static _parseStructuredContactData(data) {
        const lines = data.split('\n').map(l => l.trim());
        const contactData = {};

        lines.forEach(line => {
            if (line.includes('@')) {
                contactData.email = line;
            } else if (/^\+?\d/.test(line)) {
                contactData.phone = line;
            } else if (line.length > 2 && line.length < 50) {
                if (!contactData.name) {
                    contactData.name = line;
                } else if (!contactData.company) {
                    contactData.company = line;
                }
            }
        });

        return {
            type: 'structured',
            contactData
        };
    }
}