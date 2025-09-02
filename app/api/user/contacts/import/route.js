// app/api/contacts/import/route.js
// Contact import API route following enterprise pattern

import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin';
import { ContactService } from '@/lib/services/serviceContact/server/contactService';
import { ContactValidationService } from '@/lib/services/serviceContact/server/contactValidationService';
import Papa from 'papaparse';

/**
 * POST /api/contacts/import - Import contacts from file
 */
export async function POST(request) {
  try {
    console.log('📥 POST /api/contacts/import - Importing contacts');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const format = formData.get('format') || 'csv';

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' }, 
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' }, 
        { status: 400 }
      );
    }

    // Parse file based on format
    let contactsData = [];
    const fileText = await file.text();

    switch (format.toLowerCase()) {
      case 'csv':
        contactsData = await parseCSVFile(fileText);
        break;
      case 'json':
        try {
          const jsonData = JSON.parse(fileText);
          contactsData = Array.isArray(jsonData) ? jsonData : [jsonData];
        } catch (error) {
          return NextResponse.json(
            { error: 'Invalid JSON format' }, 
            { status: 400 }
          );
        }
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported file format' }, 
          { status: 400 }
        );
    }

    // Validate import data
    const validation = ContactValidationService.validateImportData(contactsData);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') }, 
        { status: 400 }
      );
    }

    // Import contacts
    const result = await ContactService.importContacts(userId, contactsData, `import_${format}`);

    console.log('✅ Contacts imported successfully');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/contacts/import:', error);
    
    let status = 500;
    let errorMessage = error.message || 'Failed to import contacts';

    if (error.message?.includes('limit') || error.message?.includes('subscription')) {
      status = 402;
    } else if (error.message?.includes('Invalid') || error.message?.includes('format')) {
      status = 400;
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      }, 
      { status }
    );
  }
}

/**
 * Parse CSV file to contact data
 */
async function parseCSVFile(csvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', '\t', '|', ';'],
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        // Map CSV columns to contact fields
        const contactsData = results.data.map(row => {
          const contact = {};
          
          // Map common column variations
          Object.entries(row).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase().trim();
            
            if (lowerKey.includes('name') && !lowerKey.includes('company')) {
              contact.name = value;
            } else if (lowerKey.includes('email')) {
              contact.email = value;
            } else if (lowerKey.includes('phone') || lowerKey.includes('tel')) {
              contact.phone = value;
            } else if (lowerKey.includes('company') || lowerKey.includes('organization')) {
              contact.company = value;
            } else if (lowerKey.includes('title') || lowerKey.includes('position')) {
              contact.jobTitle = value;
            } else if (lowerKey.includes('website') || lowerKey.includes('url')) {
              contact.website = value;
            } else if (lowerKey.includes('message') || lowerKey.includes('note')) {
              contact.message = value;
            }
          });

          return contact;
        });

        resolve(contactsData);
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}