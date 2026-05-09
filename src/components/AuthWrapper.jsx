import React, { useEffect, useState } from 'react';
import AuthPage from '../pages/AuthPage';

export default function AuthWrapper({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('🔍 Retrieved token:', token);
    setIsAuthenticated(!!token);
  }, []);

  const handleLogin = () => {
    console.log('✅ Login callback triggered');
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    console.log('🚧 Rendering AuthPage (no token)');
    return <AuthPage onLogin={handleLogin} />;
  }

  return children;
}
