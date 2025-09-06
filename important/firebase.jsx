// File: important/firebase.jsx

// Import the functions you need from the CLIENT SDKs
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration (using NEXT_PUBLIC_ prefixes)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_apiKey,
    authDomain: process.env.NEXT_PUBLIC_authDomain,
    projectId: process.env.NEXT_PUBLIC_projectId,
    storageBucket: process.env.NEXT_PUBLIC_storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_messagingSenderId,
    appId: process.env.NEXT_PUBLIC_appId,
    measurementId: process.env.NEXT_PUBLIC_measurementId,
};

// Initialize Firebase Client App
let app;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

// Initialize Client Services
export const fireApp = getFirestore(app);
export const appStorage = getStorage(app);
export const auth = getAuth(app);
// ✅ ADD THIS LINE TO FIX THE EXPORT PROBLEM
export { app };