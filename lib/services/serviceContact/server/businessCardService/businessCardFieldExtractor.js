
// lib/services/serviceContact/server/businessCardFieldExtractor.js
/**
 * Field Extraction and Validation Module
 * Handles pattern matching, cleaning, and validation of extracted contact data
 */

export class BusinessCardFieldExtractor {
    
    /**
     * Extract fields using pattern matching (for basic tier)
     */
    static extractFieldsBasic(text, qrData = null) {
        const fields = [];

        if (!text && !qrData) return fields;

        // Extract from text if available
        if (text) {
            const textFields = this._extractFromText(text);
            fields.push(...textFields);
        }

        // Add QR data if available
        if (qrData?.contactData) {
            const qrFields = this._extractFromQR(qrData.contactData);
            fields.push(...qrFields);
        }

        return fields;
    }

    /**
     * Extract fields from OCR text using regex patterns
     */
    static _extractFromText(text) {
        const fields = [];
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Email extraction
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                fields.push({
                    label: 'Email',
                    value: email.toLowerCase(),
                    type: 'standard',
                    confidence: 0.9,
                    source: 'regex'
                });
            });
        }

        // Phone extraction
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phones = text.match(phoneRegex);
        if (phones) {
            phones.forEach(phone => {
                fields.push({
                    label: 'Phone',
                    value: phone,
                    type: 'standard',
                    confidence: 0.85,
                    source: 'regex'
                });
            });
        }

        // Website extraction
        const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/g;
        const urls = text.match(urlRegex);
        if (urls) {
            urls.forEach(url => {
                fields.push({
                    label: 'Website',
                    value: url.startsWith('http') ? url : `http://${url}`,
                    type: 'custom',
                    confidence: 0.8,
                    source: 'regex'
                });
            });
        }

        // Name extraction (heuristic: first non-contact line)
        const potentialNames = lines.filter(line => {
            return !emailRegex.test(line) && 
                   !phoneRegex.test(line) && 
                   !urlRegex.test(line) && 
                   line.length > 2 && 
                   line.length < 50 &&
                   !/^\d+$/.test(line);
        });

        if (potentialNames.length > 0) {
            fields.push({
                label: 'Name',
                value: potentialNames[0],
                type: 'standard',
                confidence: 0.7,
                source: 'heuristic'
            });
        }

        // Company extraction (look for business indicators)
        const companyIndicators = /\b(inc|llc|ltd|corp|corporation|company|co\.|group|enterprises|solutions|services)\b/i;
        const potentialCompanies = lines.filter(line => 
            companyIndicators.test(line) && 
            !emailRegex.test(line) && 
            !phoneRegex.test(line)
        );

        if (potentialCompanies.length > 0) {
            fields.push({
                label: 'Company',
                value: potentialCompanies[0],
                type: 'standard',
                confidence: 0.75,
                source: 'heuristic'
            });
        }

        // Job title extraction
        const titleRegex = /\b(manager|director|president|ceo|cto|cfo|vp|vice president|senior|engineer|developer|designer|consultant|analyst)\b/i;
        const potentialTitles = lines.filter(line => 
            titleRegex.test(line) && 
            !emailRegex.test(line) && 
            !phoneRegex.test(line) &&
            line.length < 100
        );

        if (potentialTitles.length > 0) {
            fields.push({
                label: 'Job Title',
                value: potentialTitles[0],
                type: 'custom',
                confidence: 0.7,
                source: 'heuristic'
            });
        }

        return fields;
    }

    /**
     * Extract fields from QR code data
     */
    static _extractFromQR(qrContactData) {
        const fields = [];

        Object.entries(qrContactData).forEach(([key, value]) => {
            if (value && typeof value === 'string' && value.trim().length > 0) {
                fields.push({
                    label: this._normalizeFieldLabel(key),
                    value: value.trim(),
                    type: 'standard',
                    confidence: 0.95, // QR codes are highly reliable
                    source: 'qr_code'
                });
            }
        });

        return fields;
    }

    /**
     * Clean and deduplicate fields
     */
    static cleanAndDeduplicateFields(fields) {
        // Remove empty fields
        const nonEmptyFields = fields.filter(field => 
            field.value && field.value.trim().length > 0
        );

        // Group by normalized label
        const fieldGroups = {};
        nonEmptyFields.forEach(field => {
            const normalizedLabel = this._normalizeFieldLabel(field.label);
            if (!fieldGroups[normalizedLabel]) {
                fieldGroups[normalizedLabel] = [];
            }
            fieldGroups[normalizedLabel].push(field);
        });

        // Keep highest confidence field for each label
        const deduplicatedFields = [];
        Object.entries(fieldGroups).forEach(([label, groupFields]) => {
            groupFields.sort((a, b) => b.confidence - a.confidence);
            const bestField = { ...groupFields[0], label };
            deduplicatedFields.push(bestField);
        });

        return deduplicatedFields;
    }

    /**
     * Validate fields
     */
    static validateFields(fields) {
        return fields.map(field => {
            const validation = this._validateFieldValue(field.label, field.value);

            return {
                ...field,
                isValid: validation.isValid,
                validationErrors: validation.errors,
                confidence: validation.isValid ? field.confidence : field.confidence * 0.6
            };
        });
    }

    /**
     * Validate individual field value
     */
    static _validateFieldValue(label, value) {
        const errors = [];

        switch (label.toLowerCase()) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errors.push('Invalid email format');
                }
                break;

            case 'phone':
                const cleanPhone = value.replace(/[\s\-\(\)\.]/g, '');
                if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                    errors.push('Phone number length invalid');
                }
                if (!/^\+?\d+$/.test(cleanPhone)) {
                    errors.push('Phone contains invalid characters');
                }
                break;

            case 'website':
                try {
                    new URL(value.startsWith('http') ? value : `http://${value}`);
                } catch {
                    errors.push('Invalid website URL');
                }
                break;

            case 'name':
                if (value.length < 2 || value.length > 100) {
                    errors.push('Name length invalid');
                }
                if (/^\d+$/.test(value)) {
                    errors.push('Name cannot be only numbers');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Normalize field labels to standard format
     */
    static _normalizeFieldLabel(label) {
        const normalizedLabel = label.toLowerCase().trim();

        const labelMap = {
            'name': 'Name',
            'full name': 'Name',
            'fullname': 'Name',
            'email': 'Email',
            'email address': 'Email',
            'e-mail': 'Email',
            'phone': 'Phone',
            'phone number': 'Phone',
            'tel': 'Phone',
            'telephone': 'Phone',
            'mobile': 'Phone',
            'company': 'Company',
            'organization': 'Company',
            'org': 'Company',
            'job title': 'Job Title',
            'title': 'Job Title',
            'position': 'Job Title',
            'jobtitle': 'Job Title',
            'website': 'Website',
            'web': 'Website',
            'url': 'Website',
            'site': 'Website',
            'address': 'Address',
            'location': 'Address',
            'linkedin': 'LinkedIn',
            'twitter': 'Twitter',
            'facebook': 'Facebook'
        };

        return labelMap[normalizedLabel] || this._capitalizeFirstLetter(label);
    }

    static _capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }
}