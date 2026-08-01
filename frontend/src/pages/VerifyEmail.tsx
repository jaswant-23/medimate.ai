import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MailCheck, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const navigate = useNavigate();
  const { verifyEmail } = useAuthStore();

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        return;
      }
      const success = await verifyEmail(token);
      setStatus(success ? 'success' : 'error');
    };
    verify();
  }, [token, verifyEmail]);

  return (
    <div className="py-8 text-center">
      <div className="glass-panel p-6 rounded-2xl w-full animate-in fade-in zoom-in duration-500">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Verifying Email...</h2>
            <p className="text-slate-500 dark:text-slate-400">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center">
              <MailCheck className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Email Verified!</h2>
              <p className="text-slate-500 dark:text-slate-400">
                Your email has been successfully verified. You now have full access to MediMate AI.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="group flex items-center justify-center gap-2 w-full py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-primary hover:bg-primary/90 focus:outline-none transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50"
            >
              Go to Dashboard
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-6">
            <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Verification Failed</h2>
              <p className="text-slate-500 dark:text-slate-400">
                The verification link is invalid or has expired. Please request a new verification email from your dashboard.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="group flex items-center justify-center gap-2 w-full py-3 px-4 border border-slate-200 dark:border-white/10 text-sm font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 focus:outline-none transition-all"
            >
              Back to Home
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
};
