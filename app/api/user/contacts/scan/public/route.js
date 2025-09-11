// app/api/user/contacts/scan/public/route.js
import { NextRequest, NextResponse } from 'next/server';
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { adminDb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * PUBLIC business card scanner endpoint for exchange forms
 * Uses secure tokens to prevent abuse and tracks costs to profile owner
 */
/**
 * PUBLIC business card scanner endpoint - Enhanced with dynamic field detection
 */
// app/api/user/contacts/scan/public/route.js

// ... (your imports remain the same) ...

/**
 * PUBLIC business card scanner endpoint - Enhanced for single or double-sided scans
 * Uses a single secure token for the entire transaction.
 */
export async function POST(request) {
  const requestId = `pub_scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  
  try {
    console.log(`📇 [${requestId}] Enhanced public business card scan request received`);

    // 1-4. [Origin, Rate Limit, Token validation remains the same]
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_BASE_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Invalid origin' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
    await checkPublicScanRateLimit(ip);

    // --- KEY CHANGE: Accepting an `images` object instead of a single `imageBase64` string ---
    const body = await request.json();
    const { 
        images, // CHANGED: Expects an object like { front: "base64...", back: "base64..." }
        scanToken, 
        language = 'en',
    } = body;

    console.log(`[${requestId}] Language received: '${language}'`);
    console.log(`[${requestId}] Processing images for side(s): ${Object.keys(images || {}).join(', ')}`);

    if (!images || (!images.front && !images.back)) {
      return new Response(JSON.stringify({ 
        error: 'At least one image (front or back) is required in the images object.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!scanToken) {
      return new Response(JSON.stringify({ 
        error: 'Image data and scan token required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tokenData = await verifyPublicScanToken(scanToken);
    if (!tokenData) {
      return new Response(JSON.stringify({ 
        error: 'Invalid or expired scan token' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const { profileOwnerId, profileOwnerName } = tokenData;

    // 5. [Cost check remains the same]
    const costCheck = await CostTrackingService.canAffordOperation(
      profileOwnerId, 
      0.003 * (Object.keys(images).length), // Estimate cost based on number of images
      1
    );
    if (!costCheck.canAfford) {
      return new Response(JSON.stringify({ 
        error: 'Profile owner has insufficient AI budget',
        code: 'BUDGET_EXCEEDED'
      }), { 
        status: 402,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- NEW LOGIC: Process all provided images concurrently ---
    const scanStartTime = Date.now();
    const scanPromises = [];
    const sidesToScan = [];

    if (images.front) {
        sidesToScan.push('front');
        scanPromises.push(processEnhancedBusinessCardScan(
            profileOwnerId,
            images.front,
            { isPublicScan: true, requestId, language, side: 'front' }
        ));
    }
    if (images.back) {
        sidesToScan.push('back');
        scanPromises.push(processEnhancedBusinessCardScan(
            profileOwnerId,
            images.back,
            { isPublicScan: true, requestId, language, side: 'back' }
        ));
    }
    
    // Wait for all scans to complete
    const individualScanResults = await Promise.all(scanPromises);

    // Merge the results from all sides into a single, clean list of fields
    const mergedResult = mergeServerSideResults(individualScanResults);
    const scanDuration = Date.now() - scanStartTime;

    // 7. [Generate personalized message based on the merged data]
    let personalizedMessage = null;
    if (mergedResult.success && mergedResult.parsedFields.length > 0) {
      const clientName = extractNameFromFields(mergedResult.parsedFields);
      if (clientName) {
        personalizedMessage = await generatePersonalizedMessage(clientName, profileOwnerName, language);
      }
    }

    // 8. [Calculate and record cost for the entire operation]
    const actualCost = calculateScanCost(mergedResult, scanDuration);
    await CostTrackingService.recordSeparatedUsage(
      profileOwnerId,
      actualCost,
      'gemini-1.5-flash',
      'public_card_scan_enhanced',
      {
          requestId,
          scanDuration,
          fieldsDetected: mergedResult.parsedFields?.length || 0,
          dynamicFields: mergedResult.metadata?.dynamicFieldsCount || 0,
          hasQRCode: mergedResult.metadata?.hasQRCode || false,
          clientName: extractNameFromFields(mergedResult.parsedFields) || 'unknown',
          // UPDATED: Log which sides were processed
          sidesScanned: sidesToScan,
          scanMode: sidesToScan.length > 1 ? 'multi_side_combined' : sidesToScan[0] || 'single_side'
      },
      'api_call'
    );
    
    // --- KEY CHANGE: Mark the token as used ONLY ONCE after all processing is complete ---
    await markTokenAsUsed(scanToken);

    console.log(`✅ [${requestId}] Enhanced public scan completed for ${sidesToScan.join(' & ')} in ${scanDuration}ms`);

    // Return the single, merged response to the client
    return new Response(JSON.stringify({
        success: true,
        parsedFields: mergedResult.parsedFields || [],
        personalizedMessage,
        metadata: {
            ...mergedResult.metadata,
            scanDuration: `${scanDuration}ms`,
            sidesProcessed: sidesToScan,
            enhancedProcessing: true
        }
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Enhanced public scan error:`, error);
    // [Error handling logic remains the same]
    let statusCode = 500;
    let errorCode = 'SCAN_FAILED';
    if (error.message?.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message?.includes('budget')) {
      statusCode = 402;
      errorCode = 'BUDGET_EXCEEDED';
    } else if (error.message?.includes('Invalid')) {
      statusCode = 400;
      errorCode = 'INVALID_REQUEST';
    }
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to process business card',
      code: errorCode,
      requestId
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
/**
 * Enhanced business card processing with dynamic field detection
 */

// app/api/user/contacts/scan/public/route.js

// ... (after the POST function) ...

/**
 * Merges scan results from multiple card sides on the server.
 * @param {Array<Object>} results - An array of scan result objects from processEnhancedBusinessCardScan.
 * @returns {Object} A single, merged result object.
 */
function mergeServerSideResults(results) {
    const allFields = [];
    let overallSuccess = false;
    let combinedMetadata = {
        hasQRCode: false,
        dynamicFieldsCount: 0,
        fieldsCount: 0,
    };

    results.forEach(result => {
        if (result.success) {
            overallSuccess = true;
            if (result.parsedFields) {
                // The 'side' property is already added by processEnhancedBusinessCardScan
                allFields.push(...result.parsedFields);
            }
            // Combine metadata
            if (result.metadata?.hasQRCode) combinedMetadata.hasQRCode = true;
            if (result.metadata?.dynamicFieldsCount) {
              combinedMetadata.dynamicFieldsCount += result.metadata.dynamicFieldsCount;
            }
        }
    });

    // Use your existing function to clean up and remove duplicates
    const mergedFields = cleanAndDeduplicateEnhancedFields(allFields);

    combinedMetadata.fieldsCount = mergedFields.length;
    
    return {
        success: overallSuccess,
        parsedFields: mergedFields,
        metadata: combinedMetadata
    };
}

// ... (rest of your helper functions like processEnhancedBusinessCardScan, etc.)
async function processEnhancedBusinessCardScan(userId, imageBase64, options = {}) {
    try {
        const { side = 'front', isPublicScan = false } = options;
        console.log(`📇 Enhanced BusinessCardService: Processing ${side} side with dynamic fields`);

        // Basic OCR and QR processing (existing code)
        const validatedImageData = validateAndSanitizeImageData(imageBase64);
        const ocrResult = await performOCRProcessing(validatedImageData);
        const qrResult = await processQRCodes(validatedImageData);
        const scanResult = mergeScanResults(ocrResult, qrResult);
        
        // Enhanced AI processing with dynamic fields and side context
        const enhancedResult = await enhanceWithEnhancedGeminiAI(scanResult, options.language, side);

        // Structure the final result with side information
        const finalResult = structureEnhancedScanResult(enhancedResult, side);

        console.log(`✅ Enhanced BusinessCardService: ${side} side scan completed successfully`);
        return finalResult;

    } catch (error) {
        console.error(`❌ Enhanced BusinessCardService: Error processing ${options.side || 'unknown'} side:`, error);
        return createFallbackResult(error.message);
    }
}


// Helper functions

async function checkPublicScanRateLimit(ip, maxScans = 200, windowMinutes = 60) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const cacheKey = `public_scan_rate_${ip}`;

  const rateLimitDoc = await adminDb.collection('RateLimits').doc(cacheKey).get();
  
  let scans = [];
  if (rateLimitDoc.exists) {
    scans = rateLimitDoc.data().scans || [];
  }

  // Remove old scans
  scans = scans.filter(timestamp => now - timestamp < windowMs);

  if (scans.length >= maxScans) {
    throw new Error(`Public scan rate limit exceeded. Max ${maxScans} scans per ${windowMinutes} minutes.`);
  }

  // Record this scan
  scans.push(now);
  await adminDb.collection('RateLimits').doc(cacheKey).set({
    scans,
    lastUpdated: new Date().toISOString(),
    type: 'public_scan'
  });
}
/**
 * Enhanced Gemini AI processing with dynamic field detection
 */
