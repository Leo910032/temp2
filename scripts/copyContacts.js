// scripts/copyContacts.js
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables FIRST
dotenv.config({ path: join(__dirname, '..', '.env') });

// Now initialize Firebase Admin directly in this script
let db;

try {
  // Check if required env vars exist
  const requiredVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL'
  ];
  
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing);
    console.error('\nPlease check your .env.local file contains these variables');
    process.exit(1);
  }

  // Initialize Firebase Admin
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
  }

  db = admin.firestore();
  console.log('Firebase Admin initialized successfully\n');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const SOURCE_USER_ID = 'XHw4Ii5Z8xgggSNJ8K8jkzO6DSZ2';
const TARGET_USER_ID = 'rfGX8GX9Y3gv3SKbkiERPFym72r1';

async function copyContacts() {
  console.log('Starting contact copy operation...');
  console.log(`Source user: ${SOURCE_USER_ID}`);
  console.log(`Target user: ${TARGET_USER_ID}\n`);

  try {
    // 1. Fetch source contacts
    console.log('1. Fetching source contacts...');
    const sourceDoc = await db
      .collection('Contacts')
      .doc(SOURCE_USER_ID)
      .get();

    if (!sourceDoc.exists) {
      console.log('ERROR: Source user has no contacts document');
      return;
    }

    const sourceData = sourceDoc.data();
    const sourceContacts = sourceData?.contacts || [];

    console.log(`Found ${sourceContacts.length} contacts in source\n`);

    if (sourceContacts.length === 0) {
      console.log('No contacts to copy');
      return;
    }

    // Log first contact as sample
    console.log('Sample contact:');
    console.log(JSON.stringify(sourceContacts[0], null, 2));
    console.log('');

    // 2. Check target user
    console.log('2. Checking target user...');
    const targetDoc = await db
      .collection('Contacts')
      .doc(TARGET_USER_ID)
      .get();

    const targetExists = targetDoc.exists;
    const existingContacts = targetExists ? (targetDoc.data()?.contacts || []) : [];

    console.log(`Target user ${targetExists ? 'exists' : 'does not exist'}`);
    console.log(`Existing contacts in target: ${existingContacts.length}\n`);

    // 3. Copy contacts
    console.log('3. Copying contacts...');
    
    const targetRef = db.collection('Contacts').doc(TARGET_USER_ID);
    
    if (!targetExists) {
      await targetRef.set({
        contacts: sourceContacts,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log('Created new contacts document');
    } else {
      await targetRef.update({
        contacts: [...existingContacts, ...sourceContacts],
        updatedAt: new Date().toISOString()
      });
      console.log('Appended contacts to existing document');
    }

    // 4. Verify
    console.log('\n4. Verifying copy...');
    const verifyDoc = await db
      .collection('Contacts')
      .doc(TARGET_USER_ID)
      .get();

    const verifyData = verifyDoc.data();
    const finalContacts = verifyData?.contacts || [];

    console.log(`Final contact count in target: ${finalContacts.length}`);
    console.log(`Expected count: ${existingContacts.length + sourceContacts.length}\n`);

    if (finalContacts.length === existingContacts.length + sourceContacts.length) {
      console.log('SUCCESS! All contacts copied successfully\n');
    } else {
      console.log('Warning: Contact count mismatch\n');
    }

    // Summary
    console.log('SUMMARY:');
    console.log(`  Source contacts: ${sourceContacts.length}`);
    console.log(`  Previous target contacts: ${existingContacts.length}`);
    console.log(`  Final target contacts: ${finalContacts.length}`);
    console.log(`  Contacts copied: ${sourceContacts.length}`);

  } catch (error) {
    console.error('\nERROR during copy operation:', error);
    console.error(error.stack);
    throw error;
  }
}

// Run the script
copyContacts()
  .then(() => {
    console.log('\nScript completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error.message);
    process.exit(1);
  });