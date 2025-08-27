import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';
import jsQR from 'jsqr';
import sharp from 'sharp';
import vCard from 'vcf';
import { FieldValue } from 'firebase-admin/firestore';

// --- GOOGLE VISION API COST TRACKING ---
const visionApiCostTracker = {
    sessionScans: 0,
    sessionCost: 0,
    totalMonthlyScans: 0, // Will be fetched from database
    
    addScan() {
        this.sessionScans++;
        this.totalMonthlyScans++;
        this.sessionCost += this.calculateScanCost(this.totalMonthlyScans);
    },
    
    calculateScanCost(totalScans) {
        if (totalScans <= 1000) {
            return 0; // Free tier
        } else if (totalScans <= 5000000) {
            return 0.0015; // $1.50 per 1,000 scans = $0.0015 per scan
        } else {
            return 0.0006; // $0.60 per 1,000 scans = $0.0006 per scan
        }
    },
    
    getTierInfo(totalScans) {
        if (totalScans <= 1000) {
            return {
                tier: 'free',
                tierLimit: 1000,
                remaining: 1000 - totalScans,
                costPerScan: 0,
                description: 'Free tier - no cost'
            };
        } else if (totalScans <= 5000000) {
            return {
                tier: 'standard',
                tierLimit: 5000000,
                remaining: 5000000 - totalScans,
                costPerScan: 0.0015,
                description: 'Standard tier - $1.50 per 1,000 scans'
            };
        } else {
            return {
                tier: 'volume',
                tierLimit: null,
                remaining: null,
                costPerScan: 0.0006,
                description: 'Volume tier - $0.60 per 1,000 scans'
            };
        }
    },
    
    getStats() {
        return {
            sessionScans: this.sessionScans,
            sessionCost: this.sessionCost.toFixed(6),
            totalMonthlyScans: this.totalMonthlyScans,
            tierInfo: this.getTierInfo(this.totalMonthlyScans)
        };
    },
    
    reset() {
        this.sessionScans = 0;
        this.sessionCost = 0;
        this.totalMonthlyScans = 0;
    }
};

// Enhanced logging with cost awareness
const logWithCostTracking = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    const emoji = level === 'INFO' ? '📊' : level === 'SUCCESS' ? '✅' : level === 'WARNING' ? '⚠️' : '❌';
    const costStats = visionApiCostTracker.getStats();
    
    console.log(`${emoji} [VISION-API-COST-TRACKER] ${timestamp} - ${message}`, {
        ...data,
        currentSessionCost: `$${costStats.sessionCost}`,
        sessionScans: costStats.sessionScans,
        monthlyScans: costStats.totalMonthlyScans,
        currentTier: costStats.tierInfo.tier,
        scansRemaining: costStats.tierInfo.remaining
    });
};

// Get current month's total usage across all users
async function getCurrentMonthlyUsage() {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        logWithCostTracking('INFO', 'Fetching monthly Vision API usage', {
            startOfMonth: startOfMonth.toISOString(),
            endOfMonth: endOfMonth.toISOString()
        });

        const usageLogsRef = adminDb.collection('UsageLogs');
        const monthlyQuery = await usageLogsRef
            .where('feature', '==', 'businessCardScan')
            .where('status', '==', 'success')
            .where('timestamp', '>=', startOfMonth)
            .where('timestamp', '<=', endOfMonth)
            .get();

        let totalScans = 0;
        let totalCost = 0;

        monthlyQuery.forEach(doc => {
            const data = doc.data();
            totalScans += data.scansProcessed || 1; // Default to 1 if not specified
            totalCost += data.cost || 0;
        });

        logWithCostTracking('SUCCESS', 'Monthly usage retrieved', {
            totalScans,
            totalCost: totalCost.toFixed(6),
            tierInfo: visionApiCostTracker.getTierInfo(totalScans)
        });

        return { totalScans, totalCost };
    } catch (error) {
        logWithCostTracking('ERROR', 'Error fetching monthly usage', { error: error.message });
        return { totalScans: 0, totalCost: 0 };
    }
}

