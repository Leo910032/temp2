// lib/services/serviceContact/server/contactValidationService.js
import { 
  CONTACT_VALIDATION,
  CONTACT_STATUS,
  CONTACT_SOURCES,
  CONTACT_FIELD_LABELS
} from '../client/services/constants/contactConstants';
const ALLOWED_IMPORT_FIELDS = ['name', 'email', 'phone', 'company', 'message'];

export class ContactValidationService {

  /**
   * Validate complete contact data
   */
  static validateContactData(contactData) {
    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!contactData.name || contactData.name.trim().length === 0) {
      errors.push('Name is required');
    }

    // Validate individual fields
    Object.keys(CONTACT_VALIDATION).forEach(field => {
      const value = contactData[field];
      const rules = CONTACT_VALIDATION[field];

      if (value !== undefined && value !== null && value !== '') {
        const fieldValidation = this.validateField(field, value, rules);
        
        if (!fieldValidation.isValid) {
          errors.push(...fieldValidation.errors);
        }
        
        if (fieldValidation.warnings) {
          warnings.push(...fieldValidation.warnings);
        }
      } else if (rules.required) {
        errors.push(`${CONTACT_FIELD_LABELS[field] || field} is required`);
      }
    });

    // Validate status
    if (contactData.status && !Object.values(CONTACT_STATUS).includes(contactData.status)) {
      errors.push('Invalid contact status');
    }

    // Validate source
    if (contactData.source && !Object.values(CONTACT_SOURCES).includes(contactData.source)) {
      errors.push('Invalid contact source');
    }

    // Validate location data if provided
    if (contactData.location) {
      const locationValidation = this.validateLocation(contactData.location);
      if (!locationValidation.isValid) {
        errors.push(...locationValidation.errors);
      }
    }

    // Validate details array if provided
    if (contactData.details) {
      const detailsValidation = this.validateDetailsArray(contactData.details);
      if (!detailsValidation.isValid) {
        errors.push(...detailsValidation.errors);
      }
    }