// Update the AI prompt to be aware of card sides:
async function enhanceWithEnhancedGeminiAI(scanResult, language = 'en', side = 'front') {
    console.log(`🤖 Enhancing ${side} side with advanced Gemini AI processing...`);

    const textToProcess = scanResult.extractedText;
    console.log(`--- TEXT FROM ${side.toUpperCase()} SIDE SENT TO ENHANCED GEMINI: ---\n${textToProcess}\n---------------------------`);

    if (!textToProcess || textToProcess.trim().length < 10) {
        console.warn(`⚠️ Not enough text for enhanced AI processing on ${side} side.`);
        const qrFields = scanResult.hasQRCode && scanResult.parsedQRData?.contactData 
            ? convertQRDataToFields(scanResult.parsedQRData.contactData) 
            : [];
        return { ...scanResult, extractedFields: qrFields, aiProcessed: false, cost: 0 };
    }

    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables.");
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Enhanced prompt with side awareness
        const enhancedPrompt = `
            You are an expert business card information extractor analyzing the ${side} side of a business card.
            
            CONTEXT: This is the ${side.toUpperCase()} side of a business card. 
            ${side === 'front' ? 
                'Front sides typically contain: name, job title, company, main contact info (email, phone), and primary website.' : 
                'Back sides often contain: additional contact methods, social media links, secondary websites, certifications, languages spoken, detailed address, QR codes, or company descriptions.'
            }
            
            Your task is to analyze the raw text and identify ALL useful information, 
            including both standard fields and any unique information that might be valuable.

            CRITICAL INSTRUCTIONS:
            1. Detect standard fields: name, email, phone, company, jobTitle, website, address
            2. Detect additional professional fields: tagline, experience, education, certifications, languages, skills
            3. Detect social/contact fields: linkedin, twitter, instagram, facebook, whatsapp, telegram
            4. For ANY other valuable information that doesn't fit standard categories, create dynamic fields with descriptive names
            5. Clean and normalize all data (remove extra spaces, format phone numbers, fix case issues)
            6. For websites/social media, include the full URL when possible
            7. Pay special attention to ${side === 'back' ? 'social media links, additional contact methods, and supplementary information' : 'primary contact information and professional details'}

            DYNAMIC FIELD EXAMPLES:
            - If you see "10+ years in marketing" → create field "yearsExperience": "10+ years in marketing"
            - If you see "MBA, Harvard Business School" → create field "education": "MBA, Harvard Business School"  
            - If you see "Certified PMP" → create field "certification": "Certified PMP"
            - If you see "Speaks: English, Spanish, French" → create field "languages": "English, Spanish, French"
            - If you see "Specializes in AI/ML" → create field "specialization": "AI/ML"

            FORMAT: Return ONLY a valid JSON object. Do not include markdown formatting or explanations.

            Business card ${side} side text:
            ---
            ${textToProcess}
            ---
        `;

        const result = await model.generateContent(enhancedPrompt);
        const usageMetadata = result.response.usageMetadata;
        const realCost = calculateRealCost(usageMetadata);

        const response = await result.response;
        const responseText = response.text();
        
        console.log(`--- ENHANCED AI RESPONSE FOR ${side.toUpperCase()} SIDE: ---\n${responseText}\n-------------------------`);

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error(`Enhanced AI did not return a valid JSON object for ${side} side.`);
        }

        const jsonString = jsonMatch[0];
        const parsedJson = JSON.parse(jsonString);

        let extractedFields = [];
        let dynamicFieldsCount = 0;
        const fieldTypes = new Set();

        // Process all detected fields with side context
        for (const [key, value] of Object.entries(parsedJson)) {
            if (value && typeof value === 'string' && value.trim().length > 0) {
                const fieldInfo = categorizeField(key, value.trim());
                
                extractedFields.push({
                    label: fieldInfo.label,
                    value: fieldInfo.value,
                    type: fieldInfo.type,
                    category: fieldInfo.category,
                    confidence: fieldInfo.confidence,
                    source: `enhanced-gemini-ai-${side}`, // Include side in source
                    isDynamic: fieldInfo.isDynamic,
                    side: side // NEW: Track which side this field came from
                });

                if (fieldInfo.isDynamic) {
                    dynamicFieldsCount++;
                }
                
                fieldTypes.add(fieldInfo.category);
            }
        }
        
        // Add QR code fields if available
        if (scanResult.hasQRCode && scanResult.parsedQRData?.contactData) {
            const qrFields = convertQRDataToFields(scanResult.parsedQRData.contactData);
            // Add side information to QR fields
            qrFields.forEach(field => {
                field.side = side;
                field.source = `qr_code_${side}`;
            });
            extractedFields.push(...qrFields);
        }

        const cleanedFields = cleanAndDeduplicateEnhancedFields(extractedFields);
        const scoredFields = scoreAndValidateEnhancedFields(cleanedFields);

        return {
            ...scanResult,
            extractedFields: scoredFields,
            aiProcessed: true,
            aiModel: `gemini-1.5-flash-enhanced-${side}`,
            cost: realCost,
            metadata: {
                ...scanResult.metadata,
                dynamicFieldsCount,
                fieldTypes: Array.from(fieldTypes),
                enhancedProcessing: true,
                side: side // Include side in metadata
            }
        };

    } catch (error) {
        console.error(`❌ Enhanced Gemini AI processing failed for ${side} side:`, error);
        const basicFields = extractContactFieldsBasic(scanResult.extractedText);
        // Add side information to basic fields
        basicFields.forEach(field => {
            field.side = side;
            field.source = `basic_regex_${side}`;
        });
        
        return {
            ...scanResult,
            extractedFields: basicFields,
            aiProcessed: false,
            aiError: error.message,
            cost: 0.005,
            side: side
        };
    }
}

