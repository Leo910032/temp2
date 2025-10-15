// app/api/debug/check-contact/route.js
// Diagnostic endpoint to check what's actually in Firestore

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const contactId = searchParams.get('contactId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Read the Contacts document
    const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();

    if (!contactsDoc.exists) {
      return NextResponse.json({ error: 'No contacts found for user' }, { status: 404 });
    }

    const data = contactsDoc.data();
    const contacts = data.contacts || [];

    // Find specific contact if ID provided
    let contactToCheck = null;
    if (contactId) {
      contactToCheck = contacts.find(c => c.id === contactId);
      if (!contactToCheck) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
    } else {
      // Get the first contact
      contactToCheck = contacts[0];
    }

    if (!contactToCheck) {
      return NextResponse.json({ error: 'No contacts in array' }, { status: 404 });
    }

    // Detailed analysis of the contact
    const analysis = {
      contactId: contactToCheck.id,
      contactName: contactToCheck.name,
      contactEmail: contactToCheck.email,

      // Dynamic fields analysis
      dynamicFields: {
        value: contactToCheck.dynamicFields,
        type: typeof contactToCheck.dynamicFields,
        isArray: Array.isArray(contactToCheck.dynamicFields),
        length: contactToCheck.dynamicFields?.length,
        constructor: contactToCheck.dynamicFields?.constructor?.name,

        // If it's an array, check each element
        elements: Array.isArray(contactToCheck.dynamicFields)
          ? contactToCheck.dynamicFields.map((item, idx) => ({
              index: idx,
              value: item,
              type: typeof item,
              isObject: typeof item === 'object' && item !== null,
              keys: typeof item === 'object' && item !== null ? Object.keys(item) : null
            }))
          : null,

        // Check if it has non-index properties (indicates it's being treated as object)
        objectProperties: (() => {
          if (!contactToCheck.dynamicFields) return null;
          const props = Object.keys(contactToCheck.dynamicFields);
          // Filter out numeric indices
          const nonIndexProps = props.filter(key => isNaN(parseInt(key)));
          return nonIndexProps.length > 0 ? nonIndexProps : null;
        })(),

        // Get all own properties including numeric
        allProperties: contactToCheck.dynamicFields
          ? Object.getOwnPropertyNames(contactToCheck.dynamicFields)
          : null
      },

      // Root level fields
      rootFields: {
        id: contactToCheck.id,
        name: contactToCheck.name,
        email: contactToCheck.email,
        phone: contactToCheck.phone,
        company: contactToCheck.company,
        jobTitle: contactToCheck.jobTitle,
        website: contactToCheck.website,
        message: contactToCheck.message,
        status: contactToCheck.status,
        source: contactToCheck.source,
        lastModified: contactToCheck.lastModified,
        submittedAt: contactToCheck.submittedAt
      },

      // Full contact object
      fullContact: contactToCheck,

      // Raw JSON
      rawJSON: JSON.stringify(contactToCheck, null, 2)
    };

    return NextResponse.json(analysis, { status: 200 });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
