import React, { useState } from 'react';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { OrbitAnimation } from './OrbitAnimation.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { requestGoogleSignIn } from '../../services/googleAuth.ts';
import { ArrowRight, Mail, KeyRound, Loader2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { refreshUser } = useAuth();
  
  // States: 'email_input' | 'otp_verify'
  const [step, setStep] = useState<'email_input' | 'otp_verify'>('email_input');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.sendOtp(cleanEmail);
      if (res.success) {
        setStep('otp_verify');
        if (res.devCode) {
          setDevOtp(res.devCode);
          setOtpCode(res.devCode); // Auto-fill in dev mode for maximum user delight
        }
        setResendCooldown(60);
      } else {
        setError(res.error || 'Failed to send verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
      setError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp(email.trim().toLowerCase(), cleanCode);
      if (res.success) {
        await refreshUser();
        onSuccess();
      } else {
        setError(res.error || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // Trigger Google Identity Services OAuth popup flow with full Workspace permissions
      const profile = await requestGoogleSignIn();
      const res = await api.signInWithGoogle(
        profile.email,
        profile.name,
        profile.avatar,
        profile.accessToken
      );
      if (res.success) {
        await refreshUser();
        onSuccess();
      }
    } catch (err: any) {
      setError('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Microsoft OAuth
  const handleMicrosoftSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.signInWithMicrosoft(
        'alex.smith@outlook.com',
        'Alex Smith'
      );
      if (res.success) {
        await refreshUser();
        onSuccess();
      }
    } catch (err: any) {
      setError('Microsoft Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-white via-[#faf6f8] to-[#fcfafc] text-slate-800">
      {/* Left Panel: Authentication */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex-shrink-0 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-r border-slate-100 bg-white/70 backdrop-blur-md">
        {/* Top Header & Branding */}
        <div>
          <div className="flex items-center gap-3">
            <OrbitLogo size="md" glow={true} />
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Orbit <span className="text-purple-600">AI</span>
            </span>
          </div>

          <div className="mt-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Your AI, in orbit around everything you do. Connect your tools, conversations, and tasks.
            </p>
          </div>

          {/* Social Sign-In Buttons */}
          <div className="mt-8 space-y-3">
            <button
              id="google-signin-button"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700 text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              Continue with Google
            </button>

            <button
              id="microsoft-signin-button"
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 text-slate-700 text-sm font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Continue with Outlook / Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">Or continue with email</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200/60 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Enter Email */}
          {step === 'email_input' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="email-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Work or personal email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              <button
                id="send-otp-button"
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Sign in with email
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="otp-input" className="block text-xs font-semibold text-slate-700">
                    6-digit verification code
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('email_input')}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Change email
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="otp-input"
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-center font-mono text-lg tracking-widest text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                {devOtp && (
                  <div className="mt-2.5 p-2 rounded-lg bg-purple-50 border border-purple-100 flex items-center gap-2 text-xs text-purple-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    <span>Dev Code generated: <strong className="font-mono">{devOtp}</strong></span>
                  </div>
                )}
              </div>

              <button
                id="verify-otp-button"
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Bottom Footer */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Orbit AI Platform © 2026</span>
          <span className="hover:text-slate-600 transition-colors cursor-pointer">Privacy & Security</span>
        </div>
      </div>

      {/* Right Panel: Orbital Animation */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative p-8">
        <OrbitAnimation />
      </div>
    </div>
  );
};
