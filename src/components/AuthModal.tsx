import React, { useState } from 'react';
import { AppUser, UserRole } from '../types';
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Users
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  saveUserToCloud
} from '../firebase';
import { getApiUrl } from '../config';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AppUser, selectedRole: UserRole) => void;
  forceLogin?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  forceLogin = true
}) => {
  // Steps: 'google_sign_in' -> 'role_selection'
  const [step, setStep] = useState<'google_sign_in' | 'role_selection'>('google_sign_in');
  const [verifiedUser, setVerifiedUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dual auth states
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  // Handle Email & Password Login / Register
  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let authUser;
      if (emailMode === 'register') {
        authUser = await signUpWithEmail(email, password, fullName);
      } else {
        authUser = await signInWithEmail(email, password);
      }

      const appUser: AppUser = {
        id: authUser.uid,
        name: authUser.name,
        email: authUser.email,
        profilePhoto: authUser.photoUrl,
        avatar: authUser.photoUrl,
        authProvider: 'email',
        role: 'customer',
        verified: true,
        createdAt: new Date().toISOString()
      };

      await saveUserToCloud(appUser).catch((e) => console.warn('Firestore user save notice:', e));
      try {
        localStorage.setItem('quick_karya_user', JSON.stringify(appUser));
      } catch {}

      setVerifiedUser(appUser);
      setStep('role_selection');
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Primary Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // Real Google OAuth / Firebase Google Auth Provider Popup with account picker
      const gUser = await signInWithGoogle();

      const appUser: AppUser = {
        id: gUser.uid,
        name: gUser.name,
        email: gUser.email,
        profilePhoto: gUser.photoUrl,
        avatar: gUser.photoUrl,
        authProvider: 'google',
        role: 'customer',
        verified: true,
        createdAt: new Date().toISOString()
      };

      // Persist directly to Cloud Firestore & localStorage immediately
      await saveUserToCloud(appUser).catch((e) => console.warn('Firestore user save notice:', e));
      try {
        localStorage.setItem('quick_karya_user', JSON.stringify(appUser));
      } catch {}

      setVerifiedUser(appUser);
      setStep('role_selection');
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Confirm Role Selection
  const handleConfirmRole = async () => {
    if (!verifiedUser) return;
    setLoading(true);

    try {
      // Update role on backend
      const res = await fetch(getApiUrl('/api/auth/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: verifiedUser.id,
          name: verifiedUser.name,
          profilePhoto: verifiedUser.profilePhoto,
          role: selectedRole
        })
      });

      let updatedUser: AppUser = {
        ...verifiedUser,
        role: selectedRole
      };

      if (res.ok) {
        const data = await res.json();
        if (data.user) updatedUser = data.user;
      }

      // Persist to Cloud Firestore and localStorage
      await saveUserToCloud(updatedUser).catch((e) => console.warn('Firestore user update note:', e));
      localStorage.setItem('quick_karya_user', JSON.stringify(updatedUser));
      onLoginSuccess(updatedUser, selectedRole);
      onClose();
    } catch {
      // Fallback save locally
      verifiedUser.role = selectedRole;
      localStorage.setItem('quick_karya_user', JSON.stringify(verifiedUser));
      onLoginSuccess(verifiedUser, selectedRole);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="startup-auth-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div
        id="startup-auth-card"
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Brand Header with Running Technician Emblem & DIRECT ARTISAN CALL DIRECTORY */}
        <div className="bg-[#001F3F] p-6 text-white text-center relative border-b-2 border-amber-500">
          {!forceLogin && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-amber-300 hover:text-white p-1 rounded-full cursor-pointer text-sm"
            >
              ✕
            </button>
          )}

          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 mx-auto mb-2 shadow-lg ring-2 ring-amber-400/50">
            <img
              src="/assets/icon.png"
              alt="Quick Karya Official Running Technician Emblem"
              className="w-full h-full rounded-full object-cover shadow-sm"
            />
          </div>

          <h3 className="text-xl font-black tracking-tight text-white">Quick Karya</h3>
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-400 mt-1">
            DIRECT ARTISAN CALL DIRECTORY
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-[10px] bg-white/10 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-400/30">
              ⚡ 100% Free Contact
            </span>
            <span className="text-[10px] bg-white/10 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-400/30">
              🔒 No Password / OTP
            </span>
          </div>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Google Sign-In Flow */}
          {step === 'google_sign_in' && (
            <div className="space-y-4 text-center">
              <div className="pb-1">
                <h4 className="text-base font-bold text-gray-900">
                  Welcome to Quick Karya
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Sign in instantly with your Google Account for free, direct artisan phone contacts.
                </p>
              </div>

              {/* Prominent Official Google Sign-In Button */}
              <button
                type="button"
                id="btn-continue-with-google"
                onClick={() => handleGoogleSignIn()}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 text-sm font-bold rounded-2xl border-2 border-gray-300 hover:border-amber-400 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 group relative overflow-hidden"
              >
                {/* Standard Official Google Multicolored "G" SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="text-gray-900 group-hover:text-[#001F3F]">
                  {loading ? 'Signing in with Google...' : 'Continue with Google'}
                </span>
              </button>



              {/* Elegant Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-400 font-bold tracking-wider text-[10px]">
                    Or with Email & Password
                  </span>
                </div>
              </div>

              {/* Email & Password Authentication Form */}
              {!showEmailForm ? (
                <button
                  type="button"
                  id="btn-show-email-auth"
                  onClick={() => setShowEmailForm(true)}
                  className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>Sign in with Email & Password</span>
                </button>
              ) : (
                <form onSubmit={handleEmailAuthSubmit} className="space-y-3 text-left animate-in fade-in duration-200">
                  {/* Login vs Register Mode Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-center text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setEmailMode('login')}
                      className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                        emailMode === 'login'
                          ? 'bg-white text-[#001F3F] shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailMode('register')}
                      className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                        emailMode === 'register'
                          ? 'bg-white text-[#001F3F] shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  {emailMode === 'register' && (
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Sultan Ahamed"
                        className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-[#001F3F] hover:bg-[#002e5c] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-60"
                  >
                    {loading
                      ? 'Verifying...'
                      : emailMode === 'register'
                      ? 'Create Quick Karya Account'
                      : 'Sign In with Email'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEmailForm(false)}
                    className="w-full text-center text-[11px] text-gray-400 hover:text-gray-600 font-semibold cursor-pointer"
                  >
                    ← Back to Google Sign-In
                  </button>
                </form>
              )}

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-left space-y-1 mt-2">
                <p className="text-[11px] font-bold text-[#001F3F] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Free Direct Artisan Contact</span>
                </p>
                <p className="text-[10.5px] text-gray-500 leading-relaxed">
                  Your profile is securely stored. Phone number is only required if you register as a worker to receive incoming calls.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Role Selection (Customer vs Worker) */}
          {step === 'role_selection' && verifiedUser && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center">
                {verifiedUser.profilePhoto ? (
                  <div className="w-14 h-14 rounded-full mx-auto mb-2 p-0.5 border-2 border-amber-400 overflow-hidden shadow-md">
                    <img
                      src={verifiedUser.profilePhoto}
                      alt={verifiedUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                ) : (
                  <span className="w-12 h-12 rounded-full bg-amber-100 text-[#001F3F] inline-flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-7 h-7" />
                  </span>
                )}
                <h4 className="text-sm font-bold text-gray-900">
                  Welcome, {verifiedUser.name}!
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {verifiedUser.email} • Choose how you wish to proceed:
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Option 1: Customer */}
                <button
                  type="button"
                  onClick={() => setSelectedRole('customer')}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedRole === 'customer'
                      ? 'border-[#001F3F] bg-blue-50/70 shadow-xs ring-1 ring-[#001F3F]'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedRole === 'customer'
                        ? 'bg-[#001F3F] text-amber-300'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">I am a Customer</span>
                      {selectedRole === 'customer' && (
                        <span className="text-[#001F3F] font-bold text-xs">✓ Selected</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Browse & call local artisans directly, view live GPS proximity, and leave ratings.
                    </p>
                  </div>
                </button>

                {/* Option 2: Worker */}
                <button
                  type="button"
                  onClick={() => setSelectedRole('worker')}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedRole === 'worker'
                      ? 'border-[#001F3F] bg-amber-50/70 shadow-xs ring-1 ring-amber-500'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedRole === 'worker'
                        ? 'bg-[#001F3F] text-amber-300'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">I am an Artisan / Worker</span>
                      {selectedRole === 'worker' && (
                        <span className="text-[#001F3F] font-bold text-xs">✓ Selected</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      Get your Permanent Worker ID and list your skills for direct client calls.
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmRole}
                disabled={loading}
                className="w-full py-3.5 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
              >
                {loading
                  ? 'Configuring Profile...'
                  : selectedRole === 'worker'
                  ? 'Continue to Worker Registration →'
                  : 'Start Browsing Directory →'}
              </button>
            </div>
          )}

          {/* Privacy Footnote */}
          <p className="text-[10px] text-gray-400 text-center leading-relaxed pt-1">
            Protected by Quick Karya Caller ID privacy masking. 100% free proximity connection.
          </p>
        </div>
      </div>
    </div>
  );
};
