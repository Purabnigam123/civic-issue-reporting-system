import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/images/logo.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.message ||
        'Invalid email or password. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setDemoLoading(true);

    try {
      await loginAsDemo();
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Demo login error:', err);
      setError(
        err.response?.data?.message ||
        'Failed to log in with demo account. Ensure the backend and database are running.'
      );
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop relative overflow-hidden">
      {/* Subtle Background Accent for Light Airy Aesthetic */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary-fixed/30 to-transparent -z-10 pointer-events-none"></div>

      {/* Login Container */}
      <div className="w-full max-w-[480px] z-10 flex flex-col items-center">
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm overflow-hidden shadow-sm">
              <img src={logoImg} alt="CivicPulse Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface font-extrabold">CivicPulse</h1>
          </Link>

          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2 font-bold">
            Welcome Back
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant text-center">
            Sign in to track complaints and report neighborhood issues
          </p>
        </div>

        {/* Main Card */}
        <div className="w-full bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 civic-glow-shadow">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-error-container/30 border border-error/30 text-error flex items-start gap-3">
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">error</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Demo Account Action */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="w-full h-12 bg-primary-fixed text-on-primary-fixed-variant rounded-lg flex items-center justify-center gap-2 hover:bg-primary-fixed-dim transition-colors mb-6 group disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">
              bolt
            </span>
            <span className="font-label-md text-label-md">
              {demoLoading ? 'Logging in as Demo...' : 'Continue with Demo Account'}
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-outline-variant/40"></div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-widest">
              or login with email
            </span>
            <div className="flex-1 h-px bg-outline-variant/40"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-label-md text-on-surface uppercase" htmlFor="email">
                Citizen Email
              </label>
              <input
                className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md placeholder:text-outline-variant"
                id="email"
                name="email"
                placeholder="name@example.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md text-on-surface uppercase" htmlFor="password">
                  Password
                </label>
              </div>
              <input
                className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-transparent text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md placeholder:text-outline-variant"
                id="password"
                name="password"
                placeholder="••••••••"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Submit Action */}
            <button
              className="w-full h-12 mt-2 bg-primary text-on-primary rounded-lg flex items-center justify-center gap-2 hover:bg-surface-tint transition-colors group disabled:opacity-50"
              type="submit"
              disabled={loading || demoLoading}
            >
              <span className="font-label-md text-label-md">
                {loading ? 'Signing in...' : 'Sign In to Dashboard'}
              </span>
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                arrow_right_alt
              </span>
            </button>
          </form>

          {/* Create Account Link */}
          <div className="mt-8 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Don't have an account?{' '}
              <Link
                className="text-primary font-semibold hover:underline decoration-primary/30 underline-offset-4 transition-all"
                to="/register"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* Return Link */}
        <div className="mt-8">
          <Link
            className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors group"
            to="/"
          >
            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-1 transition-transform">
              keyboard_backspace
            </span>
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