async function verifyPublicScanToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if token is for public scanning
    if (decoded.purpose !== 'public_scan') {
      return null;
    }

    // Check if token has expired
    if (Date.now() > decoded.expires) {
      return null;
    }

    // Check if token has been used (optional nonce check)
    const tokenDoc = await adminDb.collection('ScanTokens').doc(decoded.tokenId).get();
    if (tokenDoc.exists && tokenDoc.data().used) {
      return null;
    }

    return {
      profileOwnerId: decoded.profileOwnerId,
      profileOwnerName: decoded.profileOwnerName,
      tokenId: decoded.tokenId
    };

  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

async function markTokenAsUsed(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.tokenId) {
      await adminDb.collection('ScanTokens').doc(decoded.tokenId).set({
        used: true,
        usedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Failed to mark token as used:', error);
  }
}

function extractNameFromFields(parsedFields) {
  const nameField = parsedFields.find(field => 
    field.label.toLowerCase().includes('name') && field.value.trim()
  );
  return nameField?.value.trim() || null;
}

// app/api/user/contacts/scan/public/route.js

// ... (all code before this function is correct) ...

async function generatePersonalizedMessage(clientName, profileOwnerName, language = 'en') {
  try {
     if (!process.env.GEMINI_API_KEY) {
      // Fallback returns the NEW structured object
      return {
        greeting: `Great connecting, ${clientName}!`,
        ctaText: "You should get your own at tapit.fr.",
        url: "https://tapit.fr",
        signature: `- ${profileOwnerName}`
      };
    }

      // Enhanced language mapping with more languages
    const languageMap = {
      en: 'English',
      es: 'Spanish',
      fr: 'French', 
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      hi: 'Hindi',
      ru: 'Russian',
      nl: 'Dutch',
      sv: 'Swedish',
      no: 'Norwegian',
      da: 'Danish',
      fi: 'Finnish',
      pl: 'Polish',
      tr: 'Turkish',
      th: 'Thai',
      vi: 'Vietnamese'
    };

    const languageName = languageMap[language.toLowerCase()] || 'English';
    console.log(`🌍 Generating personalized message in ${languageName} for ${clientName} from ${profileOwnerName}`);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Using a systemInstruction is more robust for setting rules
     const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: `You are a savvy networking assistant for a digital business card company. Your job is to write a short, memorable greeting after a business card exchange. This greeting should naturally lead into a call-to-action that will be added later.

      TONE: Clever, friendly, and professional.

      RULES:
      1. Your entire response MUST be in the ${languageName} language.
      2. The message must be a short greeting, under 20 words.
      3. Do NOT include the URL "tapit.fr" or any call-to-action. Your only job is the opening line.
      4. Do NOT include quotation marks, explanations, or a signature.`
    });

    const prompt = `Write a short, fun, and professional greeting in ${languageName} from "${profileOwnerName}" to welcome "${clientName}".
    This message should feel complete on its own, but also set the stage for an invitation to get their own digital card.

    Example ideas in English (for tone only, do not copy):
    - "Great connecting, ${clientName}! I've just saved your details the modern way."
    - "Pleasure to meet you, ${clientName}! Your card has been successfully digitized."
    - "Awesome meeting you, ${clientName}! Let's make networking easier."

    Now, generate a new, original greeting in ${languageName}.`

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let messageText = response.text().trim().replace(/^["']|["']$/g, '');

    // --- CONSTRUCT THE FINAL OBJECT ---
    const ctaTextMap = {
        fr: "Créez la vôtre sur tapit.fr.",
        es: "Consigue la tuya en tapit.fr.",
        de: "Holen Sie sich Ihre eigene auf tapit.fr.",
        en: "Get your own at tapit.fr."
    }

    const personalizedObject = {
        greeting: messageText,
        ctaText: ctaTextMap[language.toLowerCase()] || ctaTextMap.en,
        url: "https://tapit.fr",
        signature: `- ${profileOwnerName}`
    };

    console.log(`✅ Generated CTA message object:`, personalizedObject);
    return personalizedObject;

  } catch (error) {
    console.error('Failed to generate personalized CTA message:', error);
    // Fallback also returns the structured object
    return {
      greeting: `Thanks for connecting, ${clientName}!`,
      ctaText: "Get your own digital card at tapit.fr.",
      url: "https://tapit.fr",
      signature: `- ${profileOwnerName}`
    };
  }
}
function getLocalizedDefaultMessage(clientName, profileOwnerName, language) {
  const messages = {
    en: `Thanks for connecting, ${clientName}! Looking forward to staying in touch. - ${profileOwnerName}`,
    es: `¡Gracias por conectar, ${clientName}! Espero mantenerme en contacto. - ${profileOwnerName}`,
    fr: `Merci de vous connecter, ${clientName} ! J'ai hâte de rester en contact. - ${profileOwnerName}`,
    de: `Danke fürs Vernetzen, ${clientName}! Freue mich auf weiteren Kontakt. - ${profileOwnerName}`,
    it: `Grazie per il collegamento, ${clientName}! Non vedo l'ora di rimanere in contatto. - ${profileOwnerName}`,
    pt: `Obrigado por se conectar, ${clientName}! Ansioso para manter contato. - ${profileOwnerName}`,
    zh: `谢谢连接，${clientName}！期待保持联系。- ${profileOwnerName}`,
    ja: `接続ありがとう、${clientName}さん！連絡を取り続けることを楽しみにしています。- ${profileOwnerName}`,
    ko: `연결해 주셔서 감사합니다, ${clientName}님! 계속 연락하기를 기대합니다. - ${profileOwnerName}`,
    ru: `Спасибо за подключение, ${clientName}! С нетерпением жду дальнейшего общения. - ${profileOwnerName}`,
    ar: `شكراً للتواصل، ${clientName}! أتطلع للبقاء على تواصل. - ${profileOwnerName}`,
    hi: `कनेक्ट करने के लिए धन्यवाद, ${clientName}! संपर्क में रहने की उम्मीद है। - ${profileOwnerName}`,
    nl: `Bedankt voor het verbinden, ${clientName}! Kijk ernaar uit om in contact te blijven. - ${profileOwnerName}`,
    sv: `Tack för att du ansluter, ${clientName}! Ser fram emot att hålla kontakten. - ${profileOwnerName}`,
    no: `Takk for tilkoblingen, ${clientName}! Ser frem til å holde kontakten. - ${profileOwnerName}`,
    da: `Tak for forbindelsen, ${clientName}! Ser frem til at holde kontakten. - ${profileOwnerName}`,
    fi: `Kiitos yhteydenotosta, ${clientName}! Odotan innolla yhteydenpitoa. - ${profileOwnerName}`,
    pl: `Dziękuję za połączenie, ${clientName}! Nie mogę się doczekać kontaktu. - ${profileOwnerName}`,
    tr: `Bağlantı için teşekkürler, ${clientName}! İletişimde kalmayı dört gözle bekliyorum. - ${profileOwnerName}`,
    th: `ขอบคุณสำหรับการเชื่อมต่อ, ${clientName}! รอคอยที่จะติดต่อกัน - ${profileOwnerName}`,
    vi: `Cảm ơn vì đã kết nối, ${clientName}! Mong được giữ liên lạc. - ${profileOwnerName}`
  };
    return messages[language.toLowerCase()] || messages.en;
}

/**
 * Categorize and format detected fields
 */
function categorizeField(key, value) {
  const normalizedKey = key.toLowerCase().trim();
  
  // Standard professional fields
  const standardFields = {
    'name': { label: 'Name', category: 'personal', type: 'standard', confidence: 0.95 },
    'fullname': { label: 'Name', category: 'personal', type: 'standard', confidence: 0.95 },
    'email': { label: 'Email', category: 'contact', type: 'standard', confidence: 0.95 },
    'phone': { label: 'Phone', category: 'contact', type: 'standard', confidence: 0.9 },
    'telephone': { label: 'Phone', category: 'contact', type: 'standard', confidence: 0.9 },
    'company': { label: 'Company', category: 'professional', type: 'standard', confidence: 0.9 },
    'organization': { label: 'Company', category: 'professional', type: 'standard', confidence: 0.9 },
    'jobtitle': { label: 'Job Title', category: 'professional', type: 'standard', confidence: 0.85 },
    'title': { label: 'Job Title', category: 'professional', type: 'standard', confidence: 0.85 },
    'position': { label: 'Job Title', category: 'professional', type: 'standard', confidence: 0.85 },
    'website': { label: 'Website', category: 'contact', type: 'standard', confidence: 0.8 },
    'url': { label: 'Website', category: 'contact', type: 'standard', confidence: 0.8 },
    'address': { label: 'Address', category: 'contact', type: 'standard', confidence: 0.8 }
  };

  // Extended professional fields
  const extendedFields = {
    'tagline': { label: 'Tagline', category: 'professional', type: 'extended', confidence: 0.8 },
    'slogan': { label: 'Tagline', category: 'professional', type: 'extended', confidence: 0.8 },
    'motto': { label: 'Tagline', category: 'professional', type: 'extended', confidence: 0.8 },
    'linkedin': { label: 'LinkedIn', category: 'social', type: 'extended', confidence: 0.85 },
    'twitter': { label: 'Twitter', category: 'social', type: 'extended', confidence: 0.8 },
    'instagram': { label: 'Instagram', category: 'social', type: 'extended', confidence: 0.8 },
    'facebook': { label: 'Facebook', category: 'social', type: 'extended', confidence: 0.8 },
    'whatsapp': { label: 'WhatsApp', category: 'contact', type: 'extended', confidence: 0.8 },
    'telegram': { label: 'Telegram', category: 'contact', type: 'extended', confidence: 0.8 },
    'education': { label: 'Education', category: 'professional', type: 'extended', confidence: 0.75 },
    'degree': { label: 'Education', category: 'professional', type: 'extended', confidence: 0.75 },
    'certification': { label: 'Certification', category: 'professional', type: 'extended', confidence: 0.75 },
    'experience': { label: 'Experience', category: 'professional', type: 'extended', confidence: 0.75 },
    'yearsexperience': { label: 'Years of Experience', category: 'professional', type: 'extended', confidence: 0.75 },
    'skills': { label: 'Skills', category: 'professional', type: 'extended', confidence: 0.7 },
    'specialization': { label: 'Specialization', category: 'professional', type: 'extended', confidence: 0.75 },
    'languages': { label: 'Languages', category: 'personal', type: 'extended', confidence: 0.7 },
    'department': { label: 'Department', category: 'professional', type: 'extended', confidence: 0.75 }
  };

  // Check standard fields first
  if (standardFields[normalizedKey]) {
    return {
      ...standardFields[normalizedKey],
      value: formatFieldValue(standardFields[normalizedKey].label, value),
      isDynamic: false
    };
  }

  // Check extended fields
  if (extendedFields[normalizedKey]) {
    return {
      ...extendedFields[normalizedKey],
      value: formatFieldValue(extendedFields[normalizedKey].label, value),
      isDynamic: false
    };
  }

  // Create dynamic field for unrecognized but potentially valuable information
  const dynamicLabel = createDynamicFieldLabel(key);
  const dynamicCategory = inferFieldCategory(key, value);
  
  return {
    label: dynamicLabel,
    value: value,
    category: dynamicCategory,
    type: 'dynamic',
    confidence: 0.6,
    isDynamic: true
  };
}
/**
 * Create a readable label for dynamic fields
 */
function createDynamicFieldLabel(key) {
  // Convert camelCase or snake_case to Title Case
  const words = key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/[_-]/g, ' ') // Replace underscores and dashes with spaces
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  
  return words.join(' ');
}