// Save usage log to database
async function saveUsageLogToDatabase(logData) {
    try {
        await adminDb.collection('UsageLogs').add(logData);
        logWithCostTracking('SUCCESS', 'Usage log saved to database', { 
            userId: logData.userId,
            feature: logData.feature,
            cost: logData.cost
        });
    } catch (error) {
        console.error("🔥 CRITICAL: Failed to save usage log to database:", error);
    }
}

// --- REFINED: Multi-Language Parsing Logic with Scoring System ---
const parsingConfig = {
    universal: {
        email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
        website: /\b(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/i,
        phone: /(?:(?:\+?(\d{1,3}))?[-. (]*(\d{2,4})[-. )]*(\d{2,4})[-. ]*(\d{3,5})(?: *x(\d+))?)/,
        address: /\d{1,5}\s[\w\s.-]+(?:street|avenue|road|blvd|drive|rue|via|corso|platz)/i,
    },
    keywords: {
        mobile: ['m', 'mob', 'mobile', 'cell', 'port', 'gsm', 'cellulare'],
        company: ['inc', 'llc', 'ltd', 'corp', 'solutions', 'group', 'sa', 'sarl', 'sas', 'groupe', 'spa', 'srl', 'gruppo'],
        job_title: ['manager', 'director', 'president', 'ceo', 'cto', 'cfo', 'vp', 'engineer', 'developer', 'designer', 'consultant', 'head of', 'chief', 'directeur', 'directrice', 'président', 'pdg', 'ingénieur', 'développeur', 'responsable', 'direttore', 'ingegnere', 'sviluppatore', 'amministratore delegato'],
    }
};

function parseBusinessCardText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 2);
    let parsedFields = [];
    const usedLines = new Set();

    // --- Step 1: Extract universal data with high confidence (Regex) ---
    lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        if (parsingConfig.universal.email.test(line)) {
            parsedFields.push({ label: 'Email', value: line.match(parsingConfig.universal.email)[0], type: 'standard' });
            usedLines.add(index);
        } else if (parsingConfig.universal.phone.test(line)) {
            const label = parsingConfig.keywords.mobile.some(kw => lowerLine.includes(kw)) ? 'Mobile' : 'Phone';
            parsedFields.push({ label, value: line.match(parsingConfig.universal.phone)[0], type: 'standard' });
            usedLines.add(index);
        } else if (parsingConfig.universal.website.test(line) && !line.includes('@')) {
            parsedFields.push({ label: 'Website', value: line.match(parsingConfig.universal.website)[0], type: 'social' });
            usedLines.add(index);
        } else if (parsingConfig.universal.address.test(lowerLine)) {
            parsedFields.push({ label: 'Address', value: line, type: 'custom' });
            usedLines.add(index);
        }
    });

    // --- Step 2: Use a scoring system for Name, Company, and Title ---
    const remainingLines = lines.filter((_, index) => !usedLines.has(index));
    const scores = { name: [], company: [], title: [] };

    remainingLines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        let nameScore = 0;
        let companyScore = 0;
        let titleScore = 0;

        // Score for Job Title
        if (parsingConfig.keywords.job_title.some(kw => lowerLine.includes(kw))) titleScore += 10;
        
        // Score for Company
        if (parsingConfig.keywords.company.some(kw => lowerLine.includes(kw))) companyScore += 10;
        if (line === line.toUpperCase() && line.length > 3) companyScore += 5; // All caps is often a company

        // Score for Name
        const words = line.split(' ').filter(w => w.length > 1);
        if (words.length >= 2 && words.length <= 3) nameScore += 5; // Typically 2 or 3 words
        if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(line)) nameScore += 5; // Starts with "First Last" capitalization
        if (titleScore > 0) nameScore -= 5; // Less likely to be a name if it's also a title
        if (companyScore > 0) nameScore -= 5; // Less likely to be a name if it looks like a company

        scores.name.push({ index, score: nameScore });
        scores.company.push({ index, score: companyScore });
        scores.title.push({ index, score: titleScore });
    });

    const findBestMatch = (category) => {
        scores[category].sort((a, b) => b.score - a.score);
        const best = scores[category][0];
        if (best && best.score > 0) {
            const lineIndex = lines.indexOf(remainingLines[best.index]);
            if (!usedLines.has(lineIndex)) {
                usedLines.add(lineIndex);
                return remainingLines[best.index];
            }
        }
        return null;
    };

    const jobTitle = findBestMatch('title');
    const company = findBestMatch('company');
    const name = findBestMatch('name');

    if (name) parsedFields.push({ label: 'Name', value: name, type: 'standard' });
    if (jobTitle) parsedFields.push({ label: 'Job Title', value: jobTitle, type: 'custom' });
    if (company) parsedFields.push({ label: 'Company', value: company, type: 'standard' });

    // --- Step 3: Add any truly remaining lines as notes ---
    lines.forEach((line, index) => {
        if (!usedLines.has(index)) {
            parsedFields.push({ label: 'Note', value: line, type: 'custom' });
        }
    });

    return parsedFields;
}

