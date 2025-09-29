// lib/services/client/authService.js
"use client";

import { auth } from '@/important/firebase';
import { 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    updateProfile,
    signInWithCustomToken  // Add this import
} from "firebase/auth";
export class AuthService {
    /**
     * Validates a username by calling the server-side API.
     * @param {string} username
     * @returns {Promise<{exists: boolean, metadata?: object}>}
     */
    static async validateUsername(username) {
        try {
            // Get auth token if user is logged in
            const authToken = await this.getAuthToken();
            
            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Add auth header if available
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch('/api/validate-username', {
                method: 'POST',
                headers,
                body: JSON.stringify({ username }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                exists: data.exists,
                metadata: {
                    authenticated: data.authenticated,
                    processingTime: data.processingTime,
                    dbQueryTime: data.dbQueryTime,
                    requestId: data.requestId
                }
            };
        } catch (error) {
            console.error('AuthService: Username validation failed:', error);
            throw error;
        }
    }

    /**
     * Gets the current user's Firebase ID token
     * @returns {Promise<string|null>}
     */
    static async getAuthToken() {
        try {
            const user = auth.currentUser;
            if (user) {
                return await user.getIdToken(true); // Force refresh
            }
            return null;
        } catch (error) {
            console.error('AuthService: Error getting auth token:', error);
            return null;
        }
    }


    
   /**
 * ✅ FIXED: Signs a user in with Google and ensures server-side user document exists.
 * @returns {Promise<UserCredential>}
 */
static async signInWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        const userCredential = await signInWithPopup(auth, provider);
        
        // ✅ NEW: Call server-side API to ensure Firestore document exists
        try {
            const authToken = await userCredential.user.getIdToken();
            
            const response = await fetch('/api/auth/google-signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    emailVerified: userCredential.user.emailVerified
                }),
            });

