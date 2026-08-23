import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/logo.png';

const LandingNavbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-surface/80 backdrop-blur-md dark:bg-surface-container/80 full-width top-0 sticky shadow-sm z-50">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 font-headline-sm text-headline-sm font-extrabold text-on-surface dark:text-surface-bright">
          <img src={logoImg} alt="CivicPulse Logo" className="w-8 h-8 object-contain" />
          <span>CivicPulse</span>
        </Link>

        {/* Nav Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 font-label-md text-label-md">
          <Link className="text-primary dark:text-inverse-primary border-b-2 border-primary pb-1" to="/">
            Home
          </Link>
          <a className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors hover:bg-primary-container/10 dark:hover:bg-primary-container/20 rounded-lg px-2 py-1" href="#how-it-works">
            How it Works
          </a>
          <a className="text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-inverse-primary transition-colors hover:bg-primary-container/10 dark:hover:bg-primary-container/20 rounded-lg px-2 py-1" href="#categories">
            Categories
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
              >
                Dashboard ({user?.name || 'Citizen'})
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="bg-surface text-primary border border-outline-variant font-label-md text-label-md px-6 py-2.5 rounded-lg hover:bg-surface-container-low transition-all min-h-[48px] flex items-center justify-center"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                to="/login"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-all shadow-level-1 hover:shadow-level-2 transform hover:-translate-y-0.5 min-h-[48px] flex items-center justify-center"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-on-surface p-2 focus:outline-none"
          aria-label="Toggle Menu"
        >
          <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface border-t border-outline-variant/30 px-margin-mobile py-4 flex flex-col gap-3 shadow-lg">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="text-primary font-bold py-2"
          >
            Home
          </Link>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="text-on-surface-variant hover:text-primary py-2"
          >
            How it Works
          </a>
          <a
            href="#categories"
            onClick={() => setMobileMenuOpen(false)}
            className="text-on-surface-variant hover:text-primary py-2"
          >
            Categories
          </a>
          <div className="pt-3 border-t border-outline-variant/20 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full bg-primary text-on-primary text-center py-2.5 rounded-lg font-label-md"
                >
                  Go to Dashboard
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    navigate('/');
                  }}
                  className="w-full text-center py-2 text-on-surface-variant font-label-md"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 text-on-surface-variant hover:text-primary font-label-md"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full bg-primary text-on-primary text-center py-2.5 rounded-lg font-label-md shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNavbar;
