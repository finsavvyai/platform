import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Building, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';

export default function SignupPage() {
    const navigate = useNavigate();
    const { register, isLoading, error } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        company: '',
        role: 'developer' as 'developer' | 'tester' | 'manager' | 'admin',
        agreeToTerms: false,
    });
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

    const validatePassword = (password: string) => {
        const errors = [];
        if (password.length < 8) errors.push('At least 8 characters');
        if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
        if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
        if (!/\d/.test(password)) errors.push('One number');
        setPasswordErrors(errors);
        return errors.length === 0;
    };

    const handlePasswordChange = (password: string) => {
        setFormData({ ...formData, password });
        validatePassword(password);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validatePassword(formData.password)) {
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            return;
        }

        if (!formData.agreeToTerms) {
            return;
        }

        const success = await register({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            company: formData.company,
            role: formData.role,
        });

        if (success) {
            setSuccess(true);
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 sm:px-6 lg:px-8 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full space-y-8"
            >
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Start your free trial
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Already have an account?{' '}
                        <Link
                            to="/login"
                            className="font-medium text-indigo-600 hover:text-indigo-500"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>

                {success ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-lg bg-green-50 p-8 text-center"
                    >
                        <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                        <h3 className="mt-4 text-lg font-medium text-green-900">Registration Successful!</h3>
                        <p className="mt-2 text-sm text-green-700">
                            Please check your email to verify your account. Redirecting to dashboard...
                        </p>
                    </motion.div>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                                    Company
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="company"
                                        name="company"
                                        type="text"
                                        autoComplete="organization"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Acme Corp"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                    Full Name
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        autoComplete="name"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                    Email Address
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="john@company.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Password"
                                        value={formData.password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-gray-400 hover:text-gray-500 focus:outline-none"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" aria-hidden="true" />
                                            ) : (
                                                <Eye className="h-5 w-5" aria-hidden="true" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                {passwordErrors.length > 0 && (
                                    <div className="mt-2 text-xs text-red-600 space-y-1">
                                        {passwordErrors.map((err, idx) => (
                                            <p key={idx}>{err}</p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    Confirm Password
                                </label>
                                <div className="mt-1 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        required
                                        className="appearance-none relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                        placeholder="Confirm Password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                    Primary role
                                </label>
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
                                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                                >
                                    <option value="developer">Developer</option>
                                    <option value="tester">Tester</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <p className="mt-2 text-xs text-gray-500">
                                    This sets the initial workspace persona shown in Qestro. Permissions can be refined later.
                                </p>
                            </div>

                            <div className="flex items-center">
                                <input
                                    id="agree-terms"
                                    name="agree-terms"
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={formData.agreeToTerms}
                                    onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                                />
                                <label htmlFor="agree-terms" className="ml-2 block text-sm text-gray-900">
                                    I agree to the{' '}
                                    <a href="/terms" className="text-indigo-600 hover:text-indigo-500">Terms of Service</a>
                                    {' '}and{' '}
                                    <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">Privacy Policy</a>
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-md bg-red-50 p-4">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-red-400" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center">
                                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                    Creating account...
                                </span>
                            ) : (
                                'Start Free Trial'
                            )}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
