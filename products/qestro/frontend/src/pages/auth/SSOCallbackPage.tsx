import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Shield } from 'lucide-react';
import { ssoService } from '../../services/oauthService';
import { useAuthStore } from '../../stores/authStore';

interface CallbackState {
    status: 'processing' | 'success' | 'error';
    message: string;
    details?: string;
}

const SSOCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setUser, setAuthenticated } = useAuthStore();
    const [state, setState] = useState<CallbackState>({
        status: 'processing',
        message: 'Processing authentication...',
    });

    useEffect(() => {
        const processCallback = async () => {
            const code = searchParams.get('code');
            const stateParam = searchParams.get('state');
            const error = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');

            // Get provider from state or session storage
            const providerId = sessionStorage.getItem('sso_provider') || 'azure-ad';

            // Handle OAuth errors
            if (error) {
                setState({
                    status: 'error',
                    message: 'Authentication failed',
                    details: errorDescription || error,
                });
                return;
            }

            // Validate required parameters
            if (!code || !stateParam) {
                setState({
                    status: 'error',
                    message: 'Invalid callback',
                    details: 'Missing required authentication parameters',
                });
                return;
            }

            setState({
                status: 'processing',
                message: 'Verifying your identity...',
            });

            try {
                const result = await ssoService.handleCallback({
                    providerId,
                    code,
                    state: stateParam,
                });

                if (result.success && result.user) {
                    // Store tokens
                    if (result.tokens?.accessToken) {
                        localStorage.setItem('access_token', result.tokens.accessToken);
                        if (result.tokens.refreshToken) {
                            localStorage.setItem('refresh_token', result.tokens.refreshToken);
                        }
                    }

                    // Update auth state
                    setUser(result.user);
                    setAuthenticated(true);

                    setState({
                        status: 'success',
                        message: result.isNewUser ? 'Welcome to Qestro!' : 'Welcome back!',
                        details: `Signed in as ${result.user.email}`,
                    });

                    // Clean up
                    sessionStorage.removeItem('sso_provider');
                    sessionStorage.removeItem('sso_state');

                    // Redirect to dashboard after a brief delay
                    setTimeout(() => {
                        navigate('/', { replace: true });
                    }, 1500);

                } else {
                    setState({
                        status: 'error',
                        message: result.error?.message || 'Authentication failed',
                        details: result.error?.code,
                    });
                }
            } catch (error) {
                console.error('SSO callback error:', error);
                setState({
                    status: 'error',
                    message: 'Authentication error',
                    details: error instanceof Error ? error.message : 'An unexpected error occurred',
                });
            }
        };

        processCallback();
    }, [searchParams, navigate, setUser, setAuthenticated]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Qestro</h1>
                    <p className="text-gray-400 mt-1">Enterprise Authentication</p>
                </div>

                {/* Status Card */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center text-center space-y-4">
                        {/* Status Icon */}
                        {state.status === 'processing' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                        {state.status === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>
                        )}
                        {state.status === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-500" />
                            </div>
                        )}

                        {/* Message */}
                        <div>
                            <h2 className={`text-xl font-semibold ${state.status === 'success' ? 'text-green-400' :
                                    state.status === 'error' ? 'text-red-400' :
                                        'text-white'
                                }`}>
                                {state.message}
                            </h2>
                            {state.details && (
                                <p className="text-gray-400 mt-2 text-sm">
                                    {state.details}
                                </p>
                            )}
                        </div>

                        {/* Processing indicator */}
                        {state.status === 'processing' && (
                            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-primary h-full w-1/2 rounded-full animate-pulse" />
                            </div>
                        )}

                        {/* Error actions */}
                        {state.status === 'error' && (
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition-colors"
                                >
                                    Back to Login
                                </button>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-primary text-sm font-medium transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Security notice */}
                <p className="text-center text-gray-500 text-xs mt-6">
                    Secured with enterprise-grade SSO authentication
                </p>
            </div>
        </div>
    );
};

export default SSOCallbackPage;
