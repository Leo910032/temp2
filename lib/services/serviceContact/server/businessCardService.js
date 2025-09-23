// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

//lib/services/serviceContact/server/businessCardService.js
// Enhanced server-side business card service that properly integrates with the exchange system

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ContactSecurityService } from './contactSecurityService';
import { VectorService } from './vectorService';

export class BusinessCardService {

  /**
   * Process enhanced business card scan with proper integration
   * This method follows the correct data flow and maintains all existing features
   */
  static async processEnhancedScan(profileOwnerId, images, options = {}) {
    const scanStartTime = Date.now();
    const { language = 'en', requestId, isPublicScan = false, metadata = {} } = options;
    
    try {
      console.log(`📇 [${requestId}] Enhanced BusinessCardService: Processing scan for owner: ${profileOwnerId}`);
      console.log(`📇 [${requestId}] Images provided: ${Object.keys(images).join(', ')}`);
      console.log(`📇 [${requestId}] Language: ${language}, Public scan: ${isPublicScan}`);

      // Validate inputs
      if (!profileOwnerId || !images || Object.keys(images).length === 0) {
        throw new Error('Profile owner ID and images are required');
      }

      // Get profile owner's subscription level for proper processing
      const { adminDb } = await import('@/lib/firebaseAdmin');
      const ownerDoc = await adminDb.collection('AccountData').doc(profileOwnerId).get();
      
      if (!ownerDoc.exists) {
        throw new Error('Profile owner not found');
      }

      const ownerData = ownerDoc.data();
      const subscriptionLevel = ownerData.accountType?.toLowerCase() || 'base';

      console.log(`📇 [${requestId}] Profile owner subscription: ${subscriptionLevel}`);

      // Process each side of the business card
      const sideResults = [];
      
      for (const [side, imageBase64] of Object.entries(images)) {
        console.log(`📇 [${requestId}] Processing ${side} side...`);
        
        try {
          const sideResult = await this.processSingleSide(
            imageBase64,
            { side, language, requestId, subscriptionLevel }
          );
          
          sideResults.push({
            side,
            result: sideResult,
            success: true
          });
          
          console.log(`✅ [${requestId}] ${side} side processed successfully`);
          
        } catch (sideError) {
          console.error(`❌ [${requestId}] Failed to process ${side} side:`, sideError);
          sideResults.push({
            side,
            error: sideError.message,
            success: false
          });
        }
      }

      // Merge results from all sides
      const mergedResult = this.mergeMultiSideResults(sideResults, requestId);
      
      // Structure the final result with enhanced metadata
      const finalResult = {
        success: mergedResult.success,
        parsedFields: mergedResult.standardFields || [],
        dynamicFields: mergedResult.dynamicFields || [],
        metadata: {
          ...mergedResult.metadata,
          requestId,
          profileOwnerId,
          subscriptionLevel,
          isPublicScan,
          enhancedProcessing: true,
          scanDuration: Date.now() - scanStartTime,
          sidesProcessed: Object.keys(images),
          language
        }
      };

      console.log(`✅ [${requestId}] Enhanced scan completed:`, {
        success: finalResult.success,
        standardFields: finalResult.parsedFields.length,
        dynamicFields: finalResult.dynamicFields.length,
        duration: `${Date.now() - scanStartTime}ms`
      });

      return finalResult;

    } catch (error) {
      const scanDuration = Date.now() - scanStartTime;
      console.error(`❌ [${requestId}] Enhanced scan failed after ${scanDuration}ms:`, error);
      
      // Return a structured error response
      return {
        success: false,
        error: error.message,
        parsedFields: [],
        dynamicFields: [],
        metadata: {
          requestId,
          profileOwnerId,
          isPublicScan,
          scanDuration,
          errorOccurred: true,
          processingFailed: true
        }
      };
    }
  }

  /**
   * Process a single side of the business card
   */
  static async processSingleSide(imageBase64, options = {}) {
    const { side = 'front', language = 'en', requestId, subscriptionLevel = 'premium' } = options;
    
    try {
      console.log(`🔍 [${requestId}] Processing ${side} side with subscription: ${subscriptionLevel}`);

      // Validate and sanitize image data
      const validatedImageData = this.validateAndSanitizeImageData(imageBase64);
      
      // Perform OCR processing
      const ocrResult = await this.performOCRProcessing(validatedImageData);
      
      // Process QR codes
      const qrResult = await this.processQRCodes(validatedImageData);
      
      // Merge OCR and QR results
      const scanResult = this.mergeScanResults(ocrResult, qrResult);
      
      // Enhanced AI processing with Gemini
      const enhancedResult = await this.enhanceWithGeminiAI(
        scanResult,
        { language, side, subscriptionLevel, requestId }
      );

      // Structure the result for this side
      return this.structureSideResult(enhancedResult, side);

    } catch (error) {
      console.error(`❌ [${requestId}] Error processing ${side} side:`, error);
      throw error;
    }
  }