/**
 * Infer category for dynamic fields based on content
 */
function inferFieldCategory(key, value) {
  const keyLower = key.toLowerCase();
  const valueLower = value.toLowerCase();

  // Social media patterns
  if (keyLower.includes('social') || valueLower.includes('@') || 
      valueLower.includes('linkedin') || valueLower.includes('twitter') || 
      valueLower.includes('instagram') || valueLower.includes('facebook')) {
    return 'social';
  }

  // Contact patterns
  if (keyLower.includes('phone') || keyLower.includes('mobile') || 
      keyLower.includes('whatsapp') || keyLower.includes('telegram') ||
      valueLower.includes('+') || /\d{3,}/.test(valueLower)) {
    return 'contact';
  }

  // Professional patterns
  if (keyLower.includes('experience') || keyLower.includes('skill') || 
      keyLower.includes('certification') || keyLower.includes('education') ||
      keyLower.includes('degree') || keyLower.includes('year')) {
    return 'professional';
  }

  // Personal patterns
  if (keyLower.includes('language') || keyLower.includes('hobby') || 
      keyLower.includes('interest')) {
    return 'personal';
  }

  return 'other'; // Default category
}

/**
 * Format field values based on field type
 */
function formatFieldValue(label, value) {
  switch (label.toLowerCase()) {
    case 'email':
      return value.toLowerCase().trim();
    
    case 'phone':
      // Basic phone formatting - remove extra spaces and common separators
      return value.replace(/[\s\-\(\)\.]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    
    case 'website':
    case 'linkedin':
    case 'twitter':
    case 'instagram':
    case 'facebook':
      return formatWebsiteUrl(value);
    
    case 'name':
    case 'company':
    case 'job title':
      // Title case for names and titles
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
function formatWebsiteUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  const trimmedUrl = url.trim();
  
  // Already has protocol
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
    return trimmedUrl;
  }
  
  // Social media specific formatting
  if (trimmedUrl.includes('linkedin.com')) {
    return trimmedUrl.startsWith('linkedin.com') ? `https://${trimmedUrl}` : `https://linkedin.com/in/${trimmedUrl}`;
  }
  
  if (trimmedUrl.includes('twitter.com')) {
    return trimmedUrl.startsWith('twitter.com') ? `https://${trimmedUrl}` : `https://twitter.com/${trimmedUrl}`;
  }
  
  // Generic URL formatting
  if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
    return `https://${trimmedUrl}`;
  }
  
  return trimmedUrl;
}

