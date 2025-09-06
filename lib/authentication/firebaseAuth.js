// lib/authentication/firebaseAuth.js
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth, fireApp } from "@/important/firebase";
import { collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";

export const firebaseAuthService = {
  // Create account with email/password
  async createAccount(email, password, username) {
    // Check if username already exists
    const usernameExists = await this.checkUsernameExists(username);
    if (usernameExists) {
      throw new Error("Username already exists");
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update the user's display name
    await updateProfile(user, {
      displayName: username
    });

    // Create user document in Firestore
    await this.createUserDocument(user, { username });

    return user;
  },

  // Sign in with email/password (using username)
  async signIn(usernameOrEmail, password) {
    let email = usernameOrEmail;
    
    // If it's not an email, find the email by username
    if (!usernameOrEmail.includes('@')) {
      email = await this.getEmailByUsername(usernameOrEmail);
      if (!email) {
        throw new Error("Username not found");
      }
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  // Google sign in
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Check if user document exists, create if not
    await this.createUserDocument(user);

    return user;
  },

  // Password reset
  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  },

  // Sign out
  async signOut() {
    await signOut(auth);
  },

  // Helper function to check if username exists
  async checkUsernameExists(username) {
    const accountsRef = collection(fireApp, "AccountData");
    const q = query(accountsRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  },

  // Helper function to get email by username
  async getEmailByUsername(username) {
    const accountsRef = collection(fireApp, "accounts");
    const q = query(accountsRef, where("username", "==", username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return doc.data().email;
    }
    return null;
  },

  // Helper function to create user document
  async createUserDocument(user, additionalData = {}) {
    const userRef = doc(fireApp, "AccountData", user.uid);
    
    await setDoc(userRef, {
      displayName: additionalData.username || user.displayName || user.email.split('@')[0],
      username: additionalData.username || user.displayName || user.email.split('@')[0],
      email: user.email,
      links: [],
      profilePhoto: user.photoURL || "",
      selectedTheme: "Lake White",
      createdAt: new Date(),
      ...additionalData
    }, { merge: true });
  }
};