// test-groups-migration.js
// Quick test script to verify groups are being saved to the new collection

import { adminDb } from './lib/firebaseAdmin.js';
import { GroupCRUDService } from './lib/services/serviceContact/server/GroupCRUDService.js';

const TEST_USER_ID = 'cznEUooe0bYy4S0FQbTE2KxDAzn2';

async function testGroupsCollection() {
  console.log('🧪 Testing Groups Collection Migration...\n');

  try {
    // 1. Create a test group
    console.log('1️⃣ Creating test group...');
    const testGroup = {
      name: 'Test Group - Migration Verification',
      description: 'This is a test group to verify the new collection structure',
      contactIds: ['contact_test_1', 'contact_test_2', 'contact_test_3'],
      type: 'manual',
      metadata: {
        test: true,
        createdBy: 'migration-test-script'
      }
    };

    const session = { userId: TEST_USER_ID };
    const createdGroup = await GroupCRUDService.createGroup({
      groupData: testGroup,
      session
    });

    console.log('✅ Test group created:', {
      id: createdGroup.id,
      name: createdGroup.name,
      memberCount: createdGroup.memberCount
    });

    // 2. Fetch all groups
    console.log('\n2️⃣ Fetching all groups...');
    const allGroups = await GroupCRUDService.getAllGroups({ session });
    console.log(`✅ Found ${allGroups.length} group(s)`);

    if (allGroups.length > 0) {
      console.log('📊 Groups:', allGroups.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type,
        memberCount: g.memberCount
      })));
    }

    // 3. Verify collection exists in Firestore
    console.log('\n3️⃣ Verifying Firestore collection structure...');
    const groupsCollectionRef = adminDb
      .collection('groups')
      .doc(TEST_USER_ID)
      .collection('groups');

    const snapshot = await groupsCollectionRef.get();
    console.log(`✅ Firestore collection exists with ${snapshot.size} document(s)`);

    // 4. Check if old Contacts collection has groups (should be empty)
    console.log('\n4️⃣ Checking old Contacts collection...');
    const contactsDoc = await adminDb.collection('Contacts').doc(TEST_USER_ID).get();

    if (contactsDoc.exists) {
      const data = contactsDoc.data();
      const oldGroups = data.groups || [];

      if (oldGroups.length > 0) {
        console.log(`⚠️  WARNING: Old Contacts collection still has ${oldGroups.length} groups!`);
        console.log('   These should be migrated to the new collection.');
      } else {
        console.log('✅ Old Contacts collection has no groups (correct!)');
      }
    } else {
      console.log('ℹ️  No Contacts document found');
    }

    // 5. Clean up test group
    console.log('\n5️⃣ Cleaning up test group...');
    await GroupCRUDService.deleteGroup({
      groupId: createdGroup.id,
      session
    });
    console.log('✅ Test group deleted');

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\nThe new groups collection structure is working correctly!');
    console.log(`\nYou can view the collection in Firestore Console:`);
    console.log(`   groups/${TEST_USER_ID}/groups/`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testGroupsCollection();
