import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 🔧 FORCE backend base URL while we debug env issues
const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;
console.log('AuthPage → API_BASE =', API_BASE);

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [error, setError] = useState('');
  const [signupError, setSignupError] = useState('');
  const navigate = useNavigate();

  const saveAuthAndProceed = ({ token, role, plan, emailOrName }) => {
    if (!token) throw new Error('No token returned from server');
    // ✅ Persist auth for gating & API calls
    localStorage.setItem('token', token);
    if (role) localStorage.setItem('role', role);
    if (plan) localStorage.setItem('plan', plan);
    if (emailOrName) localStorage.setItem('userName', emailOrName);

    // Optional callback + navigation
    onLogin?.();
    navigate('/control-tower');
  };

  const handleLogin = async () => {
    setError('');
    try {
      const url = `${API_BASE}/auth/login`;
      console.log('POST →', url);
      const res = await axios.post(
        url,
        { email: loginEmail, password: loginPassword },
        { headers: { 'Content-Type': 'application/json' } }
      );

      // Backend returns: { token, role, plan }
      const token = res.data?.token || res.data?.access_token;
      const role = res.data?.role;
      const plan = res.data?.plan;

      const ok = !!token;
      if (!ok) throw new Error(res.data?.message || 'Login failed');

      saveAuthAndProceed({
        token,
        role,
        plan,
        emailOrName: loginEmail,
      });
    } catch (err) {
      console.error('❌ Login error:', err.response?.data || err.message);
      setError(err.response?.data?.message || err.message || 'Login error');
    }
  };

  const handleSignup = async () => {
    setSignupError('');
    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError('Please fill out all fields');
      return;
    }

    try {
      const url = `${API_BASE}/auth/signup`;
      console.log('POST →', url);
      // Your backend ignores "name" for creation; it's fine to keep it here for UI
      await axios.post(
        url,
        { name: signupName, email: signupEmail, password: signupPassword },
        { headers: { 'Content-Type': 'application/json' } }
      );

      // If signup doesn’t return a token, auto-login:
      const loginUrl = `${API_BASE}/auth/login`;
      console.log('POST →', loginUrl);
      const loginRes = await axios.post(
        loginUrl,
        { email: signupEmail, password: signupPassword },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const token = loginRes.data?.token || loginRes.data?.access_token;
      const role = loginRes.data?.role;
      const plan = loginRes.data?.plan;

      const ok = !!token;
      if (!ok) throw new Error(loginRes.data?.message || 'Signup/login failed');

      saveAuthAndProceed({
        token,
        role,
        plan,
        emailOrName: signupName || signupEmail,
      });
    } catch (err) {
      console.error('❌ Signup error:', err.response?.data || err.message);
      setSignupError(err.response?.data?.message || err.message || 'Signup error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFDF8] px-4">
      <style>{`
        @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        .blinking-eye { animation: blink 5s infinite; transform-origin: center; }
      `}</style>

      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6 space-y-3">
          <div className="bg-white p-2 rounded-full">
            <img src="/eye-logo.png" alt="Eye Logo" className="h-16 w-16 object-contain blinking-eye" />
          </div>
          <img src="/logo.png" alt="FOR-C Logo" className="h-10 object-contain" />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">
          {mode === 'login' ? 'Log In to FOR-C' : 'Create Your FOR-C Account'}
        </h2>

        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Full Name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            className="border w-full p-2 mb-3 rounded"
          />
        )}

        <input
          type="email"
          placeholder="Email Address"
          value={mode === 'login' ? loginEmail : signupEmail}
          onChange={(e) => (mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value))}
          className="border w-full p-2 mb-3 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={mode === 'login' ? loginPassword : signupPassword}
          onChange={(e) => (mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value))}
          className="border w-full p-2 mb-4 rounded"
        />

        {mode === 'login' && error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {mode === 'signup' && signupError && <div className="text-red-600 text-sm mb-2">{signupError}</div>}

        <button
          onClick={mode === 'login' ? handleLogin : handleSignup}
          className="w-full bg-[#1D625B] text-white py-2 rounded hover:bg-[#155248]"
        >
          {mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>

        <div className="mt-4 text-sm text-center">
          {mode === 'login' ? (
            <>
              Don’t have an account?{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="text-blue-600 hover:underline" onClick={() => setMode('login')}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
