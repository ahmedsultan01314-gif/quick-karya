import React, { useState, useEffect } from 'react';
import { AppUser, UserRole } from '../types';
import {
  ShieldCheck,
  Phone,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Users
} from 'lucide-react';
import {
  sendFirebasePhoneOtp,
  verifyFirebasePhoneOtp,
  saveUserToCloud
} from '../firebase';

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
  // Steps: 'phone' -> 'otp' -> 'role_selection'
  const [step, setStep] = useState<'phone' | 'otp' | 'role_selection'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedUser, setVerifiedUser] = useState<AppUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testOtpHint, setTestOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // 1. Send OTP natively via Firebase Phone Auth SDK
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setTestOtpHint(null);

    if (!name.trim()) {
      setError('Please enter your Full Name to continue.');
      return;
    }

    const clean = phone.replace(/[^0-9]/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    try {
      // Direct Firebase Phone Auth SDK native dispatch
      try {
        await sendFirebasePhoneOtp(clean);
        setStep('otp');
        setResendCooldown(60);
        setSuccessMsg(`SMS verification code dispatched natively via Firebase Phone Auth to +91 ${clean}.`);
        setOtp('');
      } catch (fbErr: any) {
        console.warn('Firebase Phone Auth attempt:', fbErr);
        // Seamless fallback to server-side SMS dispatch if Firebase auth restrictions occur in preview sandbox
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: clean })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(fbErr?.message || data.error || 'Failed to dispatch verification code');
        }

        setStep('otp');
        setResendCooldown(45);
        setSuccessMsg(data.message || `6-digit verification code sent directly to +91 ${clean}.`);
        setOtp('');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while sending OTP');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP natively via Firebase Phone Auth SDK
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const clean = phone.replace(/[^0-9]/g, '').slice(-10);
      let appUser: AppUser | null = null;

      // 1. Verify through Firebase Phone Auth SDK
      try {
        const firebaseUser = await verifyFirebasePhoneOtp(otp.trim());
        if (firebaseUser) {
          appUser = {
            id: firebaseUser.uid,
            phone: `+91 ${clean}`,
            name: name.trim(),
            role: 'customer',
            verified: true,
            createdAt: new Date().toISOString()
          };
          // Persist directly to Cloud Firestore
          await saveUserToCloud(appUser).catch((e) => console.warn('Firestore user save note:', e));
        }
      } catch (fbVerifyErr: any) {
        console.warn('Firebase Phone Auth verify, trying server verification:', fbVerifyErr);
        // Fallback to server verify if code was dispatched via backend
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: clean,
            code: otp.trim(),
            name: name.trim() || undefined
          })
        });
        const data = await res.json();
        if (res.ok && data.user) {
          appUser = data.user;
        } else {
          throw new Error(fbVerifyErr?.message || data.error || 'Invalid OTP code');
        }
      }

      if (!appUser) {
        throw new Error('Verification failed. Please check the code and try again.');
      }

      setVerifiedUser(appUser);
      setStep('role_selection');
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 3. Confirm Role Selection
  const handleConfirmRole = async () => {
    if (!verifiedUser) return;
    setLoading(true);

    try {
      // Update role on backend
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: verifiedUser.id,
          name: name.trim() || verifiedUser.name,
          role: selectedRole
        })
      });

      let updatedUser: AppUser = {
        ...verifiedUser,
        role: selectedRole,
        name: name.trim() || verifiedUser.name
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
    } catch (err: any) {
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
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-900/10 flex flex-col animate-in fade-in zoom-in-95 duration-200 my-auto"
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
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && step === 'otp' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#001F3F] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Phone & Name Input */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center pb-1">
                <h4 className="text-sm font-bold text-gray-900">
                  Welcome! Verify Mobile to Get Started
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter your phone number to receive a verification code.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 rounded-xl border border-gray-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-medium"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-bold text-gray-500 font-mono">
                    +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full pl-12 pr-3.5 py-2.5 text-xs bg-gray-50 rounded-xl border border-gray-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono font-bold"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  A real 6-digit SMS OTP will be dispatched via Firebase Phone Auth to your mobile inbox.
                </p>
              </div>

              {/* Invisible / AppCheck Firebase Recaptcha Container */}
              <div id="recaptcha-container" className="flex justify-center"></div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full py-3 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Sending SMS OTP...' : 'Send Verification OTP'}
                <ArrowRight className="w-4 h-4 text-amber-400" />
              </button>
            </form>
          )}

          {/* STEP 2: 6-Digit OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <h4 className="text-sm font-bold text-gray-900">Enter Verification Code</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Code sent to <span className="font-bold text-gray-800 font-mono">+91 {phone}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-[11px] text-emerald-700 hover:underline mt-0.5"
                >
                  Change phone number
                </button>
              </div>

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-widest text-2xl font-mono py-2.5 bg-gray-50 rounded-xl border border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-bold"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-3 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Verifying OTP...' : 'Verify & Select Role'}
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </button>

              <div className="text-center pt-1">
                {resendCooldown > 0 ? (
                  <p className="text-[11px] text-gray-400">
                    Resend OTP in {resendCooldown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    className="text-xs text-emerald-800 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Resend Code</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 3: Mandatory Role Selection (Customer vs Worker) */}
          {step === 'role_selection' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="text-center">
                <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center justify-center mb-1">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <h4 className="text-sm font-bold text-gray-900">Phone Verified!</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  How would you like to use Quick Karya?
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
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === 'customer' ? 'bg-[#001F3F] text-amber-300' : 'bg-gray-200 text-gray-600'
                  }`}>
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
                      Find & call local workers directly, share GPS for service, and rate completed work.
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
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedRole === 'worker' ? 'bg-[#001F3F] text-amber-300' : 'bg-gray-200 text-gray-600'
                  }`}>
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
                      Get your Permanent Worker ID and publish your profile to get direct client calls.
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmRole}
                disabled={loading}
                className="w-full py-3 bg-[#001F3F] hover:bg-[#002e5d] active:bg-[#00162e] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
              >
                {loading
                  ? 'Setting up Profile...'
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
