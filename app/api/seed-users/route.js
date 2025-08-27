// app/api/seed-users/route.js - Fixed for Your Firebase Setup
import { collection, doc, writeBatch, getDocs, query, where } from "firebase/firestore";
import { fireApp } from "@/important/firebase"; // This is already the Firestore instance

// Generate realistic user data
const generateUserData = (index) => {
    const usernames = [
        'alex', 'sarah', 'mike', 'emma', 'john', 'lisa', 'david', 'maria', 
        'chris', 'anna', 'james', 'lucy', 'tom', 'kate', 'ben', 'nina',
        'sam', 'zoe', 'max', 'ivy', 'luke', 'mia', 'noah', 'eva', 'owen',
        'ava', 'ryan', 'lea', 'jack', 'amy', 'finn', 'sue', 'dean', 'joy',
        'cole', 'fay', 'drew', 'sky', 'gray', 'mae', 'seth', 'ida', 'joel',
        'rue', 'knox', 'bay', 'reed', 'gem', 'cruz', 'wren', 'blake', 'sage'
    ];
    
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'test.com'];
    const adjectives = ['cool', 'super', 'awesome', 'happy', 'smart', 'creative', 'funny', 'bright', 'swift', 'bold'];
    
    const baseUsername = usernames[index % usernames.length];
    const adjective = adjectives[index % adjectives.length];
    const randomNum = String(index + 1).padStart(3, '0');
    
    const username = `${adjective}${baseUsername}${randomNum}`;
    const email = `${username}@${domains[index % domains.length]}`;
    const displayName = `${adjective.charAt(0).toUpperCase() + adjective.slice(1)} ${baseUsername.charAt(0).toUpperCase() + baseUsername.slice(1)}`;
    
    return {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        displayName: displayName,
        bio: `Hi! I'm ${displayName}, a test user for performance testing. User #${index + 1}`,
        profilePhoto: '',
        themeFontColor: '#000000',
        selectedTheme: 'Lake White',
        backgroundType: 'Flat Colour',
        backgroundColor: '#e8edf5',
        gradientDirection: 0,
        btnType: 0,
        btnColor: '#ffffff',
        btnFontColor: '#000000',
        btnShadowColor: '#000000',
        fontType: 1,
        sensitiveStatus: false,
        sensitivetype: 3,
        supportBannerStatus: false,
        supportBanner: 0,
        socialPosition: 0,
        metaData: {
            title: `${displayName} - My Links`,
            description: `Check out ${displayName}'s links and social media`
        },
        links: [
            {
                id: `link_${index}_1`,
                title: 'My Website',
                url: `https://${username}.example.com`,
                type: 1,
                isActive: true
            },
            {
                id: `link_${index}_2`,
                title: 'Contact Me',
                url: `mailto:${email}`,
                type: 1,
                isActive: true
            },
            {
                id: `link_${index}_3`,
                title: 'About Me',
                url: '#',
                type: 0, // Header type
                isActive: true
            }
        ],
        socials: [
            {
                type: 0, // Instagram
                value: username,
                active: true
            },
            {
                type: 1, // Twitter  
                value: username,
                active: true
            },
            {
                type: 2, // LinkedIn
                value: username,
                active: false
            }
        ],
        isTestUser: true, // Mark for easy cleanup
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        testUserIndex: index + 1
    };
};