   /**
   * DIAGNOSTIC: Enhanced AI processing with detailed logging
   */
  static async enhanceWithGeminiAI(scanResult, options = {}) {
    const { language = 'en', side = 'front', subscriptionLevel = 'premium', requestId } = options;
    
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Starting Gemini AI enhancement for ${side} side`);
    console.log(`🤖 [${requestId}] Subscription level: ${subscriptionLevel}`);
    console.log(`🤖 [${requestId}] Language: ${language}`);

    const textToProcess = scanResult.extractedText;
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Text to process length: ${textToProcess?.length || 0}`);
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Text preview: "${textToProcess?.substring(0, 200)}..."`);
    
    if (!textToProcess || textToProcess.trim().length < 10) {
      console.warn(`⚠️ [${requestId}] DIAGNOSTIC: Not enough text for AI processing on ${side} side`);
      const qrFields = scanResult.hasQRCode && scanResult.parsedQRData?.contactData 
        ? this.convertQRDataToFields(scanResult.parsedQRData.contactData, side) 
        : [];
      return { ...scanResult, extractedFields: qrFields, aiProcessed: false, cost: 0 };
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set in environment variables");
      }
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // DIAGNOSTIC: Enhanced prompt with detailed logging
      const enhancedPrompt = this.buildEnhancedPrompt(textToProcess, side, language, subscriptionLevel);
      
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Sending prompt to Gemini...`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Prompt length: ${enhancedPrompt.length}`);

      const result = await model.generateContent(enhancedPrompt);
      const usageMetadata = result.response.usageMetadata;
      const realCost = this.calculateRealCost(usageMetadata);

      const response = await result.response;
      const responseText = response.text();
      
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Raw AI response received:`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Response length: ${responseText.length}`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Full response:\n${responseText}\n--- END RESPONSE ---`);

      // DIAGNOSTIC: Enhanced JSON parsing with detailed logging
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(`❌ [${requestId}] DIAGNOSTIC: AI did not return valid JSON for ${side} side`);
        console.error(`❌ [${requestId}] DIAGNOSTIC: Response was: ${responseText}`);
        throw new Error(`AI did not return valid JSON for ${side} side`);
      }

      const jsonString = jsonMatch[0];
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Extracted JSON string: ${jsonString}`);
      
      let parsedJson;
      try {
        parsedJson = JSON.parse(jsonString);
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Parsed JSON successfully:`, parsedJson);
      } catch (parseError) {
        console.error(`❌ [${requestId}] DIAGNOSTIC: JSON parse error:`, parseError);
        console.error(`❌ [${requestId}] DIAGNOSTIC: Attempted to parse: ${jsonString}`);
        throw new Error(`Failed to parse AI response JSON: ${parseError.message}`);
      }
      
      // DIAGNOSTIC: Enhanced field processing with detailed logging
        console.log(`🤖 [${requestId}] Processing AI extracted fields with enhanced logic...`);
      const { standardFields, dynamicFields } = this.processAIExtractedFields(
        parsedJson, 
        side, 
        subscriptionLevel
      );

      console.log(`🤖 [${requestId}] DIAGNOSTIC: Field processing results:`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Standard fields: ${standardFields.length}`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Dynamic fields: ${dynamicFields.length}`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Standard fields details:`, standardFields);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Dynamic fields details:`, dynamicFields);

      // Add QR code fields if available
      if (scanResult.hasQRCode && scanResult.parsedQRData?.contactData) {
        const qrFields = this.convertQRDataToFields(scanResult.parsedQRData.contactData, side);
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Adding ${qrFields.length} QR fields`);
        standardFields.push(...qrFields.filter(f => !f.isDynamic));
        dynamicFields.push(...qrFields.filter(f => f.isDynamic));
      }

      const finalStandardFields = standardFields;
      const finalDynamicFields = dynamicFields;

      console.log(`🤖 [${requestId}] DIAGNOSTIC: Final field counts:`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Final standard fields: ${finalStandardFields.length}`);
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Final dynamic fields: ${finalDynamicFields.length}`);

      return {
        ...scanResult,
        extractedFields: [...finalStandardFields, ...finalDynamicFields],
        standardFields: finalStandardFields,
        dynamicFields: finalDynamicFields,
        aiProcessed: true,
        aiModel: `gemini-1.5-flash-enhanced-${side}`,
        cost: realCost,
        metadata: {
          ...scanResult.metadata,
          dynamicFieldsCount: finalDynamicFields.length,
          standardFieldsCount: finalStandardFields.length,
          enhancedProcessing: true,
          side,
          subscriptionLevel
        }
      };

    } catch (error) {
      console.error(`❌ [${requestId}] DIAGNOSTIC: Gemini AI processing failed for ${side} side:`, error);
      
      // DIAGNOSTIC: Enhanced fallback processing
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Falling back to basic extraction...`);
      const basicFields = this.extractContactFieldsBasicDiagnostic(scanResult.extractedText, side, requestId);
      
      return {
        ...scanResult,
        extractedFields: basicFields,
        standardFields: basicFields.filter(f => !f.isDynamic),
        dynamicFields: basicFields.filter(f => f.isDynamic),
        aiProcessed: false,
        aiError: error.message,
        cost: 0.005,
        side
      };
    }
  }


   /**
   * DIAGNOSTIC: Enhanced prompt building with detailed logging
   */
  static buildEnhancedPromptDiagnostic(textToProcess, side, language, subscriptionLevel, requestId) {
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Building prompt for subscription: ${subscriptionLevel}`);
    
    const basePrompt = `
      You are an expert business card information extractor analyzing the ${side} side of a business card.
      
      CONTEXT: This is the ${side.toUpperCase()} side of a business card. 
      ${side === 'front' ? 
        'Front sides typically contain: name, job title, company, main contact info (email, phone), and primary website.' : 
        'Back sides often contain: additional contact methods, social media links, secondary websites, certifications, languages spoken, detailed address, QR codes, or company descriptions.'
      }
      
      CRITICAL: You MUST return a valid JSON object with extracted information.
      
      Extract information and return as JSON with these fields:
      - name: person's full name
      - email: email address  
      - phone: phone number
      - company: company name
      - jobTitle: job title or position
      - website: website URL
      - address: physical address
      
      For subscription level "${subscriptionLevel}", also extract:`;

    let enhancedPrompt = basePrompt;

    if (subscriptionLevel === 'premium') {
      enhancedPrompt += `
      - linkedin: LinkedIn profile URL
      - twitter: Twitter handle or URL
      - certification: any certifications mentioned
      - education: educational background
      - languages: languages spoken
      
      EXAMPLE RESPONSE:
      {
        "name": "John Doe",
        "email": "john@company.com",
        "phone": "+1-555-123-4567",
        "company": "Tech Corp",
        "jobTitle": "Software Engineer",
        "website": "https://techcorp.com",
        "linkedin": "linkedin.com/in/johndoe",
        "certification": "AWS Certified"
      }`;
    } else if (['business', 'enterprise'].includes(subscriptionLevel)) {
      enhancedPrompt += `
      - linkedin: LinkedIn profile URL
      - twitter: Twitter handle or URL  
      - instagram: Instagram handle
      - facebook: Facebook page
      - certification: any certifications
      - education: educational background
      - languages: languages spoken
      - yearsExperience: years of experience mentioned
      - specialization: area of specialization
      - skills: key skills mentioned
      
      EXAMPLE RESPONSE:
      {
        "name": "Jane Smith",
        "email": "jane@startup.com", 
        "phone": "+1-555-987-6543",
        "company": "AI Startup Inc",
        "jobTitle": "CTO & Co-Founder",
        "website": "https://aistartup.com",
        "linkedin": "linkedin.com/in/janesmith",
        "twitter": "@janesmith",
        "certification": "Google Cloud Architect",
        "education": "MIT Computer Science",
        "languages": "English, Spanish, Mandarin",
        "yearsExperience": "10+ years in AI/ML",
        "specialization": "Machine Learning & Computer Vision",
        "skills": "Python, TensorFlow, AWS, Leadership"
      }`;
    } else {
      enhancedPrompt += `
      
      EXAMPLE RESPONSE:
      {
        "name": "John Doe",
        "email": "john@company.com",
        "phone": "+1-555-123-4567", 
        "company": "Tech Corp",
        "jobTitle": "Software Engineer",
        "website": "https://techcorp.com"
      }`;
    }

    enhancedPrompt += `
      
      IMPORTANT RULES:
      1. Return ONLY valid JSON - no markdown, no explanations
      2. Use empty string "" for missing fields, not null
      3. Ensure all field values are strings
      4. Extract actual text from the business card, don't make up information
      5. If no information found for a field, use empty string ""
      
      Business card ${side} side text:
      ---
      ${textToProcess}
      ---
      
      JSON Response:`;

    console.log(`🤖 [${requestId}] DIAGNOSTIC: Final prompt created (${enhancedPrompt.length} chars)`);
    return enhancedPrompt;
  }
 /**
   * DIAGNOSTIC: Enhanced AI field processing with detailed logging
   */
  static processAIExtractedFieldsDiagnostic(parsedJson, side, subscriptionLevel, requestId) {
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Processing AI fields for subscription: ${subscriptionLevel}`);
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Raw parsed JSON:`, parsedJson);
    
    const standardFields = [];
    const dynamicFields = [];

    // Standard field mapping
    const standardFieldMap = {
      'name': 'Name',
      'fullname': 'Name', 
      'email': 'Email',
      'phone': 'Phone',
      'telephone': 'Phone',
      'company': 'Company',
      'organization': 'Company',
      'jobtitle': 'Job Title',
      'title': 'Job Title',
      'position': 'Job Title',
      'website': 'Website',
      'url': 'Website',
      'address': 'Address'
    };

    // Extended professional fields (premium+)
    const extendedFieldMap = {
      'linkedin': 'LinkedIn',
      'twitter': 'Twitter',
      'instagram': 'Instagram', 
      'facebook': 'Facebook',
      'certification': 'Certification',
      'education': 'Education',
      'degree': 'Education',
      'languages': 'Languages',
      'skills': 'Skills'
    };

    // Process each field in the parsed JSON
    for (const [key, value] of Object.entries(parsedJson)) {
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Processing field: "${key}" = "${value}"`);
      
      if (!value || typeof value !== 'string' || !value.trim()) {
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Skipping empty field: ${key}`);
        continue;
      }

      const normalizedKey = key.toLowerCase();
      const trimmedValue = value.trim();

      console.log(`🤖 [${requestId}] DIAGNOSTIC: Normalized key: "${normalizedKey}", trimmed value: "${trimmedValue}"`);

      // Check if it's a standard field
      if (standardFieldMap[normalizedKey]) {
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Found standard field: ${normalizedKey} -> ${standardFieldMap[normalizedKey]}`);
        
        const standardField = {
          label: standardFieldMap[normalizedKey],
          value: this.formatFieldValue(standardFieldMap[normalizedKey], trimmedValue),
          type: 'standard',
          category: this.getFieldCategory(standardFieldMap[normalizedKey]),
          confidence: 0.9,
          source: `gemini-ai-${side}`,
          side,
          isDynamic: false
        };
        
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Created standard field:`, standardField);
        standardFields.push(standardField);
        continue;
      }

      // Check if it's an extended field (premium+)
      if (subscriptionLevel !== 'base' && extendedFieldMap[normalizedKey]) {
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Found extended field: ${normalizedKey} -> ${extendedFieldMap[normalizedKey]}`);
        
        const extendedField = {
          label: extendedFieldMap[normalizedKey],
          value: this.formatFieldValue(extendedFieldMap[normalizedKey], trimmedValue),
          type: 'extended',
          category: this.getFieldCategory(extendedFieldMap[normalizedKey]),
          confidence: 0.85,
          source: `gemini-ai-${side}`,
          side,
          isDynamic: false
        };
        
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Created extended field:`, extendedField);
        standardFields.push(extendedField);
        continue;
      }

      // Everything else becomes a dynamic field (business+ only)
      if (['business', 'enterprise'].includes(subscriptionLevel)) {
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Creating dynamic field for: ${normalizedKey}`);
        
        const dynamicLabel = this.createDynamicFieldLabel(key);
        const dynamicCategory = this.inferFieldCategory(key, trimmedValue);
        
        const dynamicField = {
          label: dynamicLabel,
          value: trimmedValue,
          type: 'dynamic',
          category: dynamicCategory,
          confidence: 0.7,
          source: `gemini-ai-${side}`,
          side,
          isDynamic: true
        };
        
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Created dynamic field:`, dynamicField);
        dynamicFields.push(dynamicField);
      } else {
        console.log(`🤖 [${requestId}] DIAGNOSTIC: Skipping dynamic field (subscription ${subscriptionLevel} doesn't support): ${normalizedKey}`);
      }
    }

    console.log(`🤖 [${requestId}] DIAGNOSTIC: Final processing results:`);
    console.log(`🤖 [${requestId}] DIAGNOSTIC: - Standard fields: ${standardFields.length}`);
    console.log(`🤖 [${requestId}] DIAGNOSTIC: - Dynamic fields: ${dynamicFields.length}`);

    return { standardFields, dynamicFields };
  }

  /**
   * DIAGNOSTIC: Enhanced basic field extraction with logging
   */
  static extractContactFieldsBasicDiagnostic(text, side, requestId) {
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Using basic regex extraction fallback`);
    
    const fields = [];
    
    if (!text) {
      console.log(`🤖 [${requestId}] DIAGNOSTIC: No text provided for basic extraction`);
      return fields;
    }
    
    // Basic email extraction
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Found email via regex: ${emailMatch[0]}`);
      fields.push({
        label: 'Email',
        value: emailMatch[0],
        type: 'standard',
        confidence: 0.8,
        source: `basic_regex_${side}`,
        side,
        isDynamic: false
      });
    }
    
    // Basic phone extraction
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      console.log(`🤖 [${requestId}] DIAGNOSTIC: Found phone via regex: ${phoneMatch[0]}`);
      fields.push({
        label: 'Phone',
        value: phoneMatch[0],
        type: 'standard',
        confidence: 0.7,
        source: `basic_regex_${side}`,
        side,
        isDynamic: false
      });
    }
    
    console.log(`🤖 [${requestId}] DIAGNOSTIC: Basic extraction found ${fields.length} fields`);
    return fields;
  }
