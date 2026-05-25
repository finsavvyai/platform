import React, { useState, useEffect } from 'react';
import { LogIn, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/use-api';

interface AuthComponentProps {
  onAuthSuccess?: (user: any) => void;
  onAuthError?: (error: string) => void;
  className?: string;
}

export const AuthComponent: React.FC<AuthComponentProps> = ({
  onAuthSuccess,
  onAuthError,
  className = '',
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: '',
  });

  const {
    isAuthenticated,
    user,
    loading: authLoading,
    login,
    register,
    logout,
  } = useAuth();

  const {
    loading: loginLoading,
    error: loginError,
    execute: executeLogin,
  } = login;

  const {
    loading: registerLoading,
    error: registerError,
    execute: executeRegister,
  } = register;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      return 'Email and password are required';
    }

    if (!formData.email.includes('@')) {
      return 'Please enter a valid email address';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!isLogin) {
      if (!formData.name || formData.name.trim().length < 2) {
        return 'Name must be at least 2 characters long';
      }

      if (formData.password !== formData.confirmPassword) {
        return 'Passwords do not match';
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      onAuthError?.(validationError);
      return;
    }

    try {
      if (isLogin) {
        await executeLogin(formData.email, formData.password);
      } else {
        await executeRegister(formData.email, formData.password, formData.name);
      }

      // Auth success will be handled by the useAuth hook
      onAuthSuccess?.(user);
    } catch (error: any) {
      onAuthError?.(error.message || 'Authentication failed');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      email: '',
      password: '',
      name: '',
      confirmPassword: '',
    });
  };

  const error = loginError || registerError;

  // If already authenticated, show user info
  if (isAuthenticated && user) {
    return (
      <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
        <div className=\"flex items-center justify-between mb-4\">
          <div className=\"flex items-center space-x-3\">
            <div className=\"w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center\">
              <User className=\"w-6 h-6 text-white\" />
            </div>
            <div>
              <h3 className=\"font-semibold text-gray-900\">{user.name}</h3>
              <p className=\"text-sm text-gray-500\">{user.email}</p>
            </div>
          </div>
          <div className=\"flex items-center space-x-2\">
            <span className=\"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800\">
              {user.subscription?.tier || 'Free'} Plan
            </span>
          </div>
        </div>

        <div className=\"flex space-x-3\">
          <button
            onClick={() => logout.execute()}
            disabled={logout.loading}
            className=\"flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed\"
          >
            {logout.loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-md w-full mx-auto ${className}`}>
      <div className=\"bg-white rounded-lg shadow-lg p-6\">
        {/* Header */}
        <div className=\"text-center mb-6\">
          <div className=\"w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4\">
            <LogIn className=\"w-8 h-8 text-white\" />
          </div>
          <h2 className=\"text-2xl font-bold text-gray-900\">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className=\"text-gray-600 mt-2\">
            {isLogin
              ? 'Sign in to access your QueryFlux dashboard'
              : 'Get started with QueryFlux today'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className=\"mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2\">
            <AlertCircle className=\"w-5 h-5 text-red-500 flex-shrink-0\" />
            <p className=\"text-sm text-red-700\">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className=\"space-y-4\">
          {/* Name field for registration */}
          {!isLogin && (
            <div>
              <label htmlFor=\"name\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                Name
              </label>
              <div className=\"relative\">
                <User className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400\" />
                <input
                  type=\"text\"
                  id=\"name\"
                  name=\"name\"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder=\"Enter your name\"
                  className=\"w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
                  disabled={loginLoading || registerLoading}
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div>
            <label htmlFor=\"email\" className=\"block text-sm font-medium text-gray-700 mb-1\">
              Email Address
            </label>
            <div className=\"relative\">
              <Mail className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400\" />
              <input
                type=\"email\"
                id=\"email\"
                name=\"email\"
                value={formData.email}
                onChange={handleInputChange}
                placeholder=\"Enter your email\"
                className=\"w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
                disabled={loginLoading || registerLoading}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label htmlFor=\"password\" className=\"block text-sm font-medium text-gray-700 mb-1\">
              Password
            </label>
            <div className=\"relative\">
              <Lock className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400\" />
              <input
                type={showPassword ? 'text' : 'password'}
                id=\"password\"
                name=\"password\"
                value={formData.password}
                onChange={handleInputChange}
                placeholder=\"Enter your password\"
                className=\"w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
                disabled={loginLoading || registerLoading}
              />
              <button
                type=\"button\"
                onClick={() => setShowPassword(!showPassword)}
                className=\"absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600\"
              >
                {showPassword ? (
                  <EyeOff className=\"w-5 h-5\" />
                ) : (
                  <Eye className=\"w-5 h-5\" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password field for registration */}
          {!isLogin && (
            <div>
              <label htmlFor=\"confirmPassword\" className=\"block text-sm font-medium text-gray-700 mb-1\">
                Confirm Password
              </label>
              <div className=\"relative\">
                <Lock className=\"absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400\" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id=\"confirmPassword\"
                  name=\"confirmPassword\"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder=\"Confirm your password\"
                  className=\"w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500\"
                  disabled={loginLoading || registerLoading}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type=\"submit\"
            disabled={authLoading || loginLoading || registerLoading}
            className=\"w-full py-2 px-4 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors\"
          >
            {(loginLoading || registerLoading || authLoading) ? (
              <div className=\"flex items-center justify-center space-x-2\">
                <div className=\"w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin\"></div>
                <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
              </div>
            ) : (
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className=\"mt-6 text-center\">
          <p className=\"text-sm text-gray-600\">
            {isLogin ? \"Don't have an account?\" : 'Already have an account?'}{' '}
            <button
              onClick={toggleMode}
              className=\"text-blue-500 hover:text-blue-600 font-medium\"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        {/* Features */}
        <div className=\"mt-6 pt-6 border-t border-gray-200\">
          <div className=\"text-center text-sm text-gray-500\">
            <p className=\"mb-2\">With QueryFlux you can:</p>
            <div className=\"flex flex-wrap justify-center gap-2\">
              <span className=\"inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs\">
                <CheckCircle className=\"w-3 h-3 mr-1 text-green-500\" />
                Connect to 20+ databases
              </span>
              <span className=\"inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs\">
                <CheckCircle className=\"w-3 h-3 mr-1 text-green-500\" />
                Execute SQL queries
              </span>
              <span className=\"inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs\">
                <CheckCircle className=\"w-3 h-3 mr-1 text-green-500\" />
                Real-time monitoring
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthComponent;