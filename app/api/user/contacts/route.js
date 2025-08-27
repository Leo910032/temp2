// app/api/user/contacts/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';
// Ajoutez ces imports après les imports existants
import { checkContactSubscription } from '@/lib/middleware/subscriptionMiddleware';
import { CONTACT_FEATURES } from '@/lib/services/contactSubscriptionService';
// --- Validation Functions ---
function validateContactData(contact) {
    if (!contact || typeof contact !== 'object') {
        throw new Error("Invalid contact data");
    }

    // Required fields
    if (!contact.name || typeof contact.name !== 'string' || contact.name.trim().length === 0) {
        throw new Error("Contact name is required");
    }

    if (!contact.email || typeof contact.email !== 'string' || contact.email.trim().length === 0) {
        throw new Error("Contact email is required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email.trim())) {
        throw new Error("Invalid email format");
    }

    // Sanitize and validate optional fields
    const sanitizedContact = {
        id: contact.id || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contact.name.trim(),
        email: contact.email.trim().toLowerCase(),
        phone: contact.phone ? contact.phone.trim() : '',
        company: contact.company ? contact.company.trim() : '',
        message: contact.message ? contact.message.trim() : '',
        status: contact.status && ['new', 'viewed', 'archived'].includes(contact.status) ? contact.status : 'new',
        submittedAt: contact.submittedAt || new Date().toISOString(),
        lastModified: new Date().toISOString()
    };

    // Handle location data
    if (contact.location && typeof contact.location === 'object') {
        if (typeof contact.location.latitude === 'number' && typeof contact.location.longitude === 'number') {
            sanitizedContact.location = {
                latitude: contact.location.latitude,
                longitude: contact.location.longitude,
                accuracy: contact.location.accuracy || null,
                timestamp: contact.location.timestamp || new Date().toISOString()
            };
        }
    }

    // Handle dynamic contact details (for business card scanner)
    if (contact.details && Array.isArray(contact.details)) {
        sanitizedContact.details = contact.details
            .filter(detail => detail && detail.label && detail.value)
            .map(detail => ({
                label: detail.label.trim(),
                value: detail.value.trim(),
                type: detail.type || 'custom'
            }));
    }

    // Handle shared contact data
    if (contact.isSharedContact) {
        sanitizedContact.isSharedContact = true;
        sanitizedContact.canEdit = contact.canEdit || false;
        if (contact.sharedBy) {
            sanitizedContact.sharedBy = contact.sharedBy;
        }
        if (contact.sharedAt) {
            sanitizedContact.sharedAt = contact.sharedAt;
        }
    }

    // Handle source information
    if (contact.source) {
        sanitizedContact.source = contact.source;
    }

    return sanitizedContact;
}

function validateContactsArray(contacts) {
    if (!Array.isArray(contacts)) {
        throw new Error("Contacts must be an array");
    }

    if (contacts.length > 1000) {
        throw new Error("Cannot have more than 1000 contacts");
    }

    const seenIds = new Set();
    const seenEmails = new Set();

    return contacts.map(contact => {
        const validatedContact = validateContactData(contact);
        
        // Check for duplicate IDs
        if (seenIds.has(validatedContact.id)) {
            throw new Error(`Duplicate contact ID found: ${validatedContact.id}`);
        }
        seenIds.add(validatedContact.id);

        // Check for duplicate emails (warn but don't fail)
        if (seenEmails.has(validatedContact.email)) {
            console.warn(`Duplicate email found: ${validatedContact.email}`);
        }
        seenEmails.add(validatedContact.email);

        return validatedContact;
    });
}

// ✅ GET endpoint to fetch user's contacts
export async function GET(request) {
    try {
        console.log('📥 GET /api/user/contacts - Fetching user contacts');

      const subscriptionCheck = await checkContactSubscription(request, CONTACT_FEATURES.BASIC_CONTACTS);

if (!subscriptionCheck.success) {
    return NextResponse.json({
        error: subscriptionCheck.error,
        subscriptionRequired: subscriptionCheck.subscriptionRequired || false,
        currentPlan: subscriptionCheck.currentPlan,
        requiredPlan: subscriptionCheck.requiredPlan,
        upgradeMessage: subscriptionCheck.upgradeMessage
    }, { status: subscriptionCheck.status });
}

const { userId: uid, subscriptionLevel } = subscriptionCheck;

        // --- 2. Rate Limiting ---
        if (!rateLimit(uid, 50, 60000)) { // 50 requests per minute for reads
            return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 3. Parse Query Parameters ---
        const url = new URL(request.url);
        const status = url.searchParams.get('status'); // Filter by status
        const search = url.searchParams.get('search'); // Search term
        const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 1000);
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        // --- 4. Fetch User Contacts ---
        const contactsRef = adminDb.collection('Contacts').doc(uid);
        const contactsDoc = await contactsRef.get();

        if (!contactsDoc.exists) {
            console.log('❌ No contacts document found for UID:', uid);
            return NextResponse.json({ 
                success: true, 
                contacts: [],
                count: 0,
                totalCount: 0,
                locationStats: {
                    total: 0,
                    withLocation: 0,
                    withoutLocation: 0
                }
            });
        }

        const contactsData = contactsDoc.data();
        let contacts = contactsData.contacts || [];

        // --- 5. Apply Filters ---
        if (status && status !== 'all') {
            contacts = contacts.filter(contact => contact.status === status);
        }

        if (search && search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            contacts = contacts.filter(contact => 
                contact.name.toLowerCase().includes(searchTerm) ||
                contact.email.toLowerCase().includes(searchTerm) ||
                (contact.company && contact.company.toLowerCase().includes(searchTerm))
            );
        }

        // --- 6. Calculate Location Statistics ---
        const totalContacts = contactsData.contacts || [];
        const locationStats = {
            total: totalContacts.length,
            withLocation: totalContacts.filter(c => c.location && c.location.latitude).length,
            withoutLocation: totalContacts.filter(c => !c.location || !c.location.latitude).length
        };

        // --- 7. Apply Pagination ---
        const totalCount = contacts.length;
        const paginatedContacts = contacts.slice(offset, offset + limit);

        console.log('✅ Contacts fetched successfully:', {
            total: totalCount,
            returned: paginatedContacts.length,
            withLocation: locationStats.withLocation
        });
        
        return NextResponse.json({ 
            success: true, 
            contacts: paginatedContacts,
            count: paginatedContacts.length,
            totalCount: totalCount,
            locationStats: locationStats,
            pagination: {
                limit,
                offset,
                hasMore: offset + limit < totalCount
            },
             // AJOUTER CETTE LIGNE :
    subscriptionInfo: {
        level: subscriptionLevel,
        hasAccess: true
    }
        });

    } catch (error) {
        console.error("💥 API Error in GET /api/user/contacts:", error.message);
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

// ✅ POST endpoint to create or update contacts
export async function POST(request) {
    try {
        console.log('📤 POST /api/user/contacts - Creating/updating contacts');

        // --- 1. Subscription Check and Auth ---
        // MODIFICATION: Check subscription first, as it also handles authentication.
        const subscriptionCheck = await checkContactSubscription(request, CONTACT_FEATURES.BASIC_CONTACTS);

        if (!subscriptionCheck.success) {
            return NextResponse.json({
                error: subscriptionCheck.error,
                subscriptionRequired: subscriptionCheck.subscriptionRequired || false,
                currentPlan: subscriptionCheck.currentPlan,
                requiredPlan: subscriptionCheck.requiredPlan,
                upgradeMessage: subscriptionCheck.upgradeMessage
            }, { status: subscriptionCheck.status });
        }

        // MODIFICATION: Get uid and subscriptionLevel from the successful check.
        const { userId: uid, subscriptionLevel } = subscriptionCheck;


        // --- 2. CSRF Protection ---
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000'];
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }

        // --- 3. Rate Limiting ---
        if (!rateLimit(uid, 30, 60000)) { // 30 updates per minute
            return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 4. Parse Request Body ---
        const body = await request.json();
        const { action, contact, contacts } = body;

        let result;

        // MODIFICATION: Pass `subscriptionLevel` to each helper function.
        switch (action) {
            case 'create':
                result = await createContact(uid, contact, subscriptionLevel);
                break;
            case 'update':
                result = await updateContact(uid, contact, subscriptionLevel);
                break;
            case 'delete':
                result = await deleteContact(uid, contact.id, subscriptionLevel);
                break;
            case 'bulkUpdate':
                result = await bulkUpdateContacts(uid, contacts, subscriptionLevel);
                break;
            case 'updateStatus':
                result = await updateContactStatus(uid, contact.id, contact.status, subscriptionLevel);
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("💥 API Error in POST /api/user/contacts:", error.message);
        
        if (error.message.includes("Invalid") || error.message.includes("required") || error.message.includes("Duplicate")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 }, );
    }
}

// --- Helper Functions ---
// MODIFICATION: Add `subscriptionLevel` as a parameter.
async function createContact(uid, contactData, subscriptionLevel) {
    const validatedContact = validateContactData(contactData);
    
    const contactsRef = adminDb.collection('Contacts').doc(uid);
    const contactsDoc = await contactsRef.get();
    
    let contacts = [];
    if (contactsDoc.exists) {
        contacts = contactsDoc.data().contacts || [];
    }
    
    // Check for duplicate email
    const existingContact = contacts.find(c => c.email === validatedContact.email);
    if (existingContact && !validatedContact.isSharedContact) {
        throw new Error(`Contact with email ${validatedContact.email} already exists`);
    }
    
    contacts.unshift(validatedContact); // Add to beginning
    
    await contactsRef.set({
        contacts,
        lastUpdated: new Date().toISOString(),
        totalContacts: contacts.length
    }, { merge: true });
    
    console.log('✅ Contact created successfully:', validatedContact.id);
    
    // MODIFICATION: Add `subscriptionInfo` to the return object.
    return {
        success: true,
        message: 'Contact created successfully',
        contact: validatedContact,
        subscriptionInfo: {
            level: subscriptionLevel,
            hasAccess: true
        }
    };
}

// MODIFICATION: Add `subscriptionLevel` as a parameter.
async function updateContact(uid, contactData, subscriptionLevel) {
    const validatedContact = validateContactData(contactData);
    
    const contactsRef = adminDb.collection('Contacts').doc(uid);
    const contactsDoc = await contactsRef.get();
    
    if (!contactsDoc.exists) {
        throw new Error('No contacts found');
    }
    
    const contacts = contactsDoc.data().contacts || [];
    const contactIndex = contacts.findIndex(c => c.id === validatedContact.id);
    
    if (contactIndex === -1) {
        throw new Error('Contact not found');
    }
    
    // Check if contact is shared and user can edit
    const existingContact = contacts[contactIndex];
    if (existingContact.isSharedContact && !existingContact.canEdit) {
        throw new Error('Cannot edit shared contact');
    }
    
    contacts[contactIndex] = validatedContact;
    
    await contactsRef.update({
        contacts,
        lastUpdated: new Date().toISOString()
    });
    
    console.log('✅ Contact updated successfully:', validatedContact.id);
    
    // MODIFICATION: Add `subscriptionInfo` to the return object.
    return {
        success: true,
        message: 'Contact updated successfully',
        contact: validatedContact,
        subscriptionInfo: {
            level: subscriptionLevel,
            hasAccess: true
        }
    };
}

// MODIFICATION: Add `subscriptionLevel` as a parameter.
async function deleteContact(uid, contactId, subscriptionLevel) {
    const contactsRef = adminDb.collection('Contacts').doc(uid);
    const contactsDoc = await contactsRef.get();
    
    if (!contactsDoc.exists) {
        throw new Error('No contacts found');
    }
    
    const contacts = contactsDoc.data().contacts || [];
    const contactIndex = contacts.findIndex(c => c.id === contactId);
    
    if (contactIndex === -1) {
        throw new Error('Contact not found');
    }
    
    // Check if contact is shared and user can delete
    const existingContact = contacts[contactIndex];
    if (existingContact.isSharedContact && !existingContact.canEdit) {
        throw new Error('Cannot delete shared contact');
    }
    
    contacts.splice(contactIndex, 1);
    
    await contactsRef.update({
        contacts,
        lastUpdated: new Date().toISOString(),
        totalContacts: contacts.length
    });
    
    console.log('✅ Contact deleted successfully:', contactId);
    
    // MODIFICATION: Add `subscriptionInfo` to the return object.
    return {
        success: true,
        message: 'Contact deleted successfully',
        subscriptionInfo: {
            level: subscriptionLevel,
            hasAccess: true
        }
    };
}

// MODIFICATION: Add `subscriptionLevel` as a parameter.
async function updateContactStatus(uid, contactId, newStatus, subscriptionLevel) {
    const contactsRef = adminDb.collection('Contacts').doc(uid);
    const contactsDoc = await contactsRef.get();
    
    if (!contactsDoc.exists) {
        throw new Error('No contacts found');
    }
    
    const contacts = contactsDoc.data().contacts || [];
    const contactIndex = contacts.findIndex(c => c.id === contactId);
    
    if (contactIndex === -1) {
        throw new Error('Contact not found');
    }
    
    contacts[contactIndex].status = newStatus;
    contacts[contactIndex].lastModified = new Date().toISOString();
    
    await contactsRef.update({
        contacts,
        lastUpdated: new Date().toISOString()
    });
    
    console.log('✅ Contact status updated successfully:', contactId, newStatus);
    
    // MODIFICATION: Add `subscriptionInfo` to the return object.
    return {
        success: true,
        message: 'Contact status updated successfully',
        subscriptionInfo: {
            level: subscriptionLevel,
            hasAccess: true
        }
    };
}
// MODIFICATION: Add `subscriptionLevel` as a parameter.
async function bulkUpdateContacts(uid, contactsData, subscriptionLevel) {
    const validatedContacts = validateContactsArray(contactsData);
    
    const contactsRef = adminDb.collection('Contacts').doc(uid);
    
    await contactsRef.set({
        contacts: validatedContacts,
        lastUpdated: new Date().toISOString(),
        totalContacts: validatedContacts.length
    }, { merge: true });
    
    console.log('✅ Bulk contacts update successful:', validatedContacts.length, 'contacts');
    
    // MODIFICATION: Add `subscriptionInfo` to the return object.
    return {
        success: true,
        message: 'Contacts updated successfully',
        count: validatedContacts.length,
        subscriptionInfo: {
            level: subscriptionLevel,
            hasAccess: true
        }
    };
}