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
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

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
        <div className="flex-1 relative overflow-hidden flex">
            {/* Animated background gradient */}
            <div className="fixed inset-0 z-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black">
                <div className="absolute inset-0 bg-gradient-mesh opacity-30 animate-mesh-gradient" />
            </div>

            {/* Floating decorative shapes - only on right side */}
            <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
                <div className="absolute top-20 right-10 w-64 h-64 bg-themeGreen/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-20 right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
            </div>

            {/* Left side - Branding (hidden on mobile) */}
            <div className="hidden lg:block lg:w-1/3 relative z-10 border-r border-white/10">
                <div className="sticky top-0 h-screen flex items-center justify-center p-8">
                    <div className="text-center space-y-6">
                        <Link href={'/'} className="inline-block">
                            <Image
                                src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"}
                                alt="logo"
                                height={100}
                                width={100}
                                className="filter invert transition-transform hover:scale-110 duration-300 mx-auto"
                                priority
                            />
                        </Link>
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-3">
                                Bon retour !
                            </h2>
                            <p className="text-white/70 text-lg">
                                Connectez-vous pour accéder à votre profil
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right side - Form */}
            <div className="flex-1 relative z-10 overflow-y-auto">
                {/* Language Switcher - Fixed top-right */}
                <div className="absolute top-6 right-6 z-50">
                    <LanguageSwitcher variant="dark" />
                </div>

                <div className="min-h-screen flex flex-col">
                    {/* Logo - only visible on mobile */}
                    <Link href={'/'} className="lg:hidden p-6 w-fit">
                        <Image
                            src={"https://firebasestorage.googleapis.com/v0/b/lintre-ffa96.firebasestorage.app/o/Logo%2Fimage-removebg-preview.png?alt=media&token=4ac6b2d0-463e-4ed7-952a-2fed14985fc0"}
                            alt="logo"
                            height={70}
                            width={70}
                            className="filter invert transition-transform hover:scale-110 duration-300"
                            priority
                        />
                    </Link>

                    {/* Main form section */}
                    <section className="flex-1 flex items-center justify-center px-4 py-8">
                        <div className="w-full max-w-md">
                            {/* Glass card container */}
                            <div className="glass-strong rounded-3xl p-8 sm:p-10 backdrop-blur-xl border border-white/20 shadow-2xl">
                                <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
                                    {translations.title}
                                </h1>

                                <form className="mt-8 flex flex-col gap-5 w-full" onSubmit={handleSubmit}>
                                    {/* Username input */}
                                    <div className={`flex items-center py-3 px-4 rounded-xl transition-all duration-300 ${
                                        usernameStatus === 1 ? "bg-red-500/10 border-2 border-red-500/50" :
                                        usernameStatus === 2 ? "bg-themeGreen/10 border-2 border-themeGreen/50" :
                                        "bg-white/10 border-2 border-white/20 hover:border-white/40"
                                    }`}>
                                        <label className="text-white/60 font-semibold whitespace-nowrap">weavink.com/</label>
                                        <input
                                            type="text"
                                            placeholder={translations.usernamePlaceholder}
                                            className="outline-none border-none bg-transparent ml-2 flex-1 text-white placeholder:text-white/40"
                                            value={username}
                                            onChange={handleUsernameChange}
                                            required
                                            disabled={isAnyLoading}
                                        />
                                        {isCheckingUsername ? (
                                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-themeGreen rounded-full"></div>
                                        ) : usernameStatus === 1 ? (
                                            <FaX className="text-red-400 cursor-pointer hover:text-red-300" onClick={() => setUsername("")} />
                                        ) : usernameStatus === 2 ? (
                                            <FaCheck className="text-themeGreen" />
                                        ) : null}
                                    </div>

                                    {/* Password input */}
                                    <div className={`flex items-center py-3 px-4 rounded-xl transition-all duration-300 ${
                                        passwordStatus === 1 ? "bg-red-500/10 border-2 border-red-500/50" :
                                        passwordStatus === 2 ? "bg-themeGreen/10 border-2 border-themeGreen/50" :
                                        "bg-white/10 border-2 border-white/20 hover:border-white/40"
                                    }`}>
                                        <input
                                            type={seePassword ? "password" : "text"}
                                            placeholder={translations.passwordPlaceholder}
                                            className="outline-none border-none bg-transparent flex-1 text-white placeholder:text-white/40"
                                            value={password}
                                            onChange={handlePasswordChange}
                                            required
                                            disabled={isAnyLoading}
                                        />
                                        {seePassword ? (
                                            <FaEyeSlash
                                                className="text-white/60 cursor-pointer hover:text-white ml-2"
                                                onClick={() => setSeePassword(!seePassword)}
                                            />
                                        ) : (
                                            <FaEye
                                                className="text-themeGreen cursor-pointer hover:text-green-400 ml-2"
                                                onClick={() => setSeePassword(!seePassword)}
                                            />
                                        )}
                                    </div>

                                    {/* Forgot password link */}
                                    <Link
                                        href={"/forgot-password"}
                                        className="text-themeGreen hover:text-green-400 text-sm font-medium transition-colors w-fit"
                                    >
                                        {translations.forgotPassword}
                                    </Link>

                                    {/* Submit button */}
                                    <button
                                        type="submit"
                                        disabled={!canProceed || isAnyLoading}
                                        className={`relative mt-2 rounded-xl py-4 font-bold text-white text-lg transition-all duration-300 overflow-hidden ${
                                            canProceed && !isAnyLoading
                                                ? "cursor-pointer hover:scale-105 hover:shadow-2xl hover:shadow-themeGreen/50 active:scale-95"
                                                : "cursor-not-allowed opacity-50"
                                        }`}
                                    >
                                        <div className={`absolute inset-0 ${canProceed && !isAnyLoading ? "bg-gradient-to-r from-themeGreen to-blue-500 animate-gradient-flow" : "bg-gray-600"}`} style={{ backgroundSize: '200% 200%' }}></div>
                                        <span className="relative z-10">
                                            {!isLoading ? translations.signIn : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            )}
                                        </span>
                                    </button>

                                    {/* Divider */}
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-white/20" />
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="bg-gray-900/80 px-3 text-white/60">
                                                {translations.continueWith}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Google sign-in button */}
                                    <button
                                        type="button"
                                        onClick={handleGoogleSignIn}
                                        disabled={isAnyLoading}
                                        className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/10 border-2 border-white/20 font-semibold text-white transition-all duration-300 ${
                                            !isAnyLoading
                                                ? "cursor-pointer hover:bg-white/20 hover:border-white/40 active:scale-95"
                                                : "cursor-not-allowed opacity-50"
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
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                    </button>

                                    {/* Error message */}
                                    {!isAnyLoading && errorMessage && (
                                        <div className="mt-2 p-3 bg-red-500/10 border border-red-500/50 rounded-xl">
                                            <span className="text-sm text-red-400 text-center block">
                                                {errorMessage}
                                            </span>
                                        </div>
                                    )}
                                </form>

                                {/* Sign up link */}
                                <p className="text-center text-sm mt-6 text-white/70">
                                    <span>{translations.noAccount}</span>
                                    <Link
                                        href={"/signup"}
                                        className="text-themeGreen hover:text-green-400 ml-1 font-semibold transition-colors"
                                    >
                                        {translations.signUp}
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