/**
 * Enhanced buildEnhancedPrompt with better dynamic field detection
 */
static buildEnhancedPrompt(textToProcess, side, language, subscriptionLevel) {
  const basePrompt = `
    You are an expert business card information extractor analyzing the ${side} side of a business card.
    
    CONTEXT: This is the ${side.toUpperCase()} side of a business card. 
    ${side === 'front' ? 
      'Front sides typically contain: name, job title, company, main contact info (email, phone), primary website, and company taglines/slogans.' : 
      'Back sides often contain: company information, taglines, social media links, secondary websites, certifications, languages spoken, detailed address, QR codes, or company descriptions.'
    }
    
    CRITICAL: Extract information into TWO categories:
    
    1. STANDARD FIELDS (always extract these):
    - name, email, phone, company, jobTitle, website, address
    
    2. DYNAMIC FIELDS (subscription: ${subscriptionLevel}):`;

  // Enhanced prompts based on subscription level
  if (subscriptionLevel === 'premium') {
    return basePrompt + `
    - Extract professional fields like: linkedin, twitter, certifications, education, languages
    - Extract company taglines/slogans as "companyTagline"
    - Format as: {"name": "John Doe", "email": "john@company.com", "linkedin": "linkedin.com/in/johndoe", "companyTagline": "Innovating Your Future"}
    
    Business card ${side} side text:
    ---
    ${textToProcess}
    ---`;
  }

  if (['business', 'enterprise'].includes(subscriptionLevel)) {
    return basePrompt + `
    - Extract ALL valuable information including: social media, certifications, skills, experience, education, languages, specializations
    - Extract company taglines, slogans, mottos as "companyTagline" or "companySlogan"
    - Extract company descriptions as "companyDescription"
    - Extract any unique phrases that describe the company or person
    - Create dynamic fields for unique information like "10+ years experience", "Speaks 5 languages", "AI/ML Expert"
    - Look for phrases like "Innovating Your Future", "Leading the Way", "Excellence in Service" and extract as taglines
    
    EXAMPLES of what to look for:
    - Company slogans: "Innovating Your Future" -> "companyTagline": "Innovating Your Future"
    - Company descriptions: "Leading provider of tech solutions" -> "companyDescription": "Leading provider of tech solutions"
    - Professional experience: "10+ years in AI" -> "yearsExperience": "10+ years in AI"
    - Specializations: "AI/ML Expert" -> "specialization": "AI/ML Expert"
    
    Format as: {
      "name": "John Doe", 
      "email": "john@company.com", 
      "company": "TechSolutions Inc",
      "companyTagline": "Innovating Your Future",
      "yearsExperience": "10+ years in AI", 
      "languages": "English, Spanish, French", 
      "specialization": "Machine Learning"
    }
    
    Business card ${side} side text:
    ---
    ${textToProcess}
    ---`;
  }

  // Base level - minimal extraction
  return basePrompt + `
  - Only extract basic professional information
  - Format as: {"name": "John Doe", "email": "john@company.com", "phone": "+1234567890"}
  
  Business card ${side} side text:
  ---
  ${textToProcess}
  ---`;
}

 /**
 * Enhanced processAIExtractedFields with better dynamic field handling
 */
