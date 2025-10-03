//app/login/componets/LoginForm.jsx
"use client"

import React, { useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/LocalHooks/useDebounce";
import { useTranslation } from "@/lib/translation/useTranslation";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { FaCheck, FaEye, FaEyeSlash, FaX } from "react-icons/fa6";
import Image from "next/image";
import Link from "next/link";
import { AuthService } from "@/lib/services/client/authService.js";

export default function LoginForm() {
    const router = useRouter();
    const { t, isInitialized } = useTranslation();

    // State management for form inputs, loading, and validation
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [seePassword, setSeePassword] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [usernameStatus, setUsernameStatus] = useState(0); // 0: neutral, 1: error, 2: success
    const [passwordStatus, setPasswordStatus] = useState(0);
    const [canProceed, setCanProceed] = useState(false);

    // Debounced inputs for validation to avoid excessive API calls
    const debouncedUsername = useDebounce(username, 800);
    const debouncedPassword = useDebounce(password, 500);

    // Memoized translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('login.title') || "Sign in to your account",
            usernamePlaceholder: t('login.username_placeholder') || "username",
            passwordPlaceholder: t('login.password_placeholder') || "Password",
            forgotPassword: t('login.forgot_password') || "Forgot password?",
            signIn: t('login.sign_in') || "Sign In",
            signUp: t('login.sign_up') || "Sign up",
            noAccount: t('login.no_account') || "Don't have an account?",
            continueWith: t('login.continue_with') || "Or continue with",
            google: t('login.google') || "Google",
            loginSuccessful: t('login.login_successful') || "Login successful!",
            googleSignInSuccessful: t('login.google_signin_successful') || "Signed in with Google!",
            invalidCredentials: t('login.invalid_credentials') || "Invalid username or password.",
            googleSignInFailed: t('login.google_signin_failed') || "Google sign-in failed. Please try again.",
            usernameNotRegistered: t('login.username_not_registered') || "This username is not registered.",
            validationError: t('login.validation_error') || 'Unable to validate username.',
            rateLimited: t('login.rate_limited') || 'Too many attempts. Please wait a moment.'
        };
    }, [t, isInitialized]);

    // Username validation effect
    useEffect(() => {
        const validate = async () => {
            if (debouncedUsername === "") { setUsernameStatus(0); return; }
            if (debouncedUsername.length < 3) { setUsernameStatus(1); setErrorMessage("Username must be at least 3 characters."); return; }
            setIsCheckingUsername(true);
            setErrorMessage("");
            try {
                const result = await AuthService.validateUsername(debouncedUsername);
                if (result.exists) { 
                    setUsernameStatus(2); 
                } else { 
                    setUsernameStatus(1); 
                    setErrorMessage(translations.usernameNotRegistered); 
                }
            } catch (error) { 
                setUsernameStatus(1); 
                setErrorMessage(error.message || translations.validationError); 
            } finally { 
                setIsCheckingUsername(false); 
            }
        };
        validate();
    }, [debouncedUsername, translations]);

    // Password validation effect
    useEffect(() => {
        if (debouncedPassword === "") { setPasswordStatus(0); }
        else if (debouncedPassword.length < 6) { setPasswordStatus(1); }
        else { setPasswordStatus(2); }
    }, [debouncedPassword]);

    // Form validity check effect
    useEffect(() => {
        const isValid = usernameStatus === 2 && passwordStatus === 2;
        setCanProceed(isValid);
        if (isValid && !errorMessage.includes('Too many requests')) { setErrorMessage(""); }
    }, [usernameStatus, passwordStatus, errorMessage]);

    // Standard login form submission handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canProceed || isLoading) return;
        
        setIsLoading(true);
        setErrorMessage("");
        
        try {
            await AuthService.login(debouncedUsername.trim(), debouncedPassword);
            toast.success(translations.loginSuccessful);
            router.push("/dashboard");
        } catch (error) {
            console.error("Login error:", error);
            setPasswordStatus(1);
            setPassword("");
            setErrorMessage(error.message || translations.invalidCredentials);
            toast.error(error.message || translations.invalidCredentials);
        } finally {
            setIsLoading(false);
        }
    };

    // Google Sign-In handler
    const handleGoogleSignIn = async () => {
        if (isGoogleLoading) return;
        
        setIsGoogleLoading(true);
        setErrorMessage("");
        
        try {
            await AuthService.signInWithGoogle();
            toast.success(translations.googleSignInSuccessful);
            router.push("/dashboard");
        } catch (error)
        {
            console.error("Google sign-in error:", error);
            setErrorMessage(error.message || translations.googleSignInFailed);
            toast.error(error.message || translations.googleSignInFailed);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // Input change handlers
    const handleUsernameChange = (e) => { setUsername(e.target.value); setUsernameStatus(0); setErrorMessage(""); };
    const handlePasswordChange = (e) => { setPassword(e.target.value); setPasswordStatus(0); };
    const isAnyLoading = isLoading || isGoogleLoading;

    if (!isInitialized) {
        return <div className="flex-1 flex items-center justify-center">Loading...</div>;
    }
    
    return (
        <div className="flex-1 sm:p-8 px-4 py-4 flex flex-col overflow-y-auto bg-white text-black">
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

            <section className="mx-auto py-4 w-full sm:w-5/6 md:w-3/4 lg:w-2/3 xl:w-1/2 flex-1 flex flex-col justify-center">
                <p className="text-2xl sm:text-5xl font-extrabold text-center">
                    {translations.title}
                </p>
                
                <form className="py-6 sm:py-8 flex flex-col gap-4 w-full" onSubmit={handleSubmit}>
                    <div className={`flex items-center py-1 sm:py-2 px-2 sm:px-6 rounded-md myInput ${
                        usernameStatus === 1 ? "hasError" : 
                        usernameStatus === 2 ? "good" : ""
                    } bg-black bg-opacity-5 text-base sm:text-lg w-full`}>
                        <label className="opacity-40">mylinktree/</label>
                        <input
                            type="text"
                            placeholder={translations.usernamePlaceholder}
                            className="outline-none border-none bg-transparent ml-1 py-2 flex-1 text-sm sm:text-base"
                            value={username}
                            onChange={handleUsernameChange}
                            required
                            disabled={isAnyLoading}
                        />
                        {isCheckingUsername ? (
                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
                        ) : usernameStatus === 1 ? (
                            <FaX className="text-red-500 text-sm cursor-pointer" onClick={() => setUsername("")} />
                        ) : usernameStatus === 2 ? (
                            <FaCheck className="text-green-500 cursor-pointer" />
                        ) : null}
                    </div>
                    
                    <div className={`flex items-center relative py-1 sm:py-2 px-2 sm:px-6 rounded-md ${
                        passwordStatus === 1 ? "hasError" : 
                        passwordStatus === 2 ? "good" : ""
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
                        {seePassword ? (
                            <FaEyeSlash 
                                className="opacity-60 cursor-pointer" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        ) : (
                            <FaEye 
                                className="opacity-60 cursor-pointer text-green-500" 
                                onClick={() => setSeePassword(!seePassword)} 
                            />
                        )}
                    </div>

                    <Link 
                        href={"/forgot-password"} 
                        className="w-fit hover:rotate-2 hover:text-green-500 origin-left text-sm"
                    >
                        {translations.forgotPassword}
                    </Link>

                    <button 
                        type="submit" 
                        disabled={!canProceed || isAnyLoading}
                        className={`rounded-md py-3 sm:py-4 grid place-items-center font-semibold transition-all duration-200 ${
                            canProceed && !isAnyLoading 
                                ? "cursor-pointer active:scale-95 active:opacity-40 hover:scale-[1.025] bg-green-500 text-white" 
                                : "cursor-default opacity-50 bg-gray-300"
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
                            />
                        )}
                    </button>

                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-500">
                                {translations.continueWith}
                            </span>
                        </div>
                    </div>

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

                    {!isAnyLoading && errorMessage && (
                        <span className="text-sm text-red-500 text-center mt-2">
                            {errorMessage}
                        </span>
                    )}
                </form>
                
                <p className="text-center sm:text-base text-sm mt-4">
                    <span className="opacity-60">{translations.noAccount}</span> 
                    <Link href={"/signup"} className="text-green-500 ml-1 font-semibold">
                        {translations.signUp}
                    </Link>
                </p>
            </section>
        </div>
    );
}