            if (!response.ok) {
                console.error('Failed to create/update user document on server');
                // Don't throw here - user is still signed in, just log the error
            } else {
                const data = await response.json();
                console.log('Server-side user document created/updated successfully');
            }
            
        } catch (error) {
            console.error('Failed to sync user with server:', error);
            // Don't throw - user authentication was successful
        }
        
        return userCredential;
    } catch (error) {
        console.error('AuthService: Google sign-in failed:', error);
        throw this.formatFirebaseError(error);
    }
}
    /**
     * Creates a new user account via the server-side API.
     * @param {object} userData - { email, password, username }
     * @returns {Promise<{success: boolean, customToken: string, uid: string}>}
     */
    static async createStandardUser(userData) {
        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            return {
                success: data.success,
                customToken: data.customToken,
                uid: data.uid,
                user: data.user,
                metadata: {
                    processingTime: data.processingTime,
                    requestId: data.requestId
                }
            };
        } catch (error) {
            console.error('AuthService: User creation failed:', error);
            throw error;
        }
    }

    /**
     * Signs out the current user
     * @returns {Promise<void>}
     */
    static async logout() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('AuthService: Logout failed:', error);
            throw this.formatFirebaseError(error);
        }
    }

    /**
     * Sends a password reset email
     * @param {string} email
     * @returns {Promise<void>}
     */
    static async sendPasswordReset(email) {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            console.error('AuthService: Password reset failed:', error);
            throw this.formatFirebaseError(error);
        }
    }

    /**
     * Gets the email associated with a username by calling the server
     * @param {string} username
     * @returns {Promise<string|null>}
     */
    static async getEmailByUsername(username) {
        try {
            const authToken = await this.getAuthToken();
            
            const headers = {
                'Content-Type': 'application/json',
            };
            
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await fetch('/api/user/get-email-by-username', {
                method: 'POST',
                headers,
                body: JSON.stringify({ username }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null; // Username not found
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.email;
        } catch (error) {
            console.error('AuthService: Get email by username failed:', error);
            return null;
        }
    }

    /**
     * Creates user profile on the server
     * @param {object} userData
     * @returns {Promise<void>}
     */
    static async createUserProfile(userData) {
        try {
            const authToken = await this.getAuthToken();
            
            const response = await fetch('/api/user/create-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('AuthService: Create user profile failed:', error);
            throw error;
        }
    }

    /**
     * Updates last login timestamp on the server
     * @param {string} uid
     * @returns {Promise<void>}
     */
    static async updateLastLogin(uid) {
        try {
            const authToken = await this.getAuthToken();
            
            const response = await fetch('/api/user/update-last-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ uid }),
            });

            if (!response.ok) {
                console.warn('Failed to update last login on server');
            }
        } catch (error) {
            console.warn('Failed to update last login:', error);
            // Don't throw - this is not critical
        }
    }
    /**
 * Logs in a user with username/email and password
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - Password
 * @returns {Promise<object>} - Login result with custom token and user data
 */
static async login(usernameOrEmail, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: usernameOrEmail, // Your API expects 'username' field
                password: password
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Sign in to Firebase using the custom token
        if (data.customToken) {
            const { signInWithCustomToken } = await import('firebase/auth');
            await signInWithCustomToken(auth, data.customToken);
        }

        return {
            success: true,
            user: data.user,
            customToken: data.customToken
        };
    } catch (error) {
        console.error('AuthService: Login failed:', error);
        throw error;
    }
}

    /**
     * Formats Firebase errors into user-friendly messages
     * @param {Error} error
     * @returns {Error}
     */
    static formatFirebaseError(error) {
        const errorCode = error.code;
        let message = error.message;

        switch (errorCode) {
            case 'auth/user-not-found':
                message = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password.';
                break;
            case 'auth/email-already-in-use':
                message = 'An account with this email already exists.';
                break;
            case 'auth/weak-password':
                message = 'Password should be at least 6 characters.';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/operation-not-allowed':
                message = 'This sign-in method is not enabled.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many unsuccessful attempts. Please try again later.';
                break;
            case 'auth/popup-closed-by-user':
                message = 'Sign-in was cancelled.';
                break;
            case 'auth/popup-blocked':
                message = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
                break;
            case 'auth/invalid-credential':
                message = 'Invalid credentials provided.';
                break;
            default:
                // Keep the original message for unknown errors
                break;
        }

        const formattedError = new Error(message);
        formattedError.code = errorCode;
        return formattedError;
    }

    /**
     * Gets the current user's profile data
     * @returns {Promise<object|null>}
     */
    static async getCurrentUserProfile() {
        try {
            const user = auth.currentUser;
            if (!user) {
                return null;
            }

            const authToken = await user.getIdToken();
            
            const response = await fetch('/api/user/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.user;
        } catch (error) {
            console.error('AuthService: Get current user profile failed:', error);
            return null;
        }
    }
    /**
 * Validates an email by calling the server-side API.
 * @param {string} email
 * @returns {Promise<{exists: boolean, metadata?: object}>}
 */
static async validateEmail(email) {
    try {
        const response = await fetch('/api/validate-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            exists: data.exists,
            metadata: {
                processingTime: data.processingTime,
                requestId: data.requestId
            }
        };
    } catch (error) {
        console.error('AuthService: Email validation failed:', error);
        throw error;
    }
}
/**
 * Validates an email and checks for disposable domains
 * @param {string} email
 * @param {object} options - Configuration options
 * @returns {Promise<{exists: boolean, isDisposable: boolean, metadata?: object}>}
 */
static async validateEmailWithDisposableCheck(email, options = {}) {
    const { strict = false } = options;
    
    try {
        // First do the regular email validation
        const emailResult = await this.validateEmail(email);
        
        // Then check for disposable domains
        let disposableResult = null;
        try {
            const DisposableEmailService = (await import('./disposableEmailService')).DisposableEmailService;
            disposableResult = await DisposableEmailService.isDisposableEmail(email, { strict });
        } catch (error) {
            console.warn('Disposable email check failed:', error.message);
            // Continue without disposable check rather than failing completely
        }
        
        return {
            exists: emailResult.exists,
            isDisposable: disposableResult?.isDisposable || false,
            metadata: {
                ...emailResult.metadata,
                disposableCheck: disposableResult
            }
        };
    } catch (error) {
        console.error('AuthService: Email validation with disposable check failed:', error);
        throw error;
    }
}
}