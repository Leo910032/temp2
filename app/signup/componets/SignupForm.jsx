// app/signup/components/SignupForm.jsx
"use client"

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/important/firebase";

// Import the new services
import { AuthService } from "@/lib/services/client/authService";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmail, validatePassword } from "@/lib/utilities";

function SignupFormContent() {
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get('returnTo') || '/dashboard';
    const { signInWithGoogle } = useAuth();
    const { t, isInitialized } = useTranslation();

    // Form state management
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [seePassword, setSeePassword] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    
    // Validation state
    const [hasError, setHasError] = useState({
        username: 0, // 0: neutral, 1: error, 2: success
        email: 0,
        password: 0,
    });
    const [canProceed, setCanProceed] = useState(false);

    // Debounced values for validation
    const debouncedUsername = useDebounce(username, 800);
    const debouncedEmail = useDebounce(email, 500);
    const debouncedPassword = useDebounce(password, 500);

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('signup.title'),
            usernamePlaceholder: t('signup.username_placeholder'),
            emailPlaceholder: t('signup.email_placeholder'),
            passwordPlaceholder: t('signup.password_placeholder'),
            createAccount: t('signup.create_account'),
            orContinueWith: t('signup.or_continue_with'),
            google: t('signup.google'),
            alreadyHaveAccount: t('signup.already_have_account'),
            login: t('signup.login'),
            accountCreatedSuccess: t('signup.success.account_created'),
            redirectMessage: t('signup.redirect_message'),
            // Error messages
            usernameTooShort: t('signup.errors.username_too_short') || 'Username must be at least 3 characters',
            invalidUsernameFormat: t('signup.errors.invalid_username_format') || 'Username can only contain letters, numbers, underscores, and hyphens',
            usernameTaken: t('signup.errors.username_taken') || 'Username is already taken',
            invalidEmailFormat: t('signup.errors.invalid_email_format') || 'Please enter a valid email address',
            emailAlreadyInUse: t('signup.errors.email_already_in_use') || 'An account with this email already exists',
            weakPassword: t('signup.errors.weak_password') || 'Password is too weak',
            somethingWentWrong: t('signup.errors.something_went_wrong') || 'Something went wrong. Please try again.',
            errorCheckingUsername: t('signup.errors.error_checking_username') || 'Error checking username availability',
            googleSignInSuccess: t('signup.google_signin_successful') || 'Signed in with Google successfully!',
            googleSignInFailed: t('signup.google_signin_failed') || 'Failed to sign in with Google'
        };
    }, [t, isInitialized]);

    // Username validation using the new AuthService
    useEffect(() => {
        const validateUsername = async () => {
            if (debouncedUsername === "") {
                setHasError(prev => ({ ...prev, username: 0 }));
                setErrorMessage("");
                return;
            }

            // Client-side validation first
            if (debouncedUsername.length < 3) {
                setHasError(prev => ({ ...prev, username: 1 }));
                setErrorMessage(translations.usernameTooShort);
                return;
            }

            if (!/^[a-zA-Z0-9_.-]+$/.test(debouncedUsername)) {
                setHasError(prev => ({ ...prev, username: 1 }));
                setErrorMessage(translations.invalidUsernameFormat);
                return;
            }

            // Server-side validation
            setIsCheckingUsername(true);
            setErrorMessage("");
            
            try {
                const result = await AuthService.validateUsername(debouncedUsername);
                
                if (result.exists) {
                    setHasError(prev => ({ ...prev, username: 1 }));
                    setErrorMessage(translations.usernameTaken);
                } else {
                    setHasError(prev => ({ ...prev, username: 2 }));
                    setErrorMessage("");
                }
            } catch (error) {
                console.error("Username validation error:", error);
                setHasError(prev => ({ ...prev, username: 1 }));
                
                if (error.message.includes('Too many requests')) {
                    setErrorMessage('Too many requests. Please wait a moment.');
                } else {
                    setErrorMessage(translations.errorCheckingUsername);
                }
            } finally {
                setIsCheckingUsername(false);
            }
        };

        validateUsername();
    }, [debouncedUsername, translations]);

  useEffect(() => {
        const validateEmailAddress = async () => {
            if (debouncedEmail === "") {
                setHasError(prev => ({ ...prev, email: 0 }));
                return;
            }
            if (!validateEmail(debouncedEmail)) {
                setHasError(prev => ({ ...prev, email: 1 }));
                setErrorMessage(translations.invalidEmailFormat);
                return;
            }

            setIsCheckingEmail(true);
            setErrorMessage("");
            try {
                // Use the new simplified client service method
                const result = await AuthService.validateEmail(debouncedEmail);
                
                if (result.isDisposable) {
                    setHasError(prev => ({ ...prev, email: 1 }));
                    setErrorMessage(translations.disposableEmailError);
                } else if (result.exists) {
                    setHasError(prev => ({ ...prev, email: 1 }));
                    setErrorMessage(translations.emailAlreadyInUse);
                } else {
                    setHasError(prev => ({ ...prev, email: 2 }));
                }
            } catch (error) {
                console.error("Email validation error:", error);
                setHasError(prev => ({ ...prev, email: 1 }));
                setErrorMessage(error.message || translations.errorCheckingEmail);
            } finally {
                setIsCheckingEmail(false);
            }
        };
        validateEmailAddress();
    }, [debouncedEmail, translations]);

    // Password validation
    useEffect(() => {
        if (debouncedPassword === "") {
            setHasError(prev => ({ ...prev, password: 0 }));
        } else {
            const passwordResult = validatePassword(debouncedPassword);
            if (passwordResult !== true) {
                setHasError(prev => ({ ...prev, password: 1 }));
                setErrorMessage(passwordResult);
            } else {
                setHasError(prev => ({ ...prev, password: 2 }));
            }
        }
    }, [debouncedPassword]);

    // Form validation - check if all fields are valid
    useEffect(() => {
        const isValid = hasError.username === 2 && hasError.email === 2 && hasError.password === 2;
        setCanProceed(isValid);
        
        // Clear error message when form becomes valid
        if (isValid && !errorMessage.includes('Too many requests')) {
            setErrorMessage("");
        }
    }, [hasError, errorMessage]);

    // Handle input changes with immediate feedback reset
    const handleUsernameChange = (e) => {
        setUsername(e.target.value);
        setHasError(prev => ({ ...prev, username: 0 }));
        setErrorMessage("");
    };

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
        setHasError(prev => ({ ...prev, email: 0 }));
        setErrorMessage("");
    };

    const handlePasswordChange = (e) => {
        setPassword(e.target.value);
        setHasError(prev => ({ ...prev, password: 0 }));
        setErrorMessage("");
    };

    // Main signup form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;

        setIsLoading(true);
        setErrorMessage("");

        try {
            console.log('🔵 CLIENT: Starting server-side signup...');
            
            // Call the new AuthService to handle server-side creation
            const result = await AuthService.createStandardUser({
                username: username.trim(),
                email: email.trim(),
                password: password
            });
            
            console.log('🔵 CLIENT: Server signup successful, signing in with custom token...');
            
            // Sign in with the custom token returned from server
            await signInWithCustomToken(auth, result.customToken);
            
            console.log('🔵 CLIENT: Successfully signed in!');
            
            toast.success(translations.accountCreatedSuccess);
            
            setTimeout(() => {
                console.log('🔄 Redirecting to:', returnTo);
                router.push(returnTo);
            }, 1000);
            
        } catch (error) {
            console.error('🔵 CLIENT: Signup error:', error);
            
            // Reset form state on error
            setCanProceed(false);
            
            // Handle specific error codes with user-friendly messages
            let errorMsg = translations.somethingWentWrong;
            
            if (error.message.includes('Username is already taken')) {
                errorMsg = translations.usernameTaken;
                setHasError(prev => ({ ...prev, username: 1 }));
            } else if (error.message.includes('email already exists')) {
                errorMsg = translations.emailAlreadyInUse;
                setHasError(prev => ({ ...prev, email: 1 }));
            } else if (error.message.includes('Password') || error.message.includes('weak')) {
                errorMsg = error.message; // Use detailed password validation message
                setHasError(prev => ({ ...prev, password: 1 }));
            } else if (error.message.includes('email')) {
                errorMsg = translations.invalidEmailFormat;
                setHasError(prev => ({ ...prev, email: 1 }));
            } else if (error.message.includes('Username')) {
                errorMsg = error.message; // Use detailed username validation message
                setHasError(prev => ({ ...prev, username: 1 }));
            } else if (error.message.includes('Too many')) {
                errorMsg = 'Too many attempts. Please wait a moment.';
            }
            
            setErrorMessage(errorMsg);
            toast.error(errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Google sign-in handler
    const handleGoogleSignIn = async () => {
        if (isGoogleLoading) return;
        
        setIsGoogleLoading(true);
        setErrorMessage("");
        
        try {
            await signInWithGoogle();
            toast.success(translations.googleSignInSuccess);
            
            setTimeout(() => {
                router.push(returnTo);
            }, 1000);
            
        } catch (error) {
            console.error("Google sign-in error:", error);
            setErrorMessage(translations.googleSignInFailed);
            toast.error(translations.googleSignInFailed);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const isAnyLoading = isLoading || isGoogleLoading;

    // Loading state while translations initialize
    if (!isInitialized) {
        return (
            <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto">
                <div className="sm:p-0 p-3 w-fit">
                    <div className="w-28 h-8 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                    <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mx-auto mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
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
            {/* Logo */}
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

            {/* Main form section */}
            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">
                    {translations.title}
                </p>
                
                {/* Return URL message */}
                {returnTo !== '/dashboard' && (
                    <p className="text-center text-blue-600 mt-2 text-sm">
                        {translations.redirectMessage}
                    </p>
                )}
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    {/* Username input */}
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
                            onChange={handleUsernameChange}
                            required
                            disabled={isAnyLoading || isCheckingUsername}
                        />
                        
                        {/* Username validation icons */}
                        {isCheckingUsername ? (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        ) : hasError.username === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} />
                        ) : hasError.username === 2 ? (
                            <FaCheck className="text-themeGreen cursor-pointer" />
                        ) : null}
                    </div>
                    
                    {/* Email input */}
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${
                        hasError.email === 1 ? "hasError" : 
                        hasError.email === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <input
                            type="email"
                            placeholder={translations.emailPlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
                            value={email}
                            onChange={handleEmailChange}
                            required
                            disabled={isAnyLoading}
                        />
                        
                        {/* Email validation icons */}
                        {hasError.email === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setEmail("")} />
                        ) : hasError.email === 2 ? (
                            <FaCheck className="text-themeGreen cursor-pointer" />
                        ) : null}
                    </div>
                    
                    {/* Password input */}
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md ${
                        hasError.password === 1 ? "hasError" : 
                        hasError.password === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg myInput`}>
                        <input
                            type={seePassword ? "password" : "text"}
                            placeholder={translations.passwordPlaceholder}
                            className="peer outline-none border-none bg-transparent py-2 ml-1 flex-1 text-sm sm:text-base"
                            value={password}
                            onChange={handlePasswordChange}
                            required
                            disabled={isAnyLoading}
                        />
                        
                        {/* Password visibility toggle */}
                        {seePassword ? (
                            <FaEyeSlash 
                                className="opacity-60 cursor-pointer ml-2" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        ) : (
                            <FaEye 
                                className="opacity-60 cursor-pointer text-themeGreen ml-2" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        )}
                    </div>
                    
                    {/* Submit button */}
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
                            <span className="nopointer">{translations.createAccount}</span>
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

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-500">
                                {translations.orContinueWith}
                            </span>
                        </div>
                    </div>

                    {/* Social sign-in buttons */}
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

                    {/* Error message */}
                    {!isAnyLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center">
                            {errorMessage}
                        </span>
                    )}
                </form>
                
                {/* Sign in link */}
                <p className="text-center sm:text-base text-sm">
                    <span className="opacity-60">{translations.alreadyHaveAccount}</span> 
                    <Link 
                        className="text-themeGreen ml-1" 
                        href={`/login${returnTo !== '/dashboard' ? `?returnTo=${returnTo}` : ''}`}
                    >
                        {translations.login}
                    </Link>
                </p>
            </section>
        </div>
    );
}

export default function SignupForm() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">Loading...</div>
            </div>
        }>
            <SignupFormContent />
        </Suspense>
    );
}