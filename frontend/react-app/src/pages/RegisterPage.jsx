import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.png';

const RegisterPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (phone.length < 10) {
      setError('Please provide a valid 10-digit phone number.');
      return;
    }

    setLoading(true);

    try {
      await register(fullName, email, phone, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Registration error:', err);
      setError(
        err.response?.data?.message ||
        'Registration failed. Please check the information provided and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen flex flex-col font-sans text-text-main antialiased selection:bg-primary-light selection:text-primary-dark justify-center">
      <main className="flex-grow flex items-center justify-center p-6 md:p-12 relative overflow-hidden">
        {/* Background Decor */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, #e6eeff, transparent 50%)' }}
        ></div>

        <div className="w-full max-w-[640px] z-10 flex flex-col items-center">
          {/* Header Section */}
          <div className="mb-10 text-center flex flex-col items-center gap-4">
            {/* Logo & Badge Container */}
            <div className="flex items-center gap-4 mb-2">
              {/* Logo */}
              <Link className="flex items-center gap-2 group" to="/">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xl leading-none">
                  <img src={logoImg} alt="CivicPulse Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-2xl font-bold tracking-tight text-text-main font-extrabold">CivicPulse</span>
              </Link>

              {/* Role Badge */}
              <div className="bg-surface-dim/30 text-text-main text-[10px] font-bold px-3 py-1 rounded-badge uppercase tracking-wider flex items-center gap-1 border border-surface-border">
                Citizen Account Onboarding
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold text-text-main tracking-tight">
              Join the Civic Network
            </h1>
            <p className="text-text-muted text-sm md:text-base max-w-sm">
              Register to start logging geolocated complaints in your city
            </p>
          </div>

          {/* Registration Card */}
          <div className="bg-surface-container-lowest w-full rounded-card shadow-soft border border-surface-border p-8 md:p-10 relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-primary to-purple-500"></div>

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-error-container/30 border border-error/30 text-error flex items-start gap-3">
                <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">error</span>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-2" htmlFor="fullName">
                  Full Name
                </label>
                <input
                  className="w-full bg-surface px-4 py-3 rounded-input border-surface-border border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-main placeholder-text-muted/60 font-medium"
                  id="fullName"
                  name="fullName"
                  placeholder="Jane Doe"
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-2" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    className="w-full bg-surface px-4 py-3 rounded-input border-surface-border border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-main placeholder-text-muted/60 font-medium"
                    id="email"
                    name="email"
                    placeholder="jane@example.com"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-2" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    className="w-full bg-surface px-4 py-3 rounded-input border-surface-border border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-main placeholder-text-muted/60 font-medium"
                    id="phone"
                    name="phone"
                    placeholder="9876543210"
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Password */}
                <div>
                  <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-2" htmlFor="password">
                    Password
                  </label>
                  <input
                    className="w-full bg-surface px-4 py-3 rounded-input border-surface-border border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-main placeholder-text-muted/60 font-medium"
                    id="password"
                    minLength={6}
                    name="password"
                    placeholder="Min 6 chars"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-2" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    className="w-full bg-surface px-4 py-3 rounded-input border-surface-border border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-text-main placeholder-text-muted/60 font-medium"
                    id="confirmPassword"
                    minLength={6}
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  className="w-full bg-gradient-to-r from-blue-500 to-primary hover:from-blue-600 hover:to-primary-dark text-white font-bold py-4 px-6 rounded-btn transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Citizen Account'}
                  <svg className="w-5 h-5" fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {/* Login Link */}
              <div className="text-center pt-6 border-t border-surface-border mt-6">
                <p className="text-sm text-text-muted">
                  Already registered?{' '}
                  <Link className="font-bold text-primary hover:text-primary-dark transition-colors" to="/login">
                    Sign In to existing account
                  </Link>
                </p>
              </div>
            </form>
          </div>

          {/* Footer Link */}
          <div className="mt-8">
            <Link className="text-sm font-medium text-text-muted hover:text-primary flex items-center gap-2 transition-colors" to="/">
              <span>←</span> Return to Homepage
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
