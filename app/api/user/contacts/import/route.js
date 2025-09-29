
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
//////////////////////////////////////////////////////////////////////////////////////////////////
// app/api/contacts/import/route.js
// Contact import API route following enterprise pattern

import { NextResponse } from 'next/server';
// ✅ CHANGED: Using adminAuth directly from your firebaseAdmin setup
import { adminAuth } from '@/lib/firebaseAdmin'; 
import { ContactService } from '@/lib/services/serviceContact/server/ContactCRUDService';
import Papa from 'papaparse';

/**
 * POST /api/contacts/import - Import contacts from file
 */
export async function POST(request) {
  try {
    console.log('📥 POST /api/contacts/import - Starting contact import process');

    // 1. Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // ✅ CHANGED: Using the standard adminAuth.verifyIdToken method
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // 2. Parse form data and get the file
    const formData = await request.formData();
    const file = formData.get('file');
    const format = formData.get('format') || 'csv';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // 3. Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // 4. Parse file content into a raw array of objects
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
          return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
        }
        break;
      default:
        return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });
    }
    
    // 5. Import contacts using the service layer
    // The ContactService will handle the strict validation for each row.
    const result = await ContactService.importContacts(userId, contactsData, `import_${format}`);

    console.log('✅ Import process completed by service. Sending result to client.');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Critical Error in POST /api/contacts/import:', error);
    
    // Check if the error is a Firebase Auth error
    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    let status = 500;
    let errorMessage = error.message || 'Failed to import contacts due to a server error.';

    if (error.message?.includes('limit') || error.message?.includes('subscription')) {
      status = 402; // Payment Required
    } else if (error.message?.includes('Invalid') || error.message?.includes('format')) {
      status = 400; // Bad Request
    }

    return NextResponse.json({ error: errorMessage, success: false }, { status });
  }
}

/**
 * Parse CSV file to a raw array of objects.
 */
async function parseCSVFile(csvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }
        resolve(results.data);
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      }
    });
  });
}