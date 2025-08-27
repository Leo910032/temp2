// app/api/appearance/upload/route.js - FIXED VERSION
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';






/**
 * Handle file uploads for profile images, background images, videos, and CV documents
 * POST /api/user/appearance/upload
 */
export async function POST(request) {
    try {
        // 1. Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // 2. Parse form data
        const formData = await request.formData();
        const file = formData.get('file');
        const uploadType = formData.get('uploadType'); // 'profile', 'backgroundImage', 'backgroundVideo', 'cv'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!uploadType || !['profile', 'backgroundImage', 'backgroundVideo', 'cv'].includes(uploadType)) {
            return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 });
        }

        // 3. Validate file
        const validationResult = validateFile(file, uploadType);
        if (!validationResult.valid) {
            return NextResponse.json({ error: validationResult.error }, { status: 400 });
        }

        // 4. Generate unique filename
        const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1);
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        
        // 5. Determine storage path
        let storagePath;
        switch (uploadType) {
            case 'profile':
                storagePath = `profilePhoto/${userId}/${fileName}`;
                break;
            case 'backgroundImage':
                storagePath = `backgroundImage/${userId}/${fileName}`;
                break;
            case 'backgroundVideo':
                storagePath = `backgroundVideo/${userId}/${fileName}`;
                break;
            case 'cv':
                storagePath = `cvDocuments/${userId}/${fileName}`;
                break;
        }

        // 6. Upload to Firebase Storage
        const { initializeApp: initClientApp, getApps: getClientApps } = await import('firebase/app');
        const { getStorage: getClientStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        
        let clientApp;
        if (getClientApps().length === 0) {
            clientApp = initClientApp({
                apiKey: process.env.NEXT_PUBLIC_apiKey,
                authDomain: process.env.NEXT_PUBLIC_authDomain,
                projectId: process.env.FIREBASE_PROJECT_ID,
                storageBucket: process.env.NEXT_PUBLIC_storageBucket,
                messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
                appId: process.env.NEXT_PUBLIC_appId,
            });
        } else {
            clientApp = getClientApps()[0];
        }

        const storage = getClientStorage(clientApp);
        const storageRef = ref(storage, storagePath);
        
        // Convert file to buffer
        const fileBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);

        // Upload file
        const snapshot = await uploadBytes(storageRef, uint8Array, {
            contentType: file.type,
        });

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        // 7. Update user document with new file URL
        const docRef = adminDb.collection('AccountData').doc(userId);
        let updateData = {};

        switch (uploadType) {
            case 'profile':
                updateData.profilePhoto = downloadURL;
                break;
            case 'backgroundImage':
                updateData.backgroundImage = downloadURL;
                updateData.backgroundType = 'Image';
                break;
            case 'backgroundVideo':
                updateData.backgroundVideo = downloadURL;
                updateData.backgroundType = 'Video';
                break;
            case 'cv':
                updateData.cvDocument = {
                    url: downloadURL,
                    fileName: file.name, // Store original filename
                    uploadDate: new Date().toISOString(),
                    fileSize: file.size,
                    fileType: file.type
                };
                break;
        }

        await docRef.update(updateData);

        return NextResponse.json({
            success: true,
            downloadURL,
            fileName: uploadType === 'cv' ? file.name : fileName,
            uploadType,
            fileInfo: uploadType === 'cv' ? {
                originalName: file.name,
                size: file.size,
                type: file.type
            } : null,
            message: 'File uploaded successfully'
        });

    } catch (error) {
        console.error('File upload error:', error);
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }

        return NextResponse.json({
            error: 'Upload failed due to a server error.',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}

/**
 * Delete uploaded files
 * DELETE /api/user/appearance/upload
 */
export async function DELETE(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { deleteType } = await request.json(); // 'profile', 'backgroundImage', 'backgroundVideo', 'cv'

        if (!deleteType || !['profile', 'backgroundImage', 'backgroundVideo', 'cv'].includes(deleteType)) {
            return NextResponse.json({ error: 'Invalid delete type' }, { status: 400 });
        }

        // Update user document to remove file reference
        const docRef = adminDb.collection('AccountData').doc(userId);
        let updateData = {};

        switch (deleteType) {
            case 'profile':
                updateData.profilePhoto = '';
                break;
            case 'backgroundImage':
                updateData.backgroundImage = '';
                break;
            case 'backgroundVideo':
                updateData.backgroundVideo = '';
                break;
            case 'cv':
                updateData.cvDocument = null;
                break;
        }

        await docRef.update(updateData);

        return NextResponse.json({
            success: true,
            message: 'File reference removed successfully'
        });

    } catch (error) {
        console.error('File delete error:', error);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}

// Helper function to validate files
function validateFile(file, uploadType) {
    const maxSizes = {
        profile: 5 * 1024 * 1024,        // 5MB for profile images
        backgroundImage: 10 * 1024 * 1024, // 10MB for background images
        backgroundVideo: 50 * 1024 * 1024, // 50MB for background videos
        cv: 50 * 1024 * 1024              // 50MB for CV documents
    };

    const allowedTypes = {
        profile: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        backgroundImage: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        backgroundVideo: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
        cv: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ]
    };

    // Check file size
    if (file.size > maxSizes[uploadType]) {
        return {
            valid: false,
            error: `File too large. Maximum size for ${uploadType} is ${Math.round(maxSizes[uploadType] / (1024 * 1024))}MB`
        };
    }

    // Check file type
    if (!allowedTypes[uploadType].includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed types for ${uploadType}: ${allowedTypes[uploadType].join(', ')}`
        };
    }

    return { valid: true };
}