/**
 * Enhanced field cleaning and deduplication
 */
function cleanAndDeduplicateEnhancedFields(fields) {
  const fieldGroups = new Map();
  
  fields.forEach(field => {
    const key = field.label.toLowerCase();
    
    if (!fieldGroups.has(key)) {
      fieldGroups.set(key, []);
    }
    fieldGroups.get(key).push(field);
  });
  
  const deduplicatedFields = [];
  
  fieldGroups.forEach((groupFields, key) => {
    // Sort by confidence and whether it's dynamic (prefer non-dynamic)
    groupFields.sort((a, b) => {
      if (a.isDynamic !== b.isDynamic) {
        return a.isDynamic ? 1 : -1; // Prefer non-dynamic
      }
      return b.confidence - a.confidence; // Higher confidence first
    });
    
    const bestField = groupFields[0];
    bestField.label = createDynamicFieldLabel(key);
    
    // Add alternative values if significantly different
    if (groupFields.length > 1) {
      bestField.alternativeValues = groupFields.slice(1)
        .filter(f => f.value !== bestField.value)
        .map(f => ({
          value: f.value,
          confidence: f.confidence,
          source: f.source
        }));
    }
    
    deduplicatedFields.push(bestField);
  });
  
  return deduplicatedFields;
}

/**
 * Enhanced field validation with dynamic field support
 */