// POST - Create test users
export async function POST(request) {
    console.log('📝 POST /api/seed-users called');
    
    try {
        // Parse request body
        const body = await request.json();
        const { count = 100, batchSize = 25 } = body;
        
        console.log(`🌱 Starting to create ${count} test users...`);
        console.log('🔍 Firebase connection check:', fireApp ? 'Connected' : 'Not connected');
        
        let successCount = 0;
        let errorCount = 0;
        const createdUsers = [];
        
        // Process in batches
        for (let i = 0; i < count; i += batchSize) {
            const batch = writeBatch(fireApp);
            const currentBatchSize = Math.min(batchSize, count - i);
            
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(count/batchSize)} (${currentBatchSize} users)`);
            
            for (let j = i; j < i + currentBatchSize; j++) {
                try {
                    const userData = generateUserData(j);
                    const userId = `test_user_${String(j + 1).padStart(3, '0')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    
                    const userDocRef = doc(fireApp, 'AccountData', userId);
                    batch.set(userDocRef, {
                        ...userData,
                        uid: userId
                    });
                    
                    createdUsers.push({
                        index: j + 1,
                        username: userData.username,
                        email: userData.email,
                        displayName: userData.displayName
                    });
                    
                } catch (error) {
                    console.error(`❌ Error preparing user ${j + 1}:`, error);
                    errorCount++;
                }
            }
            
            try {
                await batch.commit();
                console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} committed successfully`);
                successCount += currentBatchSize;
            } catch (error) {
                console.error(`❌ Error committing batch ${Math.floor(i/batchSize) + 1}:`, error);
                console.error('Batch commit error details:', error);
                errorCount += currentBatchSize;
            }
            
            // Small delay between batches
            if (i + batchSize < count) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Sample usernames for testing
        const sampleUsernames = createdUsers.slice(0, 10).map(user => user.username);
        
        console.log(`🎉 Successfully created ${successCount} test users`);
        console.log('Sample usernames:', sampleUsernames);
        
        return new Response(JSON.stringify({
            success: true,
            message: `Successfully created ${successCount} test users`,
            stats: {
                totalRequested: count,
                successCount,
                errorCount,
                sampleUsernames
            },
            createdUsers: createdUsers.slice(0, 20) // Return first 20 for reference
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
    } catch (error) {
        console.error('❌ Error in seed-users API:', error);
        console.error('Full error stack:', error.stack);
        
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

// GET - Get information about test users
export async function GET(request) {
    console.log('📊 GET /api/seed-users called');
    
    try {
        console.log('🔍 Checking for test users in database...');
        
        const testUsersRef = collection(fireApp, 'AccountData');
        const q = query(testUsersRef, where('isTestUser', '==', true));
        const snapshot = await getDocs(q);
        
        console.log(`📊 Found ${snapshot.size} test users in database`);
        
        const testUsers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            testUsers.push({
                id: doc.id,
                username: data.username,
                email: data.email,
                displayName: data.displayName,
                createdAt: data.createdAt,
                testUserIndex: data.testUserIndex
            });
        });
        
        // Sort by test user index
        testUsers.sort((a, b) => (a.testUserIndex || 0) - (b.testUserIndex || 0));
        
        const sampleUsernames = testUsers.slice(0, 10).map(user => user.username);
        console.log('Sample usernames found:', sampleUsernames);
        
        return new Response(JSON.stringify({
            success: true,
            count: testUsers.length,
            testUsers: testUsers.slice(0, 50), // Return first 50
            sampleUsernames: sampleUsernames
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
    } catch (error) {
        console.error('❌ Error getting test users:', error);
        console.error('Full error details:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            details: error.toString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}

// DELETE - Clean up test users
export async function DELETE(request) {
    console.log('🗑️ DELETE /api/seed-users called');
    
    try {
        console.log('🧹 Starting cleanup of test users...');
        
        const testUsersRef = collection(fireApp, 'AccountData');
        const q = query(testUsersRef, where('isTestUser', '==', true));
        const snapshot = await getDocs(q);
        
        console.log(`Found ${snapshot.size} test users to delete`);
        
        if (snapshot.empty) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No test users found to delete',
                deletedCount: 0
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }
        
        // Delete in batches
        const batchSize = 25;
        let deletedCount = 0;
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(fireApp);
            const currentBatch = docs.slice(i, i + batchSize);
            
            currentBatch.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            deletedCount += currentBatch.length;
            
            console.log(`🗑️ Deleted batch ${Math.floor(i/batchSize) + 1} (${currentBatch.length} users)`);
            
            // Small delay between batches
            if (i + batchSize < docs.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        console.log(`🎉 Successfully deleted ${deletedCount} test users`);
        
        return new Response(JSON.stringify({
            success: true,
            message: `Successfully deleted ${deletedCount} test users`,
            deletedCount
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
    } catch (error) {
        console.error('❌ Error deleting test users:', error);
        console.error('Full error details:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            details: error.toString()
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}