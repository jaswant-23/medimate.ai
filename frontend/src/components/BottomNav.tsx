import { Link, useLocation } from 'react-router-dom';
import { Home, Pill, Search, Clock, User } from 'lucide-react';

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/cabinet', icon: Pill, label: 'Cabinet' },
  { path: '/explorer', icon: Search, label: 'Explorer' },
  { path: '/reminders', icon: Clock, label: 'Reminders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export const BottomNav = () => {
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {tabs.map(({ path, icon: Icon, label }) => {
        // Active if exact match or starts with path (for nested routes)
        const isActive =
          path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

        return (
          <Link
            key={path}
            to={path}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            aria-label={label}
          >
            <div className="bottom-nav-icon-wrapper">
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              {isActive && <div className="bottom-nav-active-dot" />}
            </div>
            <span className="bottom-nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