function scoreAndValidateEnhancedFields(fields) {
  return fields.map(field => {
    const validation = validateEnhancedFieldValue(field.label, field.value, field.category);
    
    return {
      ...field,
      isValid: validation.isValid,
      validationErrors: validation.errors,
      adjustedConfidence: validation.isValid ? field.confidence : field.confidence * 0.7,
      normalizedValue: validation.normalizedValue || field.value
    };
  });
}

/**
 * Enhanced field validation
 */
function validateEnhancedFieldValue(label, value, category) {
  const errors = [];
  let normalizedValue = value;
  
  switch (label.toLowerCase()) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push('Invalid email format');
      } else {
        normalizedValue = value.toLowerCase();
      }
      break;
      
    case 'phone':
      const cleanPhone = value.replace(/[\s\-\(\)\.]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push('Phone number length invalid');
      }
      break;
      
    case 'website':
    case 'linkedin':
    case 'twitter':
    case 'instagram':
    case 'facebook':
      try {
        const url = value.startsWith('http') ? value : `https://${value}`;
        new URL(url);
        normalizedValue = url;
      } catch {
        errors.push('Invalid URL format');
      }
      break;
  }
  
  // Validate based on category
  if (category === 'contact' && value.length < 3) {
    errors.push('Contact information too short');
  }
  
  if (category === 'social' && !value.includes('.') && !value.includes('/')) {
    errors.push('Social media link appears incomplete');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    normalizedValue
  };
}

/**
 * Structure enhanced scan results
 */
function structureEnhancedScanResult(enhancedResult, side = 'front') {
  const fields = enhancedResult.extractedFields || [];
    
    // Add side information to all fields
    fields.forEach(field => {
        if (!field.side) {
            field.side = side;
        }
    })  
  // Organize fields by category
  const fieldsByCategory = {
    personal: [],
    professional: [],
    contact: [],
    social: [],
    other: []
  };
  
  fields.forEach(field => {
    const category = field.category || 'other';
    fieldsByCategory[category].push(field);
  });
  
  // Calculate metadata
  const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0);
  const dynamicFields = fields.filter(f => f.isDynamic);
  const standardFields = fields.filter(f => !f.isDynamic);
  
  return {
    success: enhancedResult.ocrSuccess || enhancedResult.qrSuccess,
        parsedFields: fields,
        metadata: {
            hasQRCode: enhancedResult.hasQRCode || false,
            fieldsCount: fields.length,
            fieldsWithData: fields.filter(f => f.value && f.value.trim().length > 0).length,
            dynamicFieldsCount: fields.filter(f => f.isDynamic).length,
            standardFieldsCount: fields.filter(f => !f.isDynamic).length,
            processedAt: new Date().toISOString(),
            processingMethod: 'enhanced_ai_dynamic',
            confidence: calculateOverallConfidence(fields.filter(f => f.value && f.value.trim().length > 0)),
            aiProcessed: enhancedResult.aiProcessed || false,
            enhancedProcessing: true,
            side: side // NEW: Include side information in metadata
        }
  };
}