// QR Code decoder
async function decodeAndParseQrCode(imageBase64) {
    try {
        logWithCostTracking('INFO', 'Attempting QR Code decoding (FREE)');
        const buffer = Buffer.from(imageBase64, 'base64');
        const { data, info } = await sharp(buffer).greyscale().raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
        
        if (code && code.data) {
            logWithCostTracking('SUCCESS', 'QR Code detected successfully', { dataLength: code.data.length });
            let parsedFields = [];
            
            // Check if it's a vCard
            if (code.data.toUpperCase().includes("BEGIN:VCARD")) {
                const card = vCard.parse(code.data);
                const name = card.get('fn')?.valueOf();
                const email = card.get('email')?.valueOf();
                const tel = card.get('tel')?.valueOf();
                const org = card.get('org')?.valueOf();
                const title = card.get('title')?.valueOf();

                if (name) parsedFields.push({ label: 'Name', value: name, type: 'standard' });
                if (email) parsedFields.push({ label: 'Email', value: email, type: 'standard' });
                if (tel) parsedFields.push({ label: 'Phone', value: tel, type: 'standard' });
                if (org) parsedFields.push({ label: 'Company', value: org, type: 'standard' });
                if (title) parsedFields.push({ label: 'Job Title', value: title, type: 'custom' });
                
                logWithCostTracking('SUCCESS', 'vCard parsed from QR Code', { fieldsFound: parsedFields.length });
            } else {
                // If not a vCard, add raw data as a note
                parsedFields.push({ label: 'QR Code Data', value: code.data, type: 'custom' });
            }
            return parsedFields;
        }
        return null;
    } catch (error) {
        logWithCostTracking('WARNING', 'QR Code decoding failed', { error: error.message });
        return null;
    }
}

// Google Vision API call with cost tracking
async function callGoogleVisionAPI(imageBase64) {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
        throw new Error('Google Vision API not configured');
    }

    // Track the scan before making the call
    visionApiCostTracker.addScan();
    const costInfo = visionApiCostTracker.getStats();
    
    logWithCostTracking('INFO', 'Making Google Vision API call', {
        scanNumber: costInfo.sessionScans,
        estimatedCost: costInfo.tierInfo.costPerScan,
        currentTier: costInfo.tierInfo.tier,
        monthlyScansAfterThis: costInfo.totalMonthlyScans
    });

    const requestBody = {
        requests: [{
            image: { content: imageBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: {
                languageHints: ["en", "fr", "it"] 
            }
        }]
    };

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logWithCostTracking('ERROR', 'Google Vision API HTTP error', { 
            status: response.status, 
            error: errorText,
            stillCharged: true,
            cost: costInfo.tierInfo.costPerScan
        });
        throw new Error(`Google Vision API failed with status: ${response.status}`);
    }

    const data = await response.json();
    const annotation = data.responses?.[0]?.fullTextAnnotation;
    
    if (annotation && annotation.text) {
        logWithCostTracking('SUCCESS', 'Google Vision extracted text successfully', {
            textLength: annotation.text.length,
            cost: costInfo.tierInfo.costPerScan,
            totalSessionCost: costInfo.sessionCost
        });
        return annotation.text;
    } else {
        logWithCostTracking('INFO', 'Google Vision found no text in image', {
            cost: costInfo.tierInfo.costPerScan,
            stillCharged: true
        });
        return null;
    }
}

