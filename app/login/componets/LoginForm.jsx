

// app/login/componets/LoginForm.jsx - Updated with Authentication
"use client"

import React, { useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { getAuth } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";

export default function LoginForm() {
    const router = useRouter();
    const { login, signInWithGoogle, currentUser } = useAuth();
    const { t, isInitialized } = useTranslation();

    // Form State
    const [seePassword, setSeePassword] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [canProceed, setCanProceed] = useState(false);

    // Debounced Values
    const debounceUsername = useDebounce(username, 800);
    const debouncePassword = useDebounce(password, 500);

    // Loading States
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);

    // Error Handling
    const [errorMessage, setErrorMessage] = useState("");
    const [hasError, setHasError] = useState({
        username: 0, // 0: neutral, 1: error, 2: success
        password: 0,
    });

    // Rate limiting and authentication state
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(0);
    const [lastValidationResult, setLastValidationResult] = useState(null);

    // Get Firebase Auth token
    const getAuthToken = async () => {
        try {
            const auth = getAuth();
            const user = auth.currentUser;
            
            if (user) {
                const token = await user.getIdToken(true); // Force refresh
                console.log(`🟢 CLIENT: Got auth token for user ${user.uid}`);
                return token;
            } else {
                console.log(`🟢 CLIENT: No authenticated user, proceeding without token`);
                return null;
            }
        } catch (error) {
            console.error(`🟢 CLIENT: Error getting auth token:`, error);
            return null;
        }
    };

    // ENHANCED SERVER-SIDE USERNAME VALIDATION WITH AUTHENTICATION
    const checkUsernameExists = async (username) => {
        console.log(`🟢 CLIENT: Starting authenticated username validation for "${username}"`);
        
        try {
            const startTime = Date.now();
            
            // Get authentication token
            const authToken = await getAuthToken();
            
            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
            };
            
            // Add auth header if available
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
                console.log(`🟢 CLIENT: Including authentication token`);
            } else {
                console.log(`🟢 CLIENT: No auth token - sending anonymous request`);
            }

            console.log(`🟢 CLIENT: Making POST request to /api/validate-username`);
            
            const response = await fetch('/api/validate-username', {
                method: 'POST',
                headers,
                body: JSON.stringify({ username }),
            });

            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            console.log(`🟢 CLIENT: Response received in ${responseTime}ms`);
            console.log(`🟢 CLIENT: Response status: ${response.status}`);
            
            const data = await response.json();
            
            console.log(`🟢 CLIENT: Response data:`, data);
            
            // Store result for debugging
            setLastValidationResult(data);
            
            // Verify server processing
            if (!data.serverProcessed) {
                console.error(`🟢 CLIENT: ⚠️ WARNING - Response missing serverProcessed flag!`);
            }
            
            if (data.requestId) {
                console.log(`🟢 CLIENT: ✅ Server-side processing confirmed (Request ID: ${data.requestId})`);
            }
            
            if (data.authenticated) {
                console.log(`🟢 CLIENT: ✅ Request was authenticated on server`);
                console.log(`🟢 CLIENT: User ID: ${data.user?.uid}`);
                console.log(`🟢 CLIENT: Rate limit: ${data.rateLimit?.maxRequests} requests per minute`);
            } else {
                console.log(`🟢 CLIENT: ⚠️ Request was anonymous (lower rate limits)`);
            }

            // Handle different response statuses
            if (response.status === 401) {
                console.log(`🟢 CLIENT: Authentication required`);
                throw new Error('Authentication required. Please sign in.');
            }

            if (response.status === 429) {
                console.log(`🟢 CLIENT: Rate limited by server`);
                console.log(`🟢 CLIENT: Max requests: ${data.maxRequests}`);
                console.log(`🟢 CLIENT: Window: ${data.windowMs}ms`);
                
                setIsRateLimited(true);
                setRateLimitRetryAfter(60); // Reset in 60 seconds
                throw new Error(data.error || 'Too many requests');
            }

            if (!response.ok) {
                console.log(`🟢 CLIENT: Server returned error: ${data.error}`);
                throw new Error(data.error || 'Validation failed');
            }

            console.log(`🟢 CLIENT: Username "${username}" ${data.exists ? 'EXISTS' : 'AVAILABLE'}`);
            console.log(`🟢 CLIENT: Processing time: ${data.processingTime}ms`);
            console.log(`🟢 CLIENT: DB query time: ${data.dbQueryTime}ms`);
            
            return data.exists;

        } catch (error) {
            console.error(`🟢 CLIENT: Validation error:`, error);
            
            // Handle authentication errors gracefully
            if (error.message.includes('Authentication required')) {
                // Don't show auth errors during login flow
                return true; // Assume username exists to avoid blocking
            }
            
            // Handle rate limiting
            if (error.message.includes('Too many requests')) {
                return true; // Assume username exists to avoid blocking
            }
            
            throw error;
        }
    };

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('login.title'),
            usernamePlaceholder: t('login.username_placeholder'),
            passwordPlaceholder: t('login.password_placeholder'),
            forgotPassword: t('login.forgot_password'),
            signIn: t('login.sign_in'),
            signUp: t('login.sign_up'),
            noAccount: t('login.no_account'),
            continueWith: t('login.continue_with'),
            google: t('login.google'),
            loginSuccessful: t('login.login_successful'),
            googleSignInSuccessful: t('login.google_signin_successful'),
            invalidCredentials: t('login.invalid_credentials'),
            googleSignInFailed: t('login.google_signin_failed'),
            usernameNotRegistered: t('login.username_not_registered'),
            loading: t('common.loading'),
            validationError: t('login.validation_error') || 'Unable to validate username',
            rateLimited: t('login.rate_limited') || 'Too many attempts. Please wait a moment.',
            authRequired: t('login.auth_required') || 'Authentication required for validation'
        };
    }, [t, isInitialized]);

    // LOGIN FORM SUBMISSION
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            await login(debounceUsername.trimEnd(), debouncePassword);
            toast.success(translations.loginSuccessful);
            
            setTimeout(() => {
                setCanProceed(false);
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Login error:", error);
            setHasError({ ...hasError, password: 1 });
            setPassword("");
            setErrorMessage(error.message || translations.invalidCredentials);
            toast.error(translations.invalidCredentials);
        } finally {
            setIsLoading(false);
        }
    };

    // GOOGLE SIGN IN HANDLER
    const handleGoogleSignIn = async () => {
        if (isGoogleLoading) return;
        
        setIsGoogleLoading(true);
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success(translations.googleSignInSuccessful);
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            setErrorMessage(error.message || translations.googleSignInFailed);
            toast.error(translations.googleSignInFailed);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // Check if any form is loading
    const isAnyLoading = isLoading || isGoogleLoading;

    // Rate limit countdown effect
    useEffect(() => {
        if (rateLimitRetryAfter > 0) {
            const timer = setTimeout(() => {
                setRateLimitRetryAfter(prev => prev - 1);
            }, 1000);
            
            return () => clearTimeout(timer);
        } else if (isRateLimited) {
            setIsRateLimited(false);
        }
    }, [rateLimitRetryAfter, isRateLimited]);

    // ENHANCED USERNAME VALIDATION WITH AUTHENTICATION
    useEffect(() => {
        const validateUsername = async () => {
            // Skip validation if rate limited or username is empty
            if (debounceUsername === "" || isRateLimited) {
                setHasError(prev => ({ ...prev, username: 0 }));
                setErrorMessage("");
                return;
            }

            setIsCheckingUsername(true);
            
            try {
                const exists = await checkUsernameExists(debounceUsername);
                
                if (!exists) {
                    setHasError(prev => ({ ...prev, username: 1 }));
                    setErrorMessage(translations.usernameNotRegistered);
                } else {
                    setHasError(prev => ({ ...prev, username: 2 }));
                    setErrorMessage("");
                }
            } catch (error) {
                console.error("Username validation error:", error);
                
                // Handle different types of errors
                if (error.message.includes('Authentication required')) {
                    setHasError(prev => ({ ...prev, username: 0 }));
                    setErrorMessage(translations.authRequired);
                } else if (isRateLimited) {
                    setHasError(prev => ({ ...prev, username: 0 }));
                    setErrorMessage(translations.rateLimited);
                } else {
                    setHasError(prev => ({ ...prev, username: 1 }));
                    setErrorMessage(translations.validationError);
                }
            } finally {
                setIsCheckingUsername(false);
            }
        };
        
        validateUsername();
    }, [debounceUsername, translations, isRateLimited]);

    // PASSWORD VALIDATION
    useEffect(() => {
        if (debouncePassword !== "") {
            setHasError(prev => ({ ...prev, password: 2 }));
        } else {
            setHasError(prev => ({ ...prev, password: 0 }));
        }
    }, [debouncePassword]);

    // FORM VALIDATION
    useEffect(() => {
        if (hasError.username <= 1 || hasError.password <= 1 || isRateLimited) {
            setCanProceed(false);
        } else {
            setCanProceed(true);
            // Clear error message when form is valid
            if (hasError.username === 2 && hasError.password === 2) {
                setErrorMessage("");
            }
        }
    }, [hasError, isRateLimited]);

    // LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-12 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </section>
            </div>
        );
    }
    
    return (
        <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
            {/* DEBUG INFO - Remove in production */}
           

            {/* LOGO */}
            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image 
                    src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} 
                    alt="logo" 
                    height={70} 
                    width={70} 
                    className="filter invert" 
                    priority 
                />
            </Link>

            {/* MAIN FORM SECTION */}
            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">{translations.title}</p>
                
                {/* RATE LIMIT WARNING */}
                {isRateLimited && (
                    <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md text-center">
                        <p className="text-sm">
                            {translations.rateLimited} 
                            {rateLimitRetryAfter > 0 && (
                                <span className="font-semibold"> ({rateLimitRetryAfter}s)</span>
                            )}
                        </p>
                        <p className="text-xs mt-1">
                            Sign in with Google for higher rate limits
                        </p>
                    </div>
                )}
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    {/* USERNAME INPUT */}
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${
                        hasError.username === 1 ? "hasError" : 
                        hasError.username === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>


<input
    type="text"
    placeholder={translations.usernamePlaceholder}
    className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
    value={username}
    onChange={(e) => {
        // ADD THIS LOGIC: Reset error state on change
        setHasError(prev => ({ ...prev, username: 0 }));
        setErrorMessage("");
        setUsername(e.target.value);
    }}
    required
    disabled={isAnyLoading}
/>

                        {/* USERNAME VALIDATION ICONS */}
                        {isCheckingUsername ? (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        ) : isRateLimited ? (
                            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-xs">!</span>
                            </div>
                        ) : hasError.username === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} />
                        ) : hasError.username === 2 ? (
                            <FaCheck className="text-themeGreen cursor-pointer" />
                        ) : null}
                    </div>
                    
                    {/* PASSWORD INPUT */}
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md ${
                        hasError.password === 1 ? "hasError" : 
                        hasError.password === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={seePassword ? "password" : "text"}
                            placeholder={translations.passwordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isAnyLoading}
                        />
                        {/* PASSWORD VISIBILITY TOGGLE */}
                        {seePassword ? (
                            <FaEyeSlash 
                                className="opacity-60 cursor-pointer" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        ) : (
                            <FaEye 
                                className="opacity-60 cursor-pointer text-themeGreen" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        )}
                    </div>

                    {/* FORGOT PASSWORD LINK */}
                    <Link 
                        href={"/forgot-password"} 
                        className="w-fit hover:rotate-2 hover:text-themeGreen origin-left"
                    >
                        {translations.forgotPassword}
                    </Link>

                    {/* SUBMIT BUTTON */}
                    <button 
                        type="submit" 
                        disabled={!canProceed || isAnyLoading}
                        className={`rounded-md py-3 sm:py-4 grid place-items-center font-semibold transition-all duration-200 ${
                            canProceed && !isAnyLoading 
                                ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" 
                                : "cursor-default opacity-50"
                        }`}
                    >
                        {!isLoading ? (
                            <span className="nopointer">{translations.signIn}</span>
                        ) : (
                            <Image 
                                src={"https://linktree.sirv.com/Images/gif/loading.gif"} 
                                width={25} 
                                height={25} 
                                alt="loading" 
                                className="mix-blend-screen" 
                            />
                        )}
                    </button>

                    {/* DIVIDER */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-500">{translations.continueWith}</span>
                        </div>
                    </div>

                    {/* SOCIAL SIGN IN BUTTONS */}
                    <div className="grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isAnyLoading}
                            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-gray-300 font-semibold transition-all duration-200 ${
                                !isAnyLoading 
                                    ? "cursor-pointer hover:bg-gray-50 active:scale-95" 
                                    : "cursor-default opacity-50"
                            }`}
                        >
                            {!isGoogleLoading ? (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span>{translations.google}</span>
                                </>
                            ) : (
                                <Image 
                                    src={"https://linktree.sirv.com/Images/gif/loading.gif"} 
                                    width={20} 
                                    height={20} 
                                    alt="loading" 
                                />
                            )}
                        </button>
                    </div>

                    {/* ERROR MESSAGE */}
                    {!isAnyLoading && errorMessage && (
                        <span className={`text-sm text-center ${
                            isRateLimited ? 'text-yellow-600' : 'text-red-500'
                        }`}>
                            {errorMessage}
                        </span>
                    )}
                </form>
                
                {/* SIGN UP LINK */}
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">{translations.noAccount}</span> 
                    <Link href={"/signup"} className="text-themeGreen ml-1">
                        {translations.signUp}
                    </Link>
                </p>
            </section>
        </div>
    );
}



/*
// LoginForm.jsx - Optimized with Performance Testing
"use client"

import React, { useContext, useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { fireApp } from "@/important/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/lib/translation/useTranslation";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";
import UserSeederManager from '@/components/UserSeederManager';

export default function LoginForm() {
    const router = useRouter();
    const { login, signInWithGoogle, signInWithMicrosoft, signInWithApple } = useAuth();
    const { t, isInitialized } = useTranslation();

    const [seePassword, setSeePassword] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [canProceed, setCanProceed] = useState(false);

    const debounceUsername = useDebounce(username, 500);
    const debouncePassword = useDebounce(password, 500);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
        google: false,
        microsoft: false,
        apple: false
    });
    const [errorMessage, setErrorMessage] = useState("");
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    
    const [hasError, setHasError] = useState({
        username: 0,
        password: 0,
    });

    // PERFORMANCE TESTING STATE
    const [performanceResults, setPerformanceResults] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    // OPTIMIZED USERNAME CHECK FUNCTION
    const checkUsernameExists = async (username) => {
        const q = query(
            collection(fireApp, "AccountData"), 
            where("username", "==", username.toLowerCase())
        );
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    };

    // OLD METHOD FOR COMPARISON
    const getAllUsernamesOldWay = async () => {
        const collectionRef = collection(fireApp, "AccountData");
        const snapshot = await getDocs(collectionRef);
        const usernames = [];
        snapshot.forEach((doc) => {
            const { username } = doc.data();
            if (username) {
                usernames.push(username.toLowerCase());
            }
        });
        return usernames;
    };

    // PERFORMANCE TESTING FUNCTION - COMPARE BOTH METHODS
    const runPerformanceTest = async () => {
        setIsTesting(true);
        const iterations = 10; // Reduced for demo
        
        console.log("🔥 Starting database performance comparison...");
        toast("Running performance test...", { icon: '⏱️' });

        // Test usernames to check (mix of existing and non-existing)
        const testUsernames = [
            "testuser1", "testuser2", "nonexistent1", "nonexistent2", 
            "admin", "user123", "fake456", "demo789"
        ];

        // TEST 1: OLD METHOD (fetch all usernames)
        console.log("📊 Testing OLD method (fetch all usernames)...");
        const oldMethodTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            
            try {
                const allUsernames = await getAllUsernamesOldWay();
                const testUsername = testUsernames[i % testUsernames.length];
                const exists = allUsernames.includes(testUsername.toLowerCase());
                
                const endTime = performance.now();
                oldMethodTimes.push(endTime - startTime);
            } catch (error) {
                console.error(`Old method query ${i + 1} failed:`, error);
                const endTime = performance.now();
                oldMethodTimes.push(endTime - startTime);
            }
        }

        // TEST 2: NEW METHOD (individual username checks)
        console.log("📊 Testing NEW method (individual checks)...");
        const newMethodTimes = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            
            try {
                const testUsername = testUsernames[i % testUsernames.length];
                await checkUsernameExists(testUsername);
                
                const endTime = performance.now();
                newMethodTimes.push(endTime - startTime);
            } catch (error) {
                console.error(`New method query ${i + 1} failed:`, error);
                const endTime = performance.now();
                newMethodTimes.push(endTime - startTime);
            }
        }

        // Calculate statistics for both methods
        const calculateStats = (times) => {
            const total = times.reduce((sum, time) => sum + time, 0);
            const average = total / times.length;
            const min = Math.min(...times);
            const max = Math.max(...times);
            const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
            
            return {
                average: average.toFixed(2),
                min: min.toFixed(2),
                max: max.toFixed(2),
                median: median.toFixed(2),
                total: total.toFixed(2),
                qps: (1000 / average).toFixed(2)
            };
        };

        const oldStats = calculateStats([...oldMethodTimes]);
        const newStats = calculateStats([...newMethodTimes]);
        
        const results = {
            iterations,
            oldMethod: oldStats,
            newMethod: newStats,
            improvement: {
                avgSpeedup: (oldStats.average / newStats.average).toFixed(2),
                totalTimeSaved: (oldStats.total - newStats.total).toFixed(2)
            }
        };
        
        setPerformanceResults(results);
        setIsTesting(false);
        
        // Log comprehensive results
        console.log("📊 PERFORMANCE COMPARISON RESULTS:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔴 OLD METHOD (Fetch All Usernames):");
        console.log(`   Average: ${oldStats.average}ms`);
        console.log(`   Min: ${oldStats.min}ms | Max: ${oldStats.max}ms`);
        console.log(`   Total time: ${oldStats.total}ms`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🟢 NEW METHOD (Individual Checks):");
        console.log(`   Average: ${newStats.average}ms`);
        console.log(`   Min: ${newStats.min}ms | Max: ${newStats.max}ms`);
        console.log(`   Total time: ${newStats.total}ms`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🚀 PERFORMANCE IMPROVEMENT:");
        console.log(`   Speed improvement: ${results.improvement.avgSpeedup}x faster`);
        console.log(`   Time saved: ${results.improvement.totalTimeSaved}ms`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        toast.success(`Performance test completed! New method is ${results.improvement.avgSpeedup}x faster!`);
    };

    // PRE-COMPUTE TRANSLATIONS FOR PERFORMANCE
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('login.title'),
            usernamePlaceholder: t('login.username_placeholder'),
            passwordPlaceholder: t('login.password_placeholder'),
            forgotPassword: t('login.forgot_password'),
            signIn: t('login.sign_in'),
            signUp: t('login.sign_up'),
            noAccount: t('login.no_account'),
            continueWith: t('login.continue_with'),
            google: t('login.google'),
            microsoft: t('login.microsoft'),
            apple: t('login.apple'),
            loginSuccessful: t('login.login_successful'),
            googleSignInSuccessful: t('login.google_signin_successful'),
            microsoftSignInSuccessful: t('login.microsoft_signin_successful'),
            appleSignInSuccessful: t('login.apple_signin_successful'),
            invalidCredentials: t('login.invalid_credentials'),
            googleSignInFailed: t('login.google_signin_failed'),
            microsoftSignInFailed: t('login.microsoft_signin_failed'),
            appleSignInFailed: t('login.apple_signin_failed'),
            usernameNotRegistered: t('login.username_not_registered'),
            loading: t('common.loading')
        };
    }, [t, isInitialized]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            const result = await login(debounceUsername.trimEnd(), debouncePassword);
            
            toast.success(translations.loginSuccessful);
            
            setTimeout(() => {
                setCanProceed(false);
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Login error:", error);
            setHasError({ ...hasError, password: 1 });
            setPassword("");
            setErrorMessage(error.message || translations.invalidCredentials);
            toast.error(translations.invalidCredentials);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        if (loadingStates.google) return;
        
        setLoadingStates(prev => ({ ...prev, google: true }));
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success(translations.googleSignInSuccessful);
            
            setTimeout(() => {
                router.push("/dashboard");
            }, 1000);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            setErrorMessage(error.message || translations.googleSignInFailed);
            toast.error(translations.googleSignInFailed);
        } finally {
            setLoadingStates(prev => ({ ...prev, google: false }));
        }
    };

    const isAnyLoading = isLoading || Object.values(loadingStates).some(Boolean);

    // OPTIMIZED USERNAME VALIDATION - REPLACE OLD onSnapshot METHOD
    useEffect(() => {
        const validateUsername = async () => {
            if (debounceUsername !== "") {
                setIsCheckingUsername(true);
                
                try {
                    const exists = await checkUsernameExists(debounceUsername);
                    
                    if (!exists) {
                        setHasError(prev => ({ ...prev, username: 1 }));
                        setErrorMessage(translations.usernameNotRegistered);
                    } else {
                        setHasError(prev => ({ ...prev, username: 2 }));
                        setErrorMessage("");
                    }
                } catch (error) {
                    console.error("Username validation error:", error);
                    setHasError(prev => ({ ...prev, username: 1 }));
                    setErrorMessage("Error checking username");
                } finally {
                    setIsCheckingUsername(false);
                }
            } else {
                setHasError(prev => ({ ...prev, username: 0 }));
            }
        };
        
        validateUsername();
    }, [debounceUsername, translations.usernameNotRegistered]);

    useEffect(() => {
        if (debouncePassword !== "") {
            setHasError(prev => ({ ...prev, password: 2 }));
            return;
        } else {
            setHasError(prev => ({ ...prev, password: 0 }));
        }
    }, [debouncePassword]);

    useEffect(() => {
        if (hasError.username <= 1 || hasError.password <= 1) {
            setCanProceed(false);
            return;
        }

        setCanProceed(true);
        setErrorMessage("");
    }, [hasError]);

    // SHOW LOADING STATE WHILE TRANSLATIONS LOAD
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-12 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-12 bg-gray-200 rounded animate-pulse mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </section>

            </div>
        );
    }
    
    return (
        <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
           
            <div className="fixed top-4 right-4 z-50 space-y-2">
                <button
                    onClick={runPerformanceTest}
                    disabled={isTesting}
                    className={`px-4 py-2 rounded-lg font-semibold text-white ${
                        isTesting 
                            ? 'bg-gray-500 cursor-not-allowed' 
                            : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
                    }`}
                >
                    {isTesting ? '⏱️ Testing...' : '🔥 Compare DB Methods'}
                </button>
                
                {performanceResults && (
                    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-sm">
                        <h3 className="font-bold text-sm mb-3">📊 Performance Comparison</h3>
                        
                        <div className="space-y-3">
                            <div className="border-l-4 border-red-500 pl-3">
                                <div className="font-semibold text-xs text-red-600 mb-1">🔴 OLD METHOD (Fetch All)</div>
                                <div className="text-xs space-y-1">
                                    <div><strong>Avg:</strong> {performanceResults.oldMethod.average}ms</div>
                                    <div><strong>Min/Max:</strong> {performanceResults.oldMethod.min}ms / {performanceResults.oldMethod.max}ms</div>
                                    <div><strong>Total:</strong> {performanceResults.oldMethod.total}ms</div>
                                </div>
                            </div>

                            <div className="border-l-4 border-green-500 pl-3">
                                <div className="font-semibold text-xs text-green-600 mb-1">🟢 NEW METHOD (Individual)</div>
                                <div className="text-xs space-y-1">
                                    <div><strong>Avg:</strong> {performanceResults.newMethod.average}ms</div>
                                    <div><strong>Min/Max:</strong> {performanceResults.newMethod.min}ms / {performanceResults.newMethod.max}ms</div>
                                    <div><strong>Total:</strong> {performanceResults.newMethod.total}ms</div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-2 rounded">
                                <div className="font-semibold text-xs text-blue-600 mb-1">🚀 IMPROVEMENT</div>
                                <div className="text-xs space-y-1">
                                    <div><strong>Speed:</strong> {performanceResults.improvement.avgSpeedup}x faster</div>
                                    <div><strong>Time Saved:</strong> {performanceResults.improvement.totalTimeSaved}ms</div>
                                    <div><strong>Tests:</strong> {performanceResults.iterations} each</div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setPerformanceResults(null)}
                            className="mt-3 w-full text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1"
                        >
                            ✕ Close Results
                        </button>
                    </div>
                )}
            </div>

            <Link href={'/'} className="sm:p-0 p-3 w-fit">
                <Image src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"} alt="logo" height={70} width={70} className="filter invert" priority />
            </Link>
            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">{translations.title}</p>
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${hasError.username === 1 ? "hasError" : hasError.username === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>
                        <input
                            type="text"
                            placeholder={translations.usernamePlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isAnyLoading || isCheckingUsername}
                        />
                        {isCheckingUsername ? (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        ) : hasError.username === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} />
                        ) : hasError.username === 2 ? (
                            <FaCheck className="text-themeGreen cursor-pointer" />
                        ) : ""}
                    </div>
                    
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md  ${hasError.password === 1 ? "hasError": hasError.password === 2 ? "good" : ""} bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={`${seePassword ? "password": "text"}`}
                            placeholder={translations.passwordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isAnyLoading}
                        />
                        {seePassword && <FaEyeSlash className="opacity-60 cursor-pointer" onClick={() => setSeePassword(!seePassword)} />}
                        {!seePassword && <FaEye className="opacity-60 cursor-pointer text-themeGreen" onClick={() => setSeePassword(!seePassword)} />}
                    </div>

                    <Link href={"/forgot-password"} className="w-fit hover:rotate-2 hover:text-themeGreen origin-left">{translations.forgotPassword}</Link>

                    <button 
                        type="submit" 
                        disabled={!canProceed || isAnyLoading}
                        className={`rounded-md py-3 sm:py-4 grid place-items-center font-semibold ${canProceed && !isAnyLoading ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-themeGreen mix-blend-screen" : "cursor-default opacity-50"}`}
                    >
                        {!isLoading && <span className="nopointer">{translations.signIn}</span>}
                        {isLoading && <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={25} height={25} alt="loading" className=" mix-blend-screen" />}
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
                        <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-500">{translations.continueWith}</span></div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isAnyLoading}
                            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-gray-300 font-semibold ${!isAnyLoading ? "cursor-pointer hover:bg-gray-50 active:scale-95" : "cursor-default opacity-50"}`}
                        >
                            {!loadingStates.google ? (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    <span>{translations.google}</span>
                                </>
                            ) : (
                                <Image src={"https://linktree.sirv.com/Images/gif/loading.gif"} width={20} height={20} alt="loading" />
                            )}
                        </button>
                    </div>

                    {!isAnyLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">{errorMessage}</span>
                    )}
                </form>
                
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">{translations.noAccount}</span> 
                    <Link href={"/signup"} className="text-themeGreen ml-1">{translations.signUp}</Link>
                </p>
            </section>
                                    <UserSeederManager />

        </div>
    );
}
*/