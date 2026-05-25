/**
 * Early Access Page HTML
 * Standalone page for requesting early access to AutoBoot
 */

export const earlyAccessPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoBoot - Request Early Access</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
            padding: 50px;
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5rem;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1rem;
        }
        .form-group {
            margin-bottom: 25px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 600;
        }
        input, textarea, select {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: #667eea;
        }
        textarea {
            min-height: 120px;
            resize: vertical;
        }
        button {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .success-message {
            background: #4ade80;
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        .error-message {
            background: #ef4444;
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-top: 20px;
            display: none;
        }
        .back-link {
            text-align: center;
            margin-top: 20px;
        }
        .back-link a {
            color: #667eea;
            text-decoration: none;
        }
        .back-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Request Early Access</h1>
        <p class="subtitle">Be among the first to experience AutoBoot's production-ready SaaS infrastructure</p>

        <form id="earlyAccessForm">
            <div class="form-group">
                <label for="name">Full Name *</label>
                <input type="text" id="name" name="name" required placeholder="John Doe">
            </div>

            <div class="form-group">
                <label for="email">Email Address *</label>
                <input type="email" id="email" name="email" required placeholder="john@company.com">
            </div>

            <div class="form-group">
                <label for="company">Company Name</label>
                <input type="text" id="company" name="company" placeholder="Your Company Inc.">
            </div>

            <div class="form-group">
                <label for="role">Your Role *</label>
                <select id="role" name="role" required>
                    <option value="">Select your role</option>
                    <option value="founder">Founder / CEO</option>
                    <option value="developer">Developer / Engineer</option>
                    <option value="product">Product Manager</option>
                    <option value="cto">CTO / Tech Lead</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <div class="form-group">
                <label for="usecase">What will you use AutoBoot for? *</label>
                <textarea id="usecase" name="usecase" required placeholder="Tell us about your project..."></textarea>
            </div>

            <button type="submit" id="submitBtn">Request Early Access</button>
        </form>

        <div id="successMessage" class="success-message">
            Thank you! Your early access request has been submitted. We'll be in touch soon!
        </div>

        <div id="errorMessage" class="error-message">
            Oops! Something went wrong. Please try again.
        </div>

        <div class="back-link">
            <a href="/">Back to Home</a>
        </div>
    </div>

    <script>
        document.getElementById('earlyAccessForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            const successMsg = document.getElementById('successMessage');
            const errorMsg = document.getElementById('errorMessage');

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                company: document.getElementById('company').value || 'Not specified',
                role: document.getElementById('role').value,
                usecase: document.getElementById('usecase').value,
                timestamp: new Date().toISOString()
            };

            try {
                const response = await fetch('/api/v1/early-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    successMsg.style.display = 'block';
                    errorMsg.style.display = 'none';
                    document.getElementById('earlyAccessForm').reset();
                } else {
                    throw new Error('Submission failed');
                }
            } catch (error) {
                errorMsg.style.display = 'block';
                successMsg.style.display = 'none';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Request Early Access';
            }
        });
    </script>
</body>
</html>`;