// ... (rest of the file is correct) ...
function calculateScanCost(scanResult, duration) {
  let baseCost = 0.0015; // Base cost for Gemini API call

  // Adjust based on complexity
  if (scanResult.metadata?.hasQRCode) {
    baseCost *= 1.2;
  }

  if (scanResult.parsedFields?.length > 5) {
    baseCost *= 1.1;
  }

  // Factor in processing time
  if (duration > 10000) { // > 10 seconds
    baseCost *= 1.3;
  } else if (duration > 5000) { // > 5 seconds
    baseCost *= 1.1;
  }

  return Math.max(baseCost, 0.0001); // Minimum cost
}
// Add these helper functions to your route.js file

/**
 * Validate and sanitize base64 image data
 */
function validateAndSanitizeImageData(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('Invalid image data: must be a base64 string');
  }

  // Remove data URL prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleanBase64)) {
    throw new Error('Invalid base64 format');
  }

  // Check size constraints
  if (cleanBase64.length < 100) {
    throw new Error('Image data too small');
  }

  const estimatedSize = cleanBase64.length * 0.75; // Base64 is ~33% larger
  if (estimatedSize > 15 * 1024 * 1024) { // 15MB limit
    throw new Error('Image too large (max 15MB)');
  }

  console.log('✅ Image data validated:', {
    base64Length: cleanBase64.length,
    estimatedSizeKB: Math.round(estimatedSize / 1024)
  });

  return cleanBase64;
}

/**
 * Create fallback result for errors
 */
function createFallbackResult(errorMessage) {
  const fallbackFields = [
    { label: 'Name', value: '', type: 'standard' },
    { label: 'Email', value: '', type: 'standard' },
    { label: 'Phone', value: '', type: 'standard' },
    { label: 'Company', value: '', type: 'standard' },
    { label: 'Job Title', value: '', type: 'custom' },
    { 
      label: 'Note', 
      value: `Scan failed: ${errorMessage}. Please fill manually.`, 
      type: 'custom' 
    }
  ];
  
  return {
    success: false,
    error: errorMessage,
    parsedFields: fallbackFields,
    metadata: {
      hasQRCode: false,
      fieldsCount: fallbackFields.length,
      fieldsWithData: 1, // Only the note field
      hasRequiredFields: false,
      processedAt: new Date().toISOString(),
      processingMethod: 'error_fallback',
      confidence: 0,
      note: `Scanning error: ${errorMessage}`
    }
  };
}

/**
 * Calculate real cost from Gemini API usage metadata
 */
function calculateRealCost(usageMetadata) {
  if (!usageMetadata) {
    console.warn('⚠️ [Gemini Cost] No usage metadata found, returning fallback cost.');
    return 0.001; // Return a minimal fallback cost
  }

  const { promptTokenCount, candidatesTokenCount } = usageMetadata;

  // Prices for Gemini 1.5 Flash (for requests <= 128k tokens) per 1M tokens
  const INPUT_PRICE_PER_MILLION_TOKENS = 0.075;
  const OUTPUT_PRICE_PER_MILLION_TOKENS = 0.30;

  const inputCost = (promptTokenCount / 1000000) * INPUT_PRICE_PER_MILLION_TOKENS;
  const outputCost = (candidatesTokenCount / 1000000) * OUTPUT_PRICE_PER_MILLION_TOKENS;
  
  const totalCost = inputCost + outputCost;

  console.log(`💰 [Gemini Cost] Input: ${promptTokenCount} tokens ($${inputCost.toFixed(6)}), Output: ${candidatesTokenCount} tokens ($${outputCost.toFixed(6)}), Total: $${totalCost.toFixed(6)}`);

  return totalCost;
}

/**
 * Perform OCR processing on the image
 */
async function performOCRProcessing(imageBase64) {
  try {
    console.log('🔍 Performing OCR processing...');
    
    // Call Google Vision API for OCR
    const ocrResult = await callGoogleVisionAPI(imageBase64);
    return processOCRResponse(ocrResult);

  } catch (error) {
    console.error('❌ OCR processing failed:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      blocks: [],
      error: error.message
    };
  }
}

/**
 * Call Google Vision API for OCR
 */
async function callGoogleVisionAPI(imageBase64) {
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

    const request = {
      image: { content: imageBase64 },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: {
        languageHints: ["en", "es", "fr", "it", "vi", "zh"],
      },
    };

    const [result] = await client.annotateImage(request);
    
    return {
      success: true,
      fullText: result.fullTextAnnotation?.text || '',
      textAnnotations: result.textAnnotations || [],
      confidence: calculateOCRConfidence(result.textAnnotations),
      provider: 'google-vision'
    };
  } catch (error) {
    console.error('Google Vision API error:', error);
    throw new Error(`Google Vision API error: ${error.message}`);
  }
}

/**
 * Calculate OCR confidence from Google Vision response
 */
function calculateOCRConfidence(textAnnotations) {
  if (!textAnnotations || textAnnotations.length === 0) {
    return 0;
  }
  
  const confidenceScores = textAnnotations
    .filter(annotation => typeof annotation.confidence === 'number')
    .map(annotation => annotation.confidence);
  
  if (confidenceScores.length === 0) {
    return 0.5; // Default confidence if not provided
  }
  
  const averageConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  return Math.round(averageConfidence * 100) / 100;
}

