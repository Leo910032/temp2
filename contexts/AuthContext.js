  //contexts/AuthContext.js - FIXED VERSION with Token Caching
  "use client"
  import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
  import { 
    onAuthStateChanged, 
    signOut,
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    sendPasswordResetEmail,
    signInWithCustomToken
  } from 'firebase/auth';
  import { auth, fireApp } from '@/important/firebase';
  import { useRouter, usePathname } from 'next/navigation';
  import { collection, doc, setDoc, getDocs, query, where, getDoc } from "firebase/firestore";

  // Create the authentication context
  const AuthContext = createContext();

  /**
   * Custom hook to use the AuthContext.
   */
  export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
  }

  /**
   * Provides authentication state and functions to the entire app.
   */
  export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    
    // ✅ ADD: Token caching to prevent quota exceeded errors
    const tokenCache = useRef({
      token: null,
      expiresAt: 0,
      refreshPromise: null
    });

    /**
     * ✅ NEW: Get cached or fresh token to prevent quota exceeded errors
     */
    const getValidToken = useCallback(async (forceRefresh = false) => {
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const now = Date.now();
      const cache = tokenCache.current;

      // Return cached token if still valid and not forcing refresh
      if (!forceRefresh && cache.token && now < cache.expiresAt) {
        return cache.token;
      }

      // If there's already a refresh in progress, wait for it
      if (cache.refreshPromise) {
        return cache.refreshPromise;
      }

      // Start new token refresh
      cache.refreshPromise = (async () => {
        try {
          // Get token without forcing refresh to avoid quota issues
          const token = await currentUser.getIdToken(false);
          
          // Cache the token for 50 minutes (tokens expire in 1 hour)
          cache.token = token;
          cache.expiresAt = now + (50 * 60 * 1000);
          
          console.log('✅ Token refreshed and cached');
          return token;
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
          throw error;
        } finally {
          cache.refreshPromise = null;
        }
      })();

      return cache.refreshPromise;
    }, [currentUser]);

    // Listen for authentication state changes
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setLoading(false);
        
        // ✅ Clear token cache when user changes
        if (!user) {
          tokenCache.current = { token: null, expiresAt: 0, refreshPromise: null };
        }
        
        // Automatically redirect user if they are on a login/signup page while authenticated
        if (user && (pathname === '/login' || pathname === '/signup')) {
          router.push('/dashboard');
        }
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }, [router, pathname]);

    /**
     * Creates a user document in Firestore for new social sign-ins.
     */
    const createUserDocumentForSocialLogin = async (user) => {
      const userRef = doc(fireApp, "AccountData", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return; // Document already exists, do nothing.
      }
      
      // Generate a unique username from display name or email
      let username = (user.displayName || user.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '')
        .substring(0, 20);
      
      // Ensure the generated username is unique by checking the database
      const accountsRef = collection(fireApp, "AccountData");
      let baseUsername = username;
      let counter = 1;
      while (true) {
          const q = query(accountsRef, where("username", "==", username));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) break;
          username = `${baseUsername}_${counter++}`;
      }

      // Create the new document with nested structure
      await setDoc(userRef, {
        username: username,
        email: user.email,
        links: [],
        socials: [],
        profile: {
          displayName: user.displayName || user.email.split('@')[0],
          avatarUrl: user.photoURL || "",
          bio: "",
          location: ""
        },
        appearance: {
          selectedTheme: "Lake White",
          themeFontColor: "#000000",
          fontType: 0,
          backgroundColor: "#FFFFFF",
          backgroundType: "Color",
          btnColor: "#000000",
          btnFontColor: "#FFFFFF",
          btnShadowColor: "#dcdbdb",
          btnType: 0
        },
        settings: {
          isPublic: true,
          allowMessages: true,
          contactExchangeEnabled: true
        },
        createdAt: new Date(),
        emailVerified: user.emailVerified || false,
        uid: user.uid,
      });
    };

    /**
     * Signs up a new user via a secure server-side API route.
     */
    const signup = async (email, password, username) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Signup failed');
      
      // Use the custom token from the server to sign the user in securely
      await signInWithCustomToken(auth, data.customToken);
    };

    /**
     * Logs in a user via a secure server-side API route.
     */
// In contexts/AuthContext.js - replace the login function:
const login = async (usernameOrEmail, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameOrEmail, password }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  
  // Use the custom token from the server to complete the sign-in
  await signInWithCustomToken(auth, data.customToken);
};

    /**
     * Logs out the current user.
     */
    const logout = async () => {
      // Clear token cache on logout
      tokenCache.current = { token: null, expiresAt: 0, refreshPromise: null };
      await signOut(auth);
      router.push('/login');
    };

    /**
     * Sends a password reset email.
     */
    const resetPassword = async (email) => {
      await sendPasswordResetEmail(auth, email);
    };

    /**
     * Handles sign-in with Google popup.
     */
    const signInWithGoogle = async () => {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await createUserDocumentForSocialLogin(userCredential.user);
      return userCredential.user;
    };
    
    // Define the context value
    const value = {
      currentUser,
      loading,
      signup,
      login,
      logout,
      resetPassword,
      signInWithGoogle,
      getValidToken, // ✅ NEW: Expose the token caching function
    };

    return (
      <AuthContext.Provider value={value}>
        {!loading && children}
      </AuthContext.Provider>
    );
  }