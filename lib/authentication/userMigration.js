// lib/authentication/userMigration.js
import { fireApp } from "@/important/firebase";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";

export async function migrateUserData(firebaseUser) {
  // Check if user already exists in new structure
  const userRef = doc(fireApp, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // Create new user document with Firebase Auth UID
    await setDoc(userRef, {
      email: firebaseUser.email,
      createdAt: new Date(),
      migratedAt: new Date()
    });
  }
  
  // Link to existing AccountData if username exists
  // This would require a lookup mechanism you'll need to implement
}