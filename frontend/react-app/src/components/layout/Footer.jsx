import React from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../../assets/images/logo.png';

const Footer = ({ className = '' }) => {
  return (
    <footer className={`bg-surface dark:bg-surface-dim full-width border-t border-outline-variant/50 flat no shadows ${className}`}>
      <div className="flex flex-col gap-unit w-full px-margin-mobile md:px-margin-desktop py-12 max-w-container-max mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b border-outline-variant/30 pb-8">
          <div className="flex items-center gap-2 font-headline-sm text-headline-sm font-bold text-on-surface dark:text-surface-bright">
            <img src={logoImg} alt="CivicPulse Logo" className="w-8 h-8 object-contain" />
            <span>CivicPulse</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 font-label-sm text-label-sm">
            <Link className="text-primary font-semibold underline decoration-primary/30 underline-offset-4" to="/">
              Home
            </Link>
            <a className="text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-colors" href="#how-it-works">
              How it Works
            </a>
            <a className="text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-colors" href="#categories">
              Categories
            </a>
            <Link className="text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-colors" to="/login">
              Sign In
            </Link>
            <Link className="text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-colors" to="/register">
              Create Account
            </Link>
          </nav>
          <div className="flex gap-4 text-on-surface-variant">
            <span className="material-symbols-outlined hover:text-primary cursor-pointer transition-colors">public</span>
            <span className="material-symbols-outlined hover:text-primary cursor-pointer transition-colors">share</span>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center pt-6 text-on-surface-variant font-body-md text-body-md text-sm">
          <p>Civic Issue Reporting System</p>
          <p className="mt-2 md:mt-0">© 2026 CivicPulse — Empowering Communities Through Digital Governance</p>
        </div>
        <div className="text-center font-headline-sm text-headline-sm font-bold mt-4 text-on-surface opacity-50">
          See It. Report It. Fix It.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