/**
 * Process OCR response into structured format
 */
function processOCRResponse(ocrResult) {
  if (!ocrResult.success) {
    return ocrResult;
  }

  const extractedText = ocrResult.fullText;
  const textBlocks = ocrResult.textAnnotations.map(annotation => ({
    text: annotation.description,
    confidence: annotation.confidence || 0,
    boundingBox: annotation.boundingPoly
  }));

  return {
    success: true,
    text: extractedText,
    blocks: textBlocks,
    confidence: ocrResult.confidence,
    provider: ocrResult.provider
  };
}

/**
 * Process QR codes using sharp and jsqr
 */
async function processQRCodes(imageBase64) {
  try {
    console.log('🔳 Processing QR codes...');
    
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
      console.log('✅ QR code detected:', qrCode.data);
      return {
        success: true,
        hasQRCode: true,
        qrData: qrCode.data,
        qrLocation: qrCode.location,
        parsedQRData: parseQRData(qrCode.data)
      };
    }

    return { success: true, hasQRCode: false, qrData: null };

  } catch (error) {
    console.error('❌ QR code processing failed:', error);
    return { success: false, hasQRCode: false, error: error.message };
  }
}

/**
 * Parse QR code data
 */
function parseQRData(qrData) {
  try {
    if (qrData.startsWith('BEGIN:VCARD')) {
      return parseVCard(qrData);
    }
    
    if (qrData.startsWith('http://') || qrData.startsWith('https://')) {
      return { type: 'url', url: qrData };
    }
    
    if (qrData.includes('@') && qrData.includes('\n')) {
      return parseStructuredContactData(qrData);
    }
    
    return { type: 'text', data: qrData };
    
  } catch (error) {
    return { type: 'raw', data: qrData, parseError: error.message };
  }
}

/**
 * Parse vCard data from QR code
 */
function parseVCard(vCardData) {
  const lines = vCardData.split('\n');
  const contactData = {};
  
  lines.forEach(line => {
    if (line.startsWith('FN:')) {
      contactData.name = line.substring(3);
    } else if (line.startsWith('EMAIL:')) {
      contactData.email = line.substring(6);
    } else if (line.startsWith('TEL:')) {
      contactData.phone = line.substring(4);
    } else if (line.startsWith('ORG:')) {
      contactData.company = line.substring(4);
    } else if (line.startsWith('TITLE:')) {
      contactData.jobTitle = line.substring(6);
    } else if (line.startsWith('URL:')) {
      contactData.website = line.substring(4);
    }
  });
  
  return { type: 'vcard', contactData };
}

/**
 * Parse structured contact data from QR
 */
function parseStructuredContactData(data) {
  const lines = data.split('\n');
  const contactData = {};
  
  lines.forEach(line => {
    if (line.includes('@')) {
      contactData.email = line.trim();
    } else if (/^\+?\d/.test(line)) {
      contactData.phone = line.trim();
    } else if (line.length > 2 && line.length < 50) {
      if (!contactData.name) {
        contactData.name = line.trim();
      } else if (!contactData.company) {
        contactData.company = line.trim();
      }
    }
  });
  
  return { type: 'structured', contactData };
}

/**
 * Merge OCR and QR results
 */
function mergeScanResults(ocrResult, qrResult) {
  return {
    ocrSuccess: ocrResult.success,
    qrSuccess: qrResult.success,
    hasQRCode: qrResult.hasQRCode,
    extractedText: ocrResult.text || '',
    qrData: qrResult.qrData,
    parsedQRData: qrResult.parsedQRData,
    textBlocks: ocrResult.blocks || [],
    confidence: ocrResult.confidence || 0
  };
}

/**
 * Convert QR data to field format
 */
function convertQRDataToFields(qrContactData) {
  const fields = [];
  
  Object.entries(qrContactData).forEach(([key, value]) => {
    if (value && typeof value === 'string' && value.trim().length > 0) {
      fields.push({
        label: normalizeFieldLabel(key),
        value: value.trim(),
        type: 'standard',
        confidence: 0.95,
        source: 'qr_code'
      });
    }
  });
  
  return fields;
}

/**
 * Normalize field labels to standard format
 */
function normalizeFieldLabel(label) {
  const normalizedLabel = label.toLowerCase().trim();
  
  const labelMap = {
    'name': 'Name',
    'full name': 'Name',
    'email': 'Email',
    'email address': 'Email',
    'phone': 'Phone',
    'phone number': 'Phone',
    'tel': 'Phone',
    'telephone': 'Phone',
    'company': 'Company',
    'organization': 'Company',
    'org': 'Company',
    'job title': 'Job Title',
    'title': 'Job Title',
    'position': 'Job Title',
    'website': 'Website',
    'web': 'Website',
    'url': 'Website',
    'address': 'Address',
    'location': 'Address'
  };
  
  return labelMap[normalizedLabel] || capitalizeFirstLetter(label);
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * Extract contact fields basic fallback
 */
function extractContactFieldsBasic(text) {
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
      source: 'basic_regex'
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
      source: 'basic_regex'
    });
  }
  
  return fields;
}

/**
 * Calculate overall confidence
 */
function calculateOverallConfidence(fields) {
  const fieldsWithData = fields.filter(f => f.value && f.value.trim().length > 0);
  
  if (fieldsWithData.length === 0) {
    return 0;
  }
  
  const totalConfidence = fieldsWithData.reduce((sum, field) => sum + field.confidence, 0);
  return Math.round((totalConfidence / fieldsWithData.length) * 100) / 100;
}