    // Validate tags array if provided
    if (contactData.tags) {
      const tagsValidation = this.validateTagsArray(contactData.tags);
      if (!tagsValidation.isValid) {
        errors.push(...tagsValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fieldValidations: this.getFieldValidationSummary(contactData)
    };
  }

  /**
   * ✅ NEW: A dedicated method to sanitize and validate a single row from an import file.
   * This is the core of the new strict import logic.
   */
  static sanitizeAndValidateImportRow(rowData) {
    const sanitizedContact = {};
    const unknownFields = [];

    // 1. Filter for allowed fields and identify any extra columns.
    for (const key in rowData) {
      // Normalize the header name (e.g., " Full Name " becomes "name")
      const lowerKey = key.trim().toLowerCase().replace('full name', 'name'); 
      if (ALLOWED_IMPORT_FIELDS.includes(lowerKey)) {
        sanitizedContact[lowerKey] = rowData[key] ? String(rowData[key]).trim() : '';
      } else {
        unknownFields.push(key);
      }
    }

    // 2. Perform standard validation on the sanitized data using your existing rules.
    const validationResult = this.validateContactData(sanitizedContact);

    // 3. Add a specific warning if unknown columns were present and ignored.
    if (unknownFields.length > 0) {
      validationResult.warnings.push(`Ignored unknown columns: ${unknownFields.join(', ')}`);
    }
    
    // 4. Enforce that the required fields are present and not empty.
    // This overrides the general validation to be stricter for imports.
    if (!sanitizedContact.name) {
      validationResult.isValid = false;
      validationResult.errors.push('The "name" column is required and cannot be empty.');
    }
    if (!sanitizedContact.email) {
      validationResult.isValid = false;
      validationResult.errors.push('The "email" column is required and cannot be empty.');
    }
    
    // De-duplicate any overlapping error messages.
    validationResult.errors = [...new Set(validationResult.errors)];

    return {
      sanitizedContact,
      validationResult,
    };
  }

  /**
   * Validate individual field
   */
  static validateField(fieldName, value, rules) {
    const errors = [];
    const warnings = [];

    // Check required
    if (rules.required && (!value || value.toString().trim().length === 0)) {
      errors.push(`${CONTACT_FIELD_LABELS[fieldName] || fieldName} is required`);
      return { isValid: false, errors, warnings };
    }

    // If no value provided and not required, skip validation
    if (!value || value.toString().trim().length === 0) {
      return { isValid: true, errors, warnings };
    }

    const stringValue = value.toString();

    // Check minimum length
    if (rules.minLength && stringValue.length < rules.minLength) {
      errors.push(`${CONTACT_FIELD_LABELS[fieldName] || fieldName} must be at least ${rules.minLength} characters`);
    }

    // Check maximum length
    if (rules.maxLength && stringValue.length > rules.maxLength) {
      errors.push(`${CONTACT_FIELD_LABELS[fieldName] || fieldName} must be less than ${rules.maxLength} characters`);
    }

    // Check pattern matching
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      switch (fieldName) {
        case 'email':
          errors.push('Please enter a valid email address');
          break;
        case 'phone':
          errors.push('Please enter a valid phone number');
          break;
        case 'website':
          errors.push('Please enter a valid website URL (must start with http:// or https://)');
          break;
        default:
          errors.push(`${CONTACT_FIELD_LABELS[fieldName] || fieldName} format is invalid`);
      }
    }

    // Field-specific validations
    switch (fieldName) {
      case 'email':
        const emailValidation = this.validateEmail(stringValue);
        if (!emailValidation.isValid) {
          errors.push(...emailValidation.errors);
        }
        if (emailValidation.warnings) {
          warnings.push(...emailValidation.warnings);
        }
        break;

      case 'phone':
        const phoneValidation = this.validatePhone(stringValue);
        if (!phoneValidation.isValid) {
          errors.push(...phoneValidation.errors);
        }
        if (phoneValidation.warnings) {
          warnings.push(...phoneValidation.warnings);
        }
        break;

      case 'website':
        const websiteValidation = this.validateWebsite(stringValue);
        if (!websiteValidation.isValid) {
          errors.push(...websiteValidation.errors);
        }
        break;

      case 'name':
        const nameValidation = this.validateName(stringValue);
        if (!nameValidation.isValid) {
          errors.push(...nameValidation.errors);
        }
        if (nameValidation.warnings) {
          warnings.push(...nameValidation.warnings);
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate email address
   */
  static validateEmail(email) {
    const errors = [];
    const warnings = [];

    if (!email || typeof email !== 'string') {
      errors.push('Email must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Invalid email format');
      return { isValid: false, errors, warnings };
    }

    // Check for common issues
    if (trimmedEmail.includes('..')) {
      errors.push('Email cannot contain consecutive dots');
    }

    if (trimmedEmail.startsWith('.') || trimmedEmail.endsWith('.')) {
      errors.push('Email cannot start or end with a dot');
    }

    // Check for suspicious patterns
    if (trimmedEmail.includes('test') || trimmedEmail.includes('example')) {
      warnings.push('This appears to be a test email address');
    }

    // Check domain length
    const domain = trimmedEmail.split('@')[1];
    if (domain && domain.length > 253) {
      errors.push('Email domain is too long');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate phone number
   */
  static validatePhone(phone) {
    const errors = [];
    const warnings = [];

    if (!phone || typeof phone !== 'string') {
      errors.push('Phone number must be a string');
      return { isValid: false, errors, warnings };
    }

    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');

    // Check if it contains only valid characters
    if (!/^[\+\d]{7,}$/.test(cleanPhone)) {
      errors.push('Phone number contains invalid characters');
    }

    // Check minimum length
    if (cleanPhone.length < 7) {
      errors.push('Phone number is too short');
    }

    // Check maximum length
    if (cleanPhone.length > 15) {
      errors.push('Phone number is too long');
    }

    // Check for suspicious patterns
    if (/^(\d)\1{6,}$/.test(cleanPhone)) {
      warnings.push('This appears to be a fake phone number (repeated digits)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate website URL
   */
  static validateWebsite(website) {
    const errors = [];

    if (!website || typeof website !== 'string') {
      errors.push('Website must be a string');
      return { isValid: false, errors };
    }

    const trimmedWebsite = website.trim().toLowerCase();

    // Must start with http:// or https://
    if (!trimmedWebsite.startsWith('http://') && !trimmedWebsite.startsWith('https://')) {
      errors.push('Website URL must start with http:// or https://');
      return { isValid: false, errors };
    }

    try {
      const url = new URL(trimmedWebsite);
      
      // Check for valid hostname
      if (!url.hostname || url.hostname.length === 0) {
        errors.push('Website URL must have a valid hostname');
      }

      // Check for at least one dot in hostname
      if (!url.hostname.includes('.')) {
        errors.push('Website URL must have a valid domain');
      }

    } catch (error) {
      errors.push('Invalid website URL format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate name
   */
  static validateName(name) {
    const errors = [];
    const warnings = [];

    if (!name || typeof name !== 'string') {
      errors.push('Name must be a string');
      return { isValid: false, errors, warnings };
    }

    const trimmedName = name.trim();

    // Check for suspicious patterns
    if (/^\d+$/.test(trimmedName)) {
      warnings.push('Name appears to be only numbers');
    }

    if (trimmedName.toLowerCase().includes('test')) {
      warnings.push('This appears to be a test name');
    }

    // Check for minimum meaningful content
    if (trimmedName.length === 1) {
      warnings.push('Name is very short');
    }

    // Check for excessive special characters
    const specialCharCount = (trimmedName.match(/[^a-zA-Z0-9\s\-\.\']/g) || []).length;
    if (specialCharCount > trimmedName.length * 0.3) {
      warnings.push('Name contains many special characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate location object
   */
  static validateLocation(location) {
    const errors = [];

    if (!location || typeof location !== 'object') {
      errors.push('Location must be an object');
      return { isValid: false, errors };
    }

    // Validate latitude
    if (location.latitude !== undefined) {
      if (typeof location.latitude !== 'number') {
        errors.push('Latitude must be a number');
      } else if (location.latitude < -90 || location.latitude > 90) {
        errors.push('Latitude must be between -90 and 90');
      }
    }

    // Validate longitude
    if (location.longitude !== undefined) {
      if (typeof location.longitude !== 'number') {
        errors.push('Longitude must be a number');
      } else if (location.longitude < -180 || location.longitude > 180) {
        errors.push('Longitude must be between -180 and 180');
      }
    }

    // Validate accuracy
    if (location.accuracy !== undefined) {
      if (typeof location.accuracy !== 'number' || location.accuracy < 0) {
        errors.push('Accuracy must be a positive number');
      }
    }

    // Validate address
    if (location.address !== undefined) {
      if (typeof location.address !== 'string') {
        errors.push('Address must be a string');
      } else if (location.address.length > 500) {
        errors.push('Address is too long');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate details array
   */
  static validateDetailsArray(details) {
    const errors = [];

    if (!Array.isArray(details)) {
      errors.push('Details must be an array');
      return { isValid: false, errors };
    }

    if (details.length > 50) {
      errors.push('Too many detail items (maximum 50)');
    }

    details.forEach((detail, index) => {
      if (!detail || typeof detail !== 'object') {
        errors.push(`Detail item ${index + 1} must be an object`);
        return;
      }

      if (!detail.label || typeof detail.label !== 'string') {
        errors.push(`Detail item ${index + 1} must have a label`);
      } else if (detail.label.length > 100) {
        errors.push(`Detail item ${index + 1} label is too long`);
      }

      if (!detail.value || typeof detail.value !== 'string') {
        errors.push(`Detail item ${index + 1} must have a value`);
      } else if (detail.value.length > 500) {
        errors.push(`Detail item ${index + 1} value is too long`);
      }

      if (detail.type && typeof detail.type !== 'string') {
        errors.push(`Detail item ${index + 1} type must be a string`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate tags array
   */
  static validateTagsArray(tags) {
    const errors = [];

    if (!Array.isArray(tags)) {
      errors.push('Tags must be an array');
      return { isValid: false, errors };
    }

    if (tags.length > 20) {
      errors.push('Too many tags (maximum 20)');
    }

    tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        errors.push(`Tag ${index + 1} must be a string`);
      } else if (tag.length === 0) {
        errors.push(`Tag ${index + 1} cannot be empty`);
      } else if (tag.length > 50) {
        errors.push(`Tag ${index + 1} is too long (maximum 50 characters)`);
      }
    });

    // Check for duplicate tags
    const uniqueTags = [...new Set(tags)];
    if (uniqueTags.length !== tags.length) {
      errors.push('Duplicate tags are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get field validation summary
   */
  static getFieldValidationSummary(contactData) {
    const summary = {};

    Object.keys(CONTACT_VALIDATION).forEach(field => {
      const value = contactData[field];
      const rules = CONTACT_VALIDATION[field];

      if (value !== undefined && value !== null && value !== '') {
        const validation = this.validateField(field, value, rules);
        summary[field] = {
          hasValue: true,
          isValid: validation.isValid,
          errorCount: validation.errors.length,
          warningCount: validation.warnings ? validation.warnings.length : 0
        };
      } else {
        summary[field] = {
          hasValue: false,
          isValid: !rules.required,
          errorCount: rules.required ? 1 : 0,
          warningCount: 0
        };
      }
    });

    return summary;
  }

  /**
   * Suggest corrections for common validation errors
   */
  static suggestCorrections(contactData, validationResult) {
    const suggestions = [];

    if (!validationResult.isValid) {
      validationResult.errors.forEach(error => {
        if (error.includes('email')) {
          suggestions.push({
            field: 'email',
            issue: error,
            suggestion: 'Please check the email format. Example: user@domain.com'
          });
        } else if (error.includes('phone')) {
          suggestions.push({
            field: 'phone',
            issue: error,
            suggestion: 'Please enter a valid phone number with country code if international. Example: +1-555-123-4567'
          });
        } else if (error.includes('website')) {
          suggestions.push({
            field: 'website',
            issue: error,
            suggestion: 'Website URL must start with http:// or https://. Example: https://www.example.com'
          });
        } else if (error.includes('Name')) {
          suggestions.push({
            field: 'name',
            issue: error,
            suggestion: 'Please enter the contact\'s full name'
          });
        }
      });
    }

    return suggestions;
  }

  /**
   * Validate bulk contact data (for imports)
   */
  static validateBulkContactData(contactsArray) {
    const results = {
      valid: [],
      invalid: [],
      warnings: [],
      summary: {
        total: contactsArray.length,
        validCount: 0,
        invalidCount: 0,
        warningCount: 0
      }
    };

    contactsArray.forEach((contact, index) => {
      const validation = this.validateContactData(contact);
      
      if (validation.isValid) {
        results.valid.push({
          index,
          contact,
          warnings: validation.warnings
        });
        results.summary.validCount++;
      } else {
        results.invalid.push({
          index,
          contact,
          errors: validation.errors,
          warnings: validation.warnings
        });
        results.summary.invalidCount++;
      }

      if (validation.warnings && validation.warnings.length > 0) {
        results.summary.warningCount++;
      }
    });

    return results;
  }
}