import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, ArrowRight, Phone, MessageSquare, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Register = () => {
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');

  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const { register, verifyEmail, sendPhoneOtp, verifyPhoneOtp, socialLogin, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (registerMethod === 'email') {
      if (!emailVerificationRequired) {
        const success = await register(name, email, password);
        if (success) {
          setEmailVerificationRequired(true);
          setOtpMessage('Registration initiated. Please check your email for the verification link/code.');
        }
      } else {
        const success = await verifyEmail(verificationCode);
        if (success) {
          navigate('/');
        }
      }
    } else {
      if (!otpSent) {
        const success = await sendPhoneOtp(phone, 'SIGNUP');
        if (success) {
          setOtpSent(true);
          setOtpMessage('OTP has been printed to the server console.');
        }
      } else {
        const success = await verifyPhoneOtp(phone, otpCode, 'SIGNUP', name);
        if (success) {
          navigate('/');
        }
      }
    }
  };

  const handleGoogleSignup = async () => {
    clearError();
    const success = await socialLogin({
      email: 'google_user@medimate.local',
      fullName: 'Google User',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
      provider: 'google',
      token: 'mock-google-token'
    });
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="py-6">
      <div className="glass-panel p-6 rounded-2xl w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1 dark:text-white text-slate-800">
            {emailVerificationRequired ? 'Verify Email' : 'Create Account'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {emailVerificationRequired ? 'Enter the verification token sent to your email' : 'Join MediMate today'}
          </p>
        </div>

        {/* Tab Selector - Hide when verifying email */}
        {!emailVerificationRequired && (
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setRegisterMethod('email'); clearError(); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                registerMethod === 'email'
                  ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Email Register
            </button>
            <button
              onClick={() => { setRegisterMethod('phone'); clearError(); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                registerMethod === 'phone'
                  ? 'bg-white dark:bg-white/10 shadow-sm text-slate-900 dark:text-white'
                  : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Phone & OTP
            </button>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg mb-6 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={clearError} className="hover:text-destructive/80 font-bold px-2">×</button>
          </div>
        )}

        {otpMessage && (
          <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-lg mb-6 text-sm">
            {otpMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {emailVerificationRequired ? (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Verification Token / Link Code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <CheckCircle size={18} />
                </div>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white"
                  placeholder="Enter code from verification link"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Tip: Copy the `token` parameter value from the link printed in the server logs (or check your email).
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={otpSent}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white disabled:opacity-50"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              {registerMethod === 'email' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                        <Lock size={18} />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                        <Phone size={18} />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        disabled={otpSent}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white disabled:opacity-50"
                        placeholder="+919876543210"
                      />
                    </div>
                  </div>

                  {otpSent && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">6-Digit OTP Code</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                          <MessageSquare size={18} />
                        </div>
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          required
                          maxLength={6}
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white"
                          placeholder="123456"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {emailVerificationRequired ? (
                  'Verify & Complete Registration'
                ) : registerMethod === 'email' ? (
                  <>Create Account <ArrowRight size={18} /></>
                ) : (
                  <>{otpSent ? 'Verify & Register' : 'Send Verification OTP'}</>
                )}
              </>
            )}
          </button>
        </form>

        {!emailVerificationRequired && (
          <>
            <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase">Or continue with</span>
              <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
            </div>

            <button
              onClick={handleGoogleSignup}
              type="button"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all shadow-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.1C18.423 1.832 15.614 1 12.24 1 6.012 1 1 5.925 1 12s5.012 11 11.24 11c6.5 0 10.824-4.507 10.824-11 0-.74-.08-1.305-.18-1.715h-10.644z"
                />
              </svg>
              Google
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {emailVerificationRequired ? (
            <button
              onClick={() => { setEmailVerificationRequired(false); setVerificationCode(''); clearError(); }}
              className="text-primary font-medium hover:underline focus:outline-none"
            >
              ← Back to Registration
            </button>
          ) : (
            <>
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
