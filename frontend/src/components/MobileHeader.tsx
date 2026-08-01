import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Moon, Sun, ChevronLeft } from 'lucide-react';

interface MobileHeaderProps {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

// Map route paths to page titles
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/cabinet': 'Medicine Cabinet',
  '/cabinet/new': 'Add Medicine',
  '/explorer': 'Medicine Explorer',
  '/reminders': 'Reminders',
  '/profile': 'Profile',
};

export const MobileHeader = ({ darkMode, setDarkMode }: MobileHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Detect if we're on a nested/detail route needing a back button
  const isDetailRoute =
    location.pathname.startsWith('/cabinet/edit/') ||
    location.pathname.startsWith('/cabinet/new') ||
    location.pathname.startsWith('/medicine/') ||
    location.pathname.startsWith('/forgot-password') ||
    location.pathname.startsWith('/reset-password') ||
    location.pathname.startsWith('/verify-email');

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/cabinet/edit') ? 'Edit Medicine' : '') ||
    (location.pathname.startsWith('/medicine/') ? 'Medicine Details' : '') ||
    'MediMate AI';

  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(location.pathname);

  return (
    <header className="mobile-header">
      <div className="mobile-header-inner">
        {/* Left: Logo/Back */}
        <div className="mobile-header-left">
          {isDetailRoute ? (
            <button
              onClick={() => navigate(-1)}
              className="mobile-header-back-btn"
              aria-label="Go back"
            >
              <ChevronLeft size={22} />
            </button>
          ) : (
            <Link to="/" className="mobile-header-logo" aria-label="MediMate Home">
              <div className="mobile-header-logo-icon">
                <Activity size={18} strokeWidth={2.5} />
              </div>
            </Link>
          )}
        </div>

        {/* Center: Page Title */}
        <div className="mobile-header-title">
          {isDetailRoute || isAuthPage ? (
            <span>{pageTitle}</span>
          ) : (
            <div className="mobile-header-brand">
              <span className="mobile-header-brand-text">MediMate</span>
              <span className="mobile-header-brand-ai">AI</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="mobile-header-right">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="mobile-header-icon-btn"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <Sun size={18} className="text-yellow-400" />
            ) : (
              <Moon size={18} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
