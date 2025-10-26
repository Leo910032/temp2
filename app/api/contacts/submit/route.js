// app/api/contacts/submit/route.js - FIXED VERSION (Single Collection)
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';

// --- Validation Functions ---
function validateContactSubmission(contactData) {
    if (!contactData || typeof contactData !== 'object') {
        throw new Error("Invalid contact data");
    }

    // Required fields
    if (!contactData.name || typeof contactData.name !== 'string' || contactData.name.trim().length === 0) {
        throw new Error("Contact name is required");
    }

    if (!contactData.email || typeof contactData.email !== 'string' || contactData.email.trim().length === 0) {
        throw new Error("Contact email is required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactData.email.trim())) {
        throw new Error("Invalid email format");
    }

    // Sanitize contact data
    const sanitizedContact = {
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contactData.name.trim(),
        email: contactData.email.trim().toLowerCase(),
        phone: contactData.phone ? contactData.phone.trim() : '',
        company: contactData.company ? contactData.company.trim() : '',
        message: contactData.message ? contactData.message.trim() : '',
        status: 'new',
        submittedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        source: 'exchange_form'
    };

    // Handle location data
    if (contactData.location && typeof contactData.location === 'object') {
        if (typeof contactData.location.latitude === 'number' && typeof contactData.location.longitude === 'number') {
            sanitizedContact.location = {
                latitude: contactData.location.latitude,
                longitude: contactData.location.longitude,
                accuracy: contactData.location.accuracy || null,
                timestamp: contactData.location.timestamp || new Date().toISOString()
            };
        }
    }

    // ✅ ENHANCED: Add submission metadata directly to contact
    if (contactData.userAgent) {
        sanitizedContact.metadata = {
            userAgent: contactData.userAgent.substring(0, 500),
            referrer: contactData.referrer ? contactData.referrer.substring(0, 500) : '',
            sessionId: contactData.sessionId || '',
            locationStatus: contactData.locationStatus || 'unavailable',
            submissionTime: new Date().toISOString(),
            timezone: contactData.timezone || 'unknown',
            language: contactData.language || 'unknown'
        };
    }

    return sanitizedContact;
}

async function findUserByUsername(username) {
    console.log('🔍 Looking up user by username:', username);
    
    try {
        // Query AccountData collection for the username
        const querySnapshot = await adminDb.collection('AccountData')
            .where('username', '==', username)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            console.log('❌ No user found with username:', username);
            return null;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        console.log('✅ Found user:', {
            userId: userDoc.id,
            username: userData.username,
            displayName: userData.displayName
        });

        return {
            userId: userDoc.id,
            ...userData
        };
    } catch (error) {
        console.error('❌ Error looking up user:', error);
        throw new Error('Failed to lookup user');
    }
}

async function addContactToUserProfile(userId, contactData) {
    console.log('💾 Adding contact to user profile:', userId);
    
    try {
        const contactsRef = adminDb.collection('Contacts').doc(userId);
        const contactsDoc = await contactsRef.get();
        
        let existingContacts = [];
        if (contactsDoc.exists) {
            existingContacts = contactsDoc.data().contacts || [];
        }

        // Check for duplicate email (warn but don't prevent)
        const duplicateContact = existingContacts.find(c => c.email === contactData.email);
        if (duplicateContact) {
            console.log('⚠️ Duplicate email found, but allowing submission:', contactData.email);
        }

        // Add new contact to the beginning of the array
        const updatedContacts = [contactData, ...existingContacts];

        // ✅ ENHANCED: Better contact document structure
        await contactsRef.set({
            contacts: updatedContacts,
            lastUpdated: new Date().toISOString(),
            totalContacts: updatedContacts.length,
            // ✅ Add aggregate statistics
            statistics: {
                totalSubmissions: updatedContacts.length,
                newContacts: updatedContacts.filter(c => c.status === 'new').length,
                viewedContacts: updatedContacts.filter(c => c.status === 'viewed').length,
                archivedContacts: updatedContacts.filter(c => c.status === 'archived').length,
                contactsWithLocation: updatedContacts.filter(c => c.location && c.location.latitude).length,
                lastSubmissionDate: new Date().toISOString(),
                sources: {
                    exchange_form: updatedContacts.filter(c => c.source === 'exchange_form').length,
                    business_card_scan: updatedContacts.filter(c => c.source === 'business_card_scan').length,
                    manual: updatedContacts.filter(c => c.source === 'manual' || !c.source).length,
                    import: updatedContacts.filter(c => c.source === 'import' || c.source === 'import_csv').length
                }
            }
        }, { merge: true });

        console.log('✅ Contact added successfully:', contactData.id);
        
        return contactData.id;
    } catch (error) {
        console.error('❌ Error adding contact to profile:', error);
        throw error;
    }
}

// ✅ POST endpoint for public contact submission
export async function POST(request) {
    try {
        console.log('📝 POST /api/contacts/submit - Public contact submission');

        // --- 1. CSRF Protection ---
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000', 'http://localhost:3001'];
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }

        // --- 2. Rate Limiting (by IP for public endpoint) ---
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || 'unknown';
        
        if (!rateLimit(ip, 5, 60000)) { // 5 submissions per minute per IP
            console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
            return NextResponse.json({ 
                error: 'Too many contact submissions. Please try again in a moment.' 
            }, { status: 429 });
        }

        // --- 3. Parse and Validate Request ---
        const body = await request.json();
        const { username, userId, contact } = body;

        if (!contact) {
            return NextResponse.json({ error: 'Contact data is required' }, { status: 400 });
        }

        if (!username && !userId) {
            return NextResponse.json({ 
                error: 'Either username or userId is required' 
            }, { status: 400 });
        }

        // Validate contact data
        const validatedContact = validateContactSubmission(contact);

        // --- 4. Find Target User ---
        let targetUserId;
        let targetUserData;

        if (userId) {
            // Direct user ID provided (fastest path)
            console.log('🚀 Using direct user ID:', userId);
            targetUserId = userId;
            
            // Verify user exists
            const userDoc = await adminDb.collection('AccountData').doc(userId).get();
            if (!userDoc.exists) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            }
            targetUserData = userDoc.data();
        } else {
            // Username lookup required
            console.log('🔍 Looking up user by username:', username);
            targetUserData = await findUserByUsername(username);
            
            if (!targetUserData) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            }
            targetUserId = targetUserData.userId;
        }

        // --- 5. Add Contact to Profile ---
        const contactId = await addContactToUserProfile(targetUserId, validatedContact);

        console.log('✅ Contact submission successful:', {
            contactId,
            targetUserId,
            email: validatedContact.email,
            hasLocation: !!(validatedContact.location),
            ip: ip
        });

        // --- 6. Return Success Response ---
        return NextResponse.json({
            success: true,
            message: 'Contact submitted successfully',
            contactId: contactId,
            submittedAt: validatedContact.submittedAt
        });

    } catch (error) {
        console.error("💥 API Error in POST /api/contacts/submit:", error.message);
        
        // Handle specific error types
        if (error.message.includes("Invalid") || 
            error.message.includes("required") || 
            error.message.includes("validation")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes("not found") || 
            error.message.includes("Profile not found")) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        
        return NextResponse.json({ 
            error: 'Failed to submit contact. Please try again.' 
        }, { status: 500 });
    }
}

// ✅ GET endpoint for health check / info
export async function GET(request) {
    try {
        const url = new URL(request.url);
        const username = url.searchParams.get('username');
        const userId = url.searchParams.get('userId');

        if (!username && !userId) {
            return NextResponse.json({
                success: true,
                message: 'Contact submission API is available',
                endpoints: {
                    submit: 'POST /api/contacts/submit',
                    info: 'GET /api/contacts/submit?username=<username> or ?userId=<userId>'
                }
            });
        }

        // Check if profile exists (for form validation)
        let targetUserData;
        
        if (userId) {
            const userDoc = await adminDb.collection('AccountData').doc(userId).get();
            if (!userDoc.exists) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            }
            targetUserData = { userId, ...userDoc.data() };
        } else {
            targetUserData = await findUserByUsername(username);
            if (!targetUserData) {
                return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
            }
        }

        return NextResponse.json({
            success: true,
            profile: {
                userId: targetUserData.userId,
                username: targetUserData.username,
                displayName: targetUserData.displayName,
                exists: true
            }
        });

    } catch (error) {
        console.error("💥 API Error in GET /api/contacts/submit:", error.message);
        return NextResponse.json({ 
            error: 'Failed to check profile' 
        }, { status: 500 });
    }
}