// Main API Handler with advanced logging
export async function POST(request) {
    const startTime = Date.now();
    let userId = null;
    
    try {
        // Reset cost tracker for this session
        visionApiCostTracker.reset();
        
        logWithCostTracking('INFO', 'Business card scan request started');

        // Authentication & Rate Limiting
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const { uid } = await adminAuth.verifyIdToken(token);
        userId = uid;
        
        if (!rateLimit(uid, 10, 60000)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // Get current monthly usage to set proper cost tracking
        const monthlyUsage = await getCurrentMonthlyUsage();
        visionApiCostTracker.totalMonthlyScans = monthlyUsage.totalScans;
        
        logWithCostTracking('INFO', 'User authenticated and monthly usage loaded', {
            userId,
            monthlyScans: monthlyUsage.totalScans,
            monthlyCost: monthlyUsage.totalCost.toFixed(6),
            currentTier: visionApiCostTracker.getTierInfo(monthlyUsage.totalScans).tier
        });

        // Image Validation
        const body = await request.json();
        const { imageBase64 } = body;
        const rawBase64 = imageBase64; // Assuming validation is done client-side

        // HYBRID PROCESSING FLOW
        let qrFields = await decodeAndParseQrCode(rawBase64);
        const hasQrCode = qrFields !== null;

        let ocrText = await callGoogleVisionAPI(rawBase64);
        let ocrFields = ocrText ? parseBusinessCardText(ocrText) : [];

        // Merge QR and OCR results
        let finalFields = qrFields || [];
        const labelsFromQr = new Set(finalFields.map(f => f.label.toLowerCase()));

        ocrFields.forEach(ocrField => {
            if (!labelsFromQr.has(ocrField.label.toLowerCase())) {
                finalFields.push(ocrField);
                labelsFromQr.add(ocrField.label.toLowerCase());
            }
        });
        
        // Final Cleanup and Validation
        const requiredLabels = ['Name', 'Email', 'Phone', 'Company'];
        requiredLabels.forEach(label => {
            if (!finalFields.some(f => f.label === label)) {
                finalFields.push({ label, value: '', type: 'standard' });
            }
        });
        
        const fieldsWithData = finalFields.filter(f => f.value && f.value.trim()).length;
        const processingTimeMs = Date.now() - startTime;
        const finalCostStats = visionApiCostTracker.getStats();

        // Save usage log to database
        const successLogData = {
            userId: userId,
            feature: "businessCardScan",
            status: "success",
            timestamp: FieldValue.serverTimestamp(),
            cost: parseFloat(finalCostStats.sessionCost),
            scansProcessed: finalCostStats.sessionScans,
            processingTimeMs: processingTimeMs,
            visionApiCalls: finalCostStats.sessionScans,
            monthlyScansAfterThis: finalCostStats.totalMonthlyScans,
            tierAtTimeOfScan: finalCostStats.tierInfo.tier,
            details: {
                hasQRCode: hasQrCode,
                processingMethod: hasQrCode ? 'qr_and_vision' : 'google_vision_only',
                fieldsFound: finalFields.length,
                fieldsWithData: fieldsWithData,
                textExtracted: ocrText ? ocrText.length : 0
            }
        };
        await saveUsageLogToDatabase(successLogData);

        logWithCostTracking('SUCCESS', 'Business card scan completed successfully', {
            userId,
            processingMethod: hasQrCode ? 'QR + OCR' : 'OCR Only',
            fieldsFound: finalFields.length,
            fieldsWithData,
            processingTimeMs,
            finalCost: finalCostStats.sessionCost,
            newMonthlyTotal: finalCostStats.totalMonthlyScans
        });

        return NextResponse.json({
            success: true,
            parsedFields: finalFields,
            metadata: {
                hasQRCode: hasQrCode,
                processingMethod: hasQrCode ? 'qr_and_vision' : 'google_vision',
                fieldsCount: finalFields.length,
                fieldsWithData,
                costInfo: {
                    scanCost: parseFloat(finalCostStats.sessionCost),
                    tier: finalCostStats.tierInfo.tier,
                    monthlyScans: finalCostStats.totalMonthlyScans,
                    scansRemaining: finalCostStats.tierInfo.remaining
                }
            }
        });

    } catch (error) {
        const processingTimeMs = Date.now() - startTime;
        const finalCostStats = visionApiCostTracker.getStats();

        logWithCostTracking('ERROR', 'Error in business card scan', {
            error: error.message,
            processingTimeMs,
            costIncurred: finalCostStats.sessionCost
        });

        // Log failed run to database
        if (userId) {
            const errorLogData = {
                userId: userId,
                feature: "businessCardScan",
                status: "error",
                timestamp: FieldValue.serverTimestamp(),
                cost: parseFloat(finalCostStats.sessionCost),
                scansProcessed: finalCostStats.sessionScans,
                processingTimeMs: processingTimeMs,
                monthlyScansAfterThis: finalCostStats.totalMonthlyScans,
                tierAtTimeOfScan: finalCostStats.tierInfo.tier,
                errorDetails: {
                    message: error.message,
                    stack: error.stack
                }
            };
            await saveUsageLogToDatabase(errorLogData);
        }
        
        return NextResponse.json({ 
            success: false,
            error: 'Failed to process image. ' + error.message,
            parsedFields: [
                { label: 'Name', value: '', type: 'standard' },
                { label: 'Email', value: '', type: 'standard' },
                { label: 'Note', value: `Scan failed: ${error.message}. Please fill manually.`, type: 'custom' }
            ],
            metadata: {
                costInfo: {
                    scanCost: parseFloat(finalCostStats.sessionCost),
                    tier: finalCostStats.tierInfo.tier,
                    monthlyScans: finalCostStats.totalMonthlyScans
                }
            }
        }, { status: 500 });
    }
}

// GET endpoint for API documentation and cost information
export async function GET(request) {
    try {
        const monthlyUsage = await getCurrentMonthlyUsage();
        const tierInfo = visionApiCostTracker.getTierInfo(monthlyUsage.totalScans);
        
        return NextResponse.json({
            message: 'Business Card Scan API with Cost Tracking',
            version: '2.0_cost_aware',
            currentUsage: {
                monthlyScans: monthlyUsage.totalScans,
                monthlyCost: monthlyUsage.totalCost.toFixed(6),
                currentTier: tierInfo.tier,
                scansRemaining: tierInfo.remaining,
                nextScanCost: tierInfo.costPerScan
            },
            pricingTiers: {
                free: {
                    scans: '0-1,000',
                    costPerScan: '$0.00',
                    description: 'Free tier - 1,000 scans per month at no cost'
                },
                standard: {
                    scans: '1,001-5,000,000',
                    costPerScan: '$0.0015',
                    description: 'Standard tier - $1.50 per 1,000 scans'
                },
                volume: {
                    scans: '5,000,000+',
                    costPerScan: '$0.0006',
                    description: 'Volume tier - $0.60 per 1,000 scans'
                }
            },
            features: [
                'QR Code detection (free)',
                'Google Vision OCR',
                'Multi-language support (EN, FR, IT)',
                'vCard parsing',
                'Intelligent field detection',
                'Cost tracking and optimization'
            ]
        });
    } catch (error) {
        return NextResponse.json({
            message: 'Business Card Scan API',
            error: 'Could not fetch current usage statistics'
        });
    }
}