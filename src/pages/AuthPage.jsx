import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

console.log("✅ CLEAN AuthPage.jsx loaded");

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [error, setError] = useState('');
  const [signupError, setSignupError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE}/login`, {
        username: loginEmail,
        password: loginPassword,
      });

      if (res.data.access_token) {
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('userName', loginEmail); // 👈 Store fallback name
        onLogin();
        navigate('/control-tower');
      } else {
        setError(res.data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login error');
    }
  };

  const handleSignup = async () => {
    if (!signupName || !signupEmail || !signupPassword) {
      setSignupError('Please fill out all fields');
      return;
    }

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE}/signup`, {
        name: signupName,
        username: signupEmail,
        password: signupPassword,
      });

      if (res.data.status === 'success') {
        const loginRes = await axios.post(`${import.meta.env.VITE_API_BASE}/login`, {
          username: signupEmail,
          password: signupPassword,
        });

        const token = loginRes.data.access_token;
        localStorage.setItem('token', token);
        localStorage.setItem('userName', signupName); // 👈 Store actual name
        onLogin();
        navigate('/control-tower');
      } else {
        setSignupError(res.data.message || 'Signup failed');
      }
    } catch (err) {
      setSignupError(err.response?.data?.message || 'Signup error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFDF8] px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <img src="/logo.png" alt="FOR-C Logo" className="h-10 mb-4 mx-auto" />
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
          onChange={(e) =>
            mode === 'login' ? setLoginEmail(e.target.value) : setSignupEmail(e.target.value)
          }
          className="border w-full p-2 mb-3 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          value={mode === 'login' ? loginPassword : signupPassword}
          onChange={(e) =>
            mode === 'login' ? setLoginPassword(e.target.value) : setSignupPassword(e.target.value)
          }
          className="border w-full p-2 mb-4 rounded"
        />

        {(mode === 'login' && error) && (
          <div className="text-red-600 text-sm mb-2">{error}</div>
        )}
        {(mode === 'signup' && signupError) && (
          <div className="text-red-600 text-sm mb-2">{signupError}</div>
        )}

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