static processAIExtractedFields(parsedJson, side, subscriptionLevel) {
  const standardFields = [];
  const dynamicFields = [];

  // Standard field mapping
  const standardFieldMap = {
    'name': 'Name',
    'fullname': 'Name',
    'email': 'Email',
    'phone': 'Phone',
    'telephone': 'Phone',
    'company': 'Company',
    'organization': 'Company',
    'jobtitle': 'Job Title',
    'title': 'Job Title',
    'position': 'Job Title',
    'website': 'Website',
    'url': 'Website',
    'address': 'Address'
  };

  // Extended professional fields (premium+)
  const extendedFieldMap = {
    'linkedin': 'LinkedIn',
    'twitter': 'Twitter',
    'instagram': 'Instagram',
    'facebook': 'Facebook',
    'certification': 'Certification',
    'education': 'Education',
    'degree': 'Education',
    'languages': 'Languages',
    'skills': 'Skills'
  };

  // ENHANCED: Dynamic field patterns that should be extracted as dynamic fields
  const dynamicFieldPatterns = {
    'companytagline': 'Company Tagline',
    'companyslogan': 'Company Slogan', 
    'tagline': 'Tagline',
    'slogan': 'Slogan',
    'motto': 'Company Motto',
    'companydescription': 'Company Description',
    'description': 'Description',
    'yearsexperience': 'Years of Experience',
    'experience': 'Experience',
    'specialization': 'Specialization',
    'expertise': 'Expertise',
    'skills': 'Skills',
    'certifications': 'Certifications',
    'achievements': 'Achievements'
  };

  console.log(`🤖 [DEBUG] Processing AI fields for subscription: ${subscriptionLevel}`);
  console.log(`🤖 [DEBUG] Raw parsed JSON:`, parsedJson);

  for (const [key, value] of Object.entries(parsedJson)) {
    if (!value || typeof value !== 'string' || !value.trim()) {
      console.log(`🤖 [DEBUG] Skipping empty field: ${key}`);
      continue;
    }

    const normalizedKey = key.toLowerCase();
    const trimmedValue = value.trim();

    console.log(`🤖 [DEBUG] Processing field: "${key}" = "${trimmedValue}"`);
    console.log(`🤖 [DEBUG] Normalized key: "${normalizedKey}", trimmed value: "${trimmedValue}"`);

    // Check if it's a standard field
    if (standardFieldMap[normalizedKey]) {
      console.log(`🤖 [DEBUG] Found standard field: ${normalizedKey} -> ${standardFieldMap[normalizedKey]}`);
      const standardField = {
        label: standardFieldMap[normalizedKey],
        value: this.formatFieldValue(standardFieldMap[normalizedKey], trimmedValue),
        type: 'standard',
        category: this.getFieldCategory(standardFieldMap[normalizedKey]),
        confidence: 0.9,
        source: `gemini-ai-${side}`,
        side,
        isDynamic: false
      };
      console.log(`🤖 [DEBUG] Created standard field:`, standardField);
      standardFields.push(standardField);
      continue;
    }

    // Check if it's an extended field (premium+)
    if (subscriptionLevel !== 'base' && extendedFieldMap[normalizedKey]) {
      console.log(`🤖 [DEBUG] Found extended field: ${normalizedKey} -> ${extendedFieldMap[normalizedKey]}`);
      const extendedField = {
        label: extendedFieldMap[normalizedKey],
        value: this.formatFieldValue(extendedFieldMap[normalizedKey], trimmedValue),
        type: 'extended',
        category: this.getFieldCategory(extendedFieldMap[normalizedKey]),
        confidence: 0.85,
        source: `gemini-ai-${side}`,
        side,
        isDynamic: false
      };
      console.log(`🤖 [DEBUG] Created extended field:`, extendedField);
      standardFields.push(extendedField);
      continue;
    }

    // ENHANCED: Check for dynamic field patterns (business+ only)
    if (['business', 'enterprise'].includes(subscriptionLevel)) {
      // Check if it matches a known dynamic pattern
      let  dynamicLabel = dynamicFieldPatterns[normalizedKey];
      if (dynamicLabel) {
        console.log(`🤖 [DEBUG] Found dynamic pattern field: ${normalizedKey} -> ${dynamicLabel}`);
        const dynamicField = {
          label: dynamicLabel,
          value: trimmedValue,
          type: 'dynamic',
          category: this.inferFieldCategory(key, trimmedValue),
          confidence: 0.8,
          source: `gemini-ai-${side}`,
          side,
          isDynamic: true
        };
        console.log(`🤖 [DEBUG] Created dynamic pattern field:`, dynamicField);
        dynamicFields.push(dynamicField);
        continue;
      }

      // Create generic dynamic field for anything else valuable
      console.log(`🤖 [DEBUG] Creating generic dynamic field for: ${key}`);
       dynamicLabel = this.createDynamicFieldLabel(key);
      const dynamicCategory = this.inferFieldCategory(key, trimmedValue);
      
      const dynamicField = {
        label: dynamicLabel,
        value: trimmedValue,
        type: 'dynamic',
        category: dynamicCategory,
        confidence: 0.7,
        source: `gemini-ai-${side}`,
        side,
        isDynamic: true
      };
      console.log(`🤖 [DEBUG] Created generic dynamic field:`, dynamicField);
      dynamicFields.push(dynamicField);
    } else {
      console.log(`🤖 [DEBUG] Skipping field "${key}" - subscription level "${subscriptionLevel}" doesn't support dynamic fields`);
    }
  }

  console.log(`🤖 [DEBUG] Final processing results:`);
  console.log(`🤖 [DEBUG] - Standard fields: ${standardFields.length}`);
  console.log(`🤖 [DEBUG] - Dynamic fields: ${dynamicFields.length}`);

  return { standardFields, dynamicFields };
}


  /**
   * Merge results from multiple card sides
   */
  static mergeMultiSideResults(sideResults, requestId) {
    console.log(`🔄 [${requestId}] Merging results from ${sideResults.length} side(s)`);

    const allStandardFields = [];
    const allDynamicFields = [];
    let overallSuccess = false;
    
    const metadata = {
      sidesProcessed: sideResults.length,
      successfulSides: sideResults.filter(r => r.success).length,
      hasQRCode: false,
      totalFieldsFound: 0,
      sideDetails: []
    };

    sideResults.forEach(({ side, result, success, error }) => {
      if (success && result) {
        overallSuccess = true;
        
        // Collect standard fields
        if (result.standardFields) {
          allStandardFields.push(...result.standardFields);
        }
        
        // Collect dynamic fields
        if (result.dynamicFields) {
          allDynamicFields.push(...result.dynamicFields);
        }
        
        // Update metadata
        if (result.metadata?.hasQRCode) {
          metadata.hasQRCode = true;
        }
        
        const fieldsFound = (result.standardFields?.length || 0) + (result.dynamicFields?.length || 0);
        metadata.totalFieldsFound += fieldsFound;
        
        metadata.sideDetails.push({
          side,
          success: true,
          standardFields: result.standardFields?.length || 0,
          dynamicFields: result.dynamicFields?.length || 0,
          hasQRCode: result.metadata?.hasQRCode || false
        });
        
      } else {
        metadata.sideDetails.push({
          side,
          success: false,
          error
        });
      }
    });

    // Deduplicate and merge fields intelligently
    const mergedStandardFields = this.deduplicateFields(allStandardFields);
    const mergedDynamicFields = this.deduplicateFields(allDynamicFields);

    console.log(`✅ [${requestId}] Merge completed:`, {
      standardFields: mergedStandardFields.length,
      dynamicFields: mergedDynamicFields.length,
      successfulSides: metadata.successfulSides
    });

    return {
      success: overallSuccess,
      standardFields: mergedStandardFields,
      dynamicFields: mergedDynamicFields,
      metadata
    };
  }

  /**
   * Deduplicate fields intelligently based on label and confidence
   */
  static deduplicateFields(fields) {
    const fieldGroups = new Map();
    
    fields.forEach(field => {
      const key = field.label.toLowerCase();
      
      if (!fieldGroups.has(key)) {
        fieldGroups.set(key, []);
      }
      fieldGroups.get(key).push(field);
    });
    
    const deduplicatedFields = [];
    
    fieldGroups.forEach((groupFields) => {
      // Sort by confidence and whether it's dynamic (prefer non-dynamic)
      groupFields.sort((a, b) => {
        if (a.isDynamic !== b.isDynamic) {
          return a.isDynamic ? 1 : -1;
        }
        return b.confidence - a.confidence;
      });
      
      const bestField = groupFields[0];
      
      // Add alternative values if significantly different
      if (groupFields.length > 1) {
        bestField.alternativeValues = groupFields.slice(1)
          .filter(f => f.value !== bestField.value)
          .map(f => ({
            value: f.value,
            confidence: f.confidence,
            source: f.source,
            side: f.side
          }));
        
        // Track which sides had this field
        bestField.sides = [...new Set(groupFields.map(f => f.side))];
      }
      
      deduplicatedFields.push(bestField);
    });
    
    return deduplicatedFields;
  }

  /**
   * Structure result for a single side
   */
  static structureSideResult(enhancedResult, side) {
    return {
      success: enhancedResult.ocrSuccess || enhancedResult.qrSuccess,
      standardFields: enhancedResult.standardFields || [],
      dynamicFields: enhancedResult.dynamicFields || [],
      metadata: {
        side,
        hasQRCode: enhancedResult.hasQRCode || false,
        aiProcessed: enhancedResult.aiProcessed || false,
        confidence: this.calculateOverallConfidence(enhancedResult.extractedFields || []),
        processingMethod: enhancedResult.aiProcessed ? 'ai_enhanced' : 'basic_ocr'
      }
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Validate and sanitize base64 image data
   */
  static validateAndSanitizeImageData(imageBase64) {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new Error('Invalid image data: must be a base64 string');
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    
    if (!base64Regex.test(cleanBase64)) {
      throw new Error('Invalid base64 format');
    }

    if (cleanBase64.length < 100) {
      throw new Error('Image data too small');
    }

    const estimatedSize = cleanBase64.length * 0.75;
    if (estimatedSize > 15 * 1024 * 1024) {
      throw new Error('Image too large (max 15MB)');
    }

    return cleanBase64;
  }

  /**
 * Enhanced OCR processing to better capture taglines and slogans
 */
static async performOCRProcessing(imageBase64) {
  try {
    const vision = await import('@google-cloud/vision');
    const credentials = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    
    const client = new vision.ImageAnnotatorClient({ 
      projectId: credentials.project_id, 
      credentials 
    });

    // Enhanced request with better text detection
    const request = {
      image: { content: imageBase64 },
      features: [
        { type: 'DOCUMENT_TEXT_DETECTION' },
        { type: 'TEXT_DETECTION' } // Add regular text detection as backup
      ],
      imageContext: {
        languageHints: ["en", "es", "fr", "it", "vi", "zh"],
        // Enhanced text detection parameters
        textDetectionParams: {
          enableTextDetectionConfidenceScore: true
        }
      },
    };

    const [result] = await client.annotateImage(request);
    
    // Combine both text detection methods for better coverage
    let combinedText = result.fullTextAnnotation?.text || '';
    
    // If document text is limited, supplement with individual text annotations
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      const individualTexts = result.textAnnotations
        .slice(1) // Skip the first one which is usually the full text
        .map(annotation => annotation.description)
        .filter(text => text && text.length > 1);
      
      // Look for potential taglines/slogans that might be missed
      const potentialTaglines = individualTexts.filter(text => {
        const lowerText = text.toLowerCase();
        return (
          text.split(' ').length >= 2 && // Multi-word phrases
          text.split(' ').length <= 6 && // Not too long
          !lowerText.includes('@') && // Not email
          !lowerText.match(/^\d+/) && // Not starting with numbers
          !lowerText.includes('www.') // Not website
        );
      });
      
      // Add potential taglines to the main text if they're not already included
      potentialTaglines.forEach(tagline => {
        if (!combinedText.toLowerCase().includes(tagline.toLowerCase())) {
          combinedText += '\n' + tagline;
        }
      });
    }
    
    console.log(`🔍 [OCR] Enhanced text extraction result:`);
    console.log(`🔍 [OCR] - Document text length: ${result.fullTextAnnotation?.text?.length || 0}`);
    console.log(`🔍 [OCR] - Individual annotations: ${result.textAnnotations?.length || 0}`);
    console.log(`🔍 [OCR] - Combined text length: ${combinedText.length}`);
    console.log(`🔍 [OCR] - Final text: "${combinedText}"`);
    
    return {
      success: true,
      text: combinedText,
      textAnnotations: result.textAnnotations || [],
      confidence: this.calculateOCRConfidence(result.textAnnotations)
    };
    
  } catch (error) {
    console.error('Enhanced OCR processing failed:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message
    };
  }
}

  /**
   * Process QR codes using sharp and jsqr
   */
  static async processQRCodes(imageBase64) {
    try {
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default;
      const jsQRModule = await import('jsqr');
      const jsQR = jsQRModule.default;
      
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
        return {
          success: true,
          hasQRCode: true,
          qrData: qrCode.data,
          parsedQRData: this.parseQRData(qrCode.data)
        };
      }

      return { success: true, hasQRCode: false };

    } catch (error) {
      console.error('QR code processing failed:', error);
      return { success: false, hasQRCode: false, error: error.message };
    }
  }

  /**
   * Parse QR code data into structured format
   */
  static parseQRData(qrData) {
    try {
      if (qrData.startsWith('BEGIN:VCARD')) {
        return this.parseVCard(qrData);
      }
      
      if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
        return { type: 'url', url: qrData };
      }
      
      return { type: 'text', data: qrData };
      
    } catch (error) {
      return { type: 'raw', data: qrData };
    }
  }

  /**
   * Parse vCard data from QR code
   */
  static parseVCard(vCardData) {
    const lines = vCardData.split('\n');
    const contactData = {};
    
    lines.forEach(line => {
      if (line.startsWith('FN:')) contactData.name = line.substring(3);
      else if (line.startsWith('EMAIL:')) contactData.email = line.substring(6);
      else if (line.startsWith('TEL:')) contactData.phone = line.substring(4);
      else if (line.startsWith('ORG:')) contactData.company = line.substring(4);
      else if (line.startsWith('TITLE:')) contactData.jobTitle = line.substring(6);
      else if (line.startsWith('URL:')) contactData.website = line.substring(4);
    });
    
    return { type: 'vcard', contactData };
  }

  /**
   * Merge OCR and QR results
   */
  static mergeScanResults(ocrResult, qrResult) {
    return {
      ocrSuccess: ocrResult.success,
      qrSuccess: qrResult.success,
      hasQRCode: qrResult.hasQRCode,
      extractedText: ocrResult.text || '',
      qrData: qrResult.qrData,
      parsedQRData: qrResult.parsedQRData,
      confidence: ocrResult.confidence || 0
    };
  }

  /**
   * Convert QR data to field format
   */
  static convertQRDataToFields(qrContactData, side) {
    const fields = [];
    
    Object.entries(qrContactData).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim().length > 0) {
        fields.push({
          label: this.normalizeFieldLabel(key),
          value: value.trim(),
          type: 'standard',
          confidence: 0.95,
          source: `qr_code_${side}`,
          side,
          isDynamic: false
        });
      }
    });
    
    return fields;
  }

  /**
   * Extract basic contact fields as fallback
   */
  static extractContactFieldsBasic(text, side) {
    const fields = [];
    
    if (!text) return fields;
    
    // Basic email extraction
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      fields.push({
        label: 'Email',
        value: emailMatch[0],
        type: 'standard',
        confidence: 0.8,
        source: `basic_regex_${side}`,
        side,
        isDynamic: false
      });
    }
    
    // Basic phone extraction
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) {
      fields.push({
        label: 'Phone',
        value: phoneMatch[0],
        type: 'standard',
        confidence: 0.7,
        source: `basic_regex_${side}`,
        side,
        isDynamic: false
      });
    }
    
    return fields;
  }

  // ==================== FIELD PROCESSING UTILITIES ====================

  /**
   * Format field values based on field type
   */
  static formatFieldValue(label, value) {
    switch (label.toLowerCase()) {
      case 'email':
        return value.toLowerCase().trim();
      
      case 'phone':
        return value.replace(/[\s\-\(\)\.]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
      
      case 'website':
      case 'linkedin':
      case 'twitter':
        return this.formatWebsiteUrl(value);
      
      case 'name':
      case 'company':
      case 'job title':
        return value.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      
      default:
        return value.trim();
    }
  }

  /**
   * Format website URLs properly
   */
  static formatWebsiteUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    const trimmedUrl = url.trim();
    
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
      return `https://${trimmedUrl}`;
    }
    
    return trimmedUrl;
  }

  /**
   * Get field category for organization
   */
  static getFieldCategory(label) {
    const categoryMap = {
      'Name': 'personal',
      'Email': 'contact',
      'Phone': 'contact',
      'Company': 'professional',
      'Job Title': 'professional',
      'Website': 'contact',
      'Address': 'contact',
      'LinkedIn': 'social',
      'Twitter': 'social',
      'Instagram': 'social',
      'Facebook': 'social',
      'Certification': 'professional',
      'Education': 'professional',
      'Languages': 'personal',
      'Skills': 'professional'
    };
    
    return categoryMap[label] || 'other';
  }

  /**
   * Create readable label for dynamic fields
   */
  static createDynamicFieldLabel(key) {
    const words = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    
    return words.join(' ');
  }

  /**
   * Infer category for dynamic fields
   */
  static inferFieldCategory(key, value) {
    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();

    if (keyLower.includes('social') || valueLower.includes('@') || 
        valueLower.includes('linkedin') || valueLower.includes('twitter')) {
      return 'social';
    }

    if (keyLower.includes('phone') || keyLower.includes('mobile') || 
        valueLower.includes('+') || /\d{3,}/.test(valueLower)) {
      return 'contact';
    }

    if (keyLower.includes('experience') || keyLower.includes('skill') || 
        keyLower.includes('certification') || keyLower.includes('education')) {
      return 'professional';
    }

    if (keyLower.includes('language') || keyLower.includes('hobby')) {
      return 'personal';
    }

    return 'other';
  }

  /**
   * Normalize field labels to standard format
   */
  static normalizeFieldLabel(label) {
    const labelMap = {
      'name': 'Name',
      'full name': 'Name',
      'email': 'Email',
      'phone': 'Phone',
      'tel': 'Phone',
      'company': 'Company',
      'organization': 'Company',
      'job title': 'Job Title',
      'title': 'Job Title',
      'website': 'Website',
      'url': 'Website',
      'address': 'Address'
    };
    
    return labelMap[label.toLowerCase()] || this.capitalizeFirstLetter(label);
  }

  /**
   * Capitalize first letter of string
   */
  static capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }

  /**
   * Calculate OCR confidence from annotations
   */
  static calculateOCRConfidence(textAnnotations) {
    if (!textAnnotations || textAnnotations.length === 0) return 0;
    
    const confidenceScores = textAnnotations
      .filter(annotation => typeof annotation.confidence === 'number')
      .map(annotation => annotation.confidence);
    
    if (confidenceScores.length === 0) return 0.5;
    
    return confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  }

  /**
   * Calculate overall confidence from fields
   */
  static calculateOverallConfidence(fields) {
    const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0);
    
    if (fieldsWithData.length === 0) return 0;
    
    const totalConfidence = fieldsWithData.reduce((sum, field) => sum + field.confidence, 0);
    return Math.round((totalConfidence / fieldsWithData.length) * 100) / 100;
  }

  /**
   * Calculate real cost from Gemini API usage
   */
  static calculateRealCost(usageMetadata) {
    if (!usageMetadata) return 0.001;

    const { promptTokenCount, candidatesTokenCount } = usageMetadata;
    const INPUT_PRICE_PER_MILLION = 0.075;
    const OUTPUT_PRICE_PER_MILLION = 0.30;

    const inputCost = (promptTokenCount / 1000000) * INPUT_PRICE_PER_MILLION;
    const outputCost = (candidatesTokenCount / 1000000) * OUTPUT_PRICE_PER_MILLION;
    
    return inputCost + outputCost;
  }
}