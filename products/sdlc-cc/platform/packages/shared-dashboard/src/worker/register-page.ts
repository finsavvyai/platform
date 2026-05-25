// Authentication Page - Register
// Complete UI with LemonSqueezy integration

export const registerPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Your Account - AutoBoot</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0a0b14;
            --bg-secondary: #141520;
            --bg-card: #1c1d2e;
            --accent: #4361ee;
            --accent-hover: #3451d1;
            --success: #10b981;
            --error: #ef4444;
            --text-primary: #f8f9fa;
            --text-secondary: #9ca3af;
            --border: rgba(255, 255, 255, 0.08);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        }

        .auth-container {
            width: 100%;
            max-width: 480px;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 1rem;
            padding: 3rem;
        }

        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }

        .logo h1 {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent) 0%, #00d4ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .auth-header {
            text-align: center;
            margin-bottom: 2rem;
        }

        .auth-header h2 {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .auth-header p {
            color: var(--text-secondary);
            font-size: 0.9375rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        label {
            display: block;
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
        }

        input {
            width: 100%;
            padding: 0.875rem 1rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text-primary);
            font-size: 0.9375rem;
            transition: all 0.2s;
        }

        input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1);
        }

        .input-hint {
            font-size: 0.8125rem;
            color: var(--text-secondary);
            margin-top: 0.375rem;
        }

        .btn {
            width: 100%;
            padding: 0.875rem;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 0.9375rem;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 0.5rem;
        }

        .btn:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .divider {
            display: flex;
            align-items: center;
            margin: 2rem 0;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .divider::before,
        .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--border);
        }

        .divider span {
            padding: 0 1rem;
        }

        .social-buttons {
            display: grid;
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .social-btn {
            padding: 0.875rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text-primary);
            font-weight: 600;
            font-size: 0.9375rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
        }

        .social-btn:hover {
            border-color: var(--accent);
            background: rgba(67, 97, 238, 0.05);
        }

        .auth-footer {
            text-align: center;
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border);
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .auth-footer a {
            color: var(--accent);
            text-decoration: none;
            font-weight: 600;
        }

        .auth-footer a:hover {
            text-decoration: underline;
        }

        .error-message {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 0.5rem;
            padding: 0.875rem;
            color: var(--error);
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
            display: none;
        }

        .success-message {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 0.5rem;
            padding: 0.875rem;
            color: var(--success);
            font-size: 0.875rem;
            margin-bottom: 1.5rem;
            display: none;
        }

        .password-strength {
            height: 4px;
            background: var(--bg-card);
            border-radius: 2px;
            margin-top: 0.5rem;
            overflow: hidden;
        }

        .password-strength-bar {
            height: 100%;
            width: 0%;
            transition: all 0.3s;
            background: var(--error);
        }

        .password-strength-bar.weak { width: 33%; background: var(--error); }
        .password-strength-bar.medium { width: 66%; background: #f59e0b; }
        .password-strength-bar.strong { width: 100%; background: var(--success); }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="logo">
            <h1>AutoBoot</h1>
        </div>

        <div class="auth-header">
            <h2>Create your account</h2>
            <p>Start building with enterprise-grade authentication</p>
        </div>

        <div id="error-message" class="error-message"></div>
        <div id="success-message" class="success-message"></div>

        <div class="social-buttons">
            <button class="social-btn" onclick="loginWithGoogle()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
            </button>
            <button class="social-btn" onclick="loginWithGitHub()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
            </button>
        </div>

        <div class="divider">
            <span>or continue with email</span>
        </div>

        <form id="register-form" onsubmit="handleRegister(event)">
            <div class="form-group">
                <label for="name">Full Name</label>
                <input type="text" id="name" name="name" required placeholder="John Doe">
            </div>

            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required placeholder="you@company.com">
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required placeholder="••••••••" oninput="checkPasswordStrength(this.value)">
                <div class="password-strength">
                    <div id="password-strength-bar" class="password-strength-bar"></div>
                </div>
                <div class="input-hint">At least 8 characters with uppercase, lowercase, and number</div>
            </div>

            <button type="submit" class="btn" id="submit-btn">
                Create Account
            </button>
        </form>

        <div class="auth-footer">
            Already have an account? <a href="/auth/login">Sign in</a>
        </div>
    </div>

    <script>
        function checkPasswordStrength(password) {
            const bar = document.getElementById('password-strength-bar');
            let strength = 0;

            if (password.length >= 8) strength++;
            if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^a-zA-Z0-9]/.test(password)) strength++;

            if (strength <= 1) {
                bar.className = 'password-strength-bar weak';
            } else if (strength === 2 || strength === 3) {
                bar.className = 'password-strength-bar medium';
            } else {
                bar.className = 'password-strength-bar strong';
            }
        }

        function showError(message) {
            const errorDiv = document.getElementById('error-message');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 5000);
        }

        function showSuccess(message) {
            const successDiv = document.getElementById('success-message');
            successDiv.textContent = message;
            successDiv.style.display = 'block';
        }

        async function handleRegister(event) {
            event.preventDefault();
            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            btn.textContent = 'Creating account...';

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                password: document.getElementById('password').value
            };

            try {
                const response = await fetch('/api/v1/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    showSuccess('Account created! Redirecting to pricing...');
                    setTimeout(() => {
                        // Store token temporarily
                        localStorage.setItem('pending_token', data.token);
                        window.location.href = '/auth/pricing';
                    }, 1500);
                } else {
                    showError(data.error || 'Registration failed');
                    btn.disabled = false;
                    btn.textContent = 'Create Account';
                }
            } catch (error) {
                showError('Network error. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        }

        function loginWithGoogle() {
            const params = new URLSearchParams({
                client_id: 'YOUR_GOOGLE_CLIENT_ID',
                redirect_uri: window.location.origin + '/auth/google/callback',
                response_type: 'code',
                scope: 'openid email profile',
                state: crypto.randomUUID()
            });
            window.location.href = \`https://accounts.google.com/o/oauth2/v2/auth?\${params}\`;
        }

        function loginWithGitHub() {
            window.location.href = '/api/v1/auth/github';
        }
    </script>
</body>
</html>
`;
