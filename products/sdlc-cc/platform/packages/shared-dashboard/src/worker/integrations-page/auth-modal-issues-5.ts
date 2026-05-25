// AutoBoot Integration Hub - Auth modal: issues 10-12 (password reset, OAuth, mobile)

export const authModalIssues5 = `
                        <!-- Issue 10: Password Reset Flow -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #8b5cf6; margin-right: 0.5rem;">🔑</span>
                                How to implement "Forgot Password" flow?
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Complete Password Reset Implementation:</strong></p>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 1: Request Reset Link</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// Backend - Send reset email</span>
<span class="code-variable">app</span>.<span class="code-function">post</span>(<span class="code-string">'/auth/forgot-password'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-keyword">const</span> { email } = req.body;

  <span class="code-comment">// 1. Check if user exists (don't reveal if not found!)</span>
  <span class="code-keyword">const</span> user = <span class="code-keyword">await</span> db.users.<span class="code-function">findOne</span>({ email });

  <span class="code-comment">// 2. Generate secure token (cryptographically random)</span>
  <span class="code-keyword">const</span> resetToken = crypto.<span class="code-function">randomBytes</span>(<span class="code-number">32</span>).<span class="code-function">toString</span>(<span class="code-string">'hex'</span>);
  <span class="code-keyword">const</span> hashedToken = crypto.<span class="code-function">createHash</span>(<span class="code-string">'sha256'</span>).<span class="code-function">update</span>(resetToken).<span class="code-function">digest</span>(<span class="code-string">'hex'</span>);

  <span class="code-comment">// 3. Store hashed token with expiry (1 hour)</span>
  <span class="code-keyword">if</span> (user) {
    <span class="code-keyword">await</span> db.users.<span class="code-function">updateOne</span>(
      { email },
      {
        <span class="code-variable">resetToken</span>: hashedToken,
        <span class="code-variable">resetExpires</span>: <span class="code-keyword">new</span> <span class="code-function">Date</span>(Date.<span class="code-function">now</span>() + <span class="code-number">3600000</span>) <span class="code-comment">// 1hr</span>
      }
    );

    <span class="code-comment">// 4. Send email with reset link</span>
    <span class="code-keyword">const</span> resetURL = <span class="code-string">\`https://myapp.com/reset-password?token=\${resetToken}\`</span>;
    <span class="code-keyword">await</span> email.<span class="code-function">send</span>({
      <span class="code-variable">to</span>: email,
      <span class="code-variable">subject</span>: <span class="code-string">'Reset Your Password'</span>,
      <span class="code-variable">html</span>: <span class="code-string">\`Click here to reset: &lt;a href="\${resetURL}"&gt;\${resetURL}&lt;/a&gt;\`</span>
    });
  }

  <span class="code-comment">// 5. Always return success (security!)</span>
  res.<span class="code-function">json</span>({ <span class="code-variable">message</span>: <span class="code-string">'If email exists, reset link sent'</span> });
});</pre>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 2: Reset Password with Token</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-variable">app</span>.<span class="code-function">post</span>(<span class="code-string">'/auth/reset-password'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-keyword">const</span> { token, newPassword } = req.body;

  <span class="code-comment">// 1. Hash the token from URL</span>
  <span class="code-keyword">const</span> hashedToken = crypto.<span class="code-function">createHash</span>(<span class="code-string">'sha256'</span>).<span class="code-function">update</span>(token).<span class="code-function">digest</span>(<span class="code-string">'hex'</span>);

  <span class="code-comment">// 2. Find user with valid token</span>
  <span class="code-keyword">const</span> user = <span class="code-keyword">await</span> db.users.<span class="code-function">findOne</span>({
    <span class="code-variable">resetToken</span>: hashedToken,
    <span class="code-variable">resetExpires</span>: { $gt: <span class="code-keyword">new</span> <span class="code-function">Date</span>() } <span class="code-comment">// Not expired</span>
  });

  <span class="code-keyword">if</span> (!user) {
    <span class="code-keyword">return</span> res.<span class="code-function">status</span>(<span class="code-number">400</span>).<span class="code-function">json</span>({ <span class="code-variable">error</span>: <span class="code-string">'Invalid or expired token'</span> });
  }

  <span class="code-comment">// 3. Hash new password</span>
  <span class="code-keyword">const</span> hashedPassword = <span class="code-keyword">await</span> bcrypt.<span class="code-function">hash</span>(newPassword, <span class="code-number">10</span>);

  <span class="code-comment">// 4. Update password and clear reset token</span>
  <span class="code-keyword">await</span> db.users.<span class="code-function">updateOne</span>(
    { <span class="code-variable">_id</span>: user._id },
    {
      <span class="code-variable">password</span>: hashedPassword,
      <span class="code-variable">resetToken</span>: <span class="code-keyword">null</span>,
      <span class="code-variable">resetExpires</span>: <span class="code-keyword">null</span>
    }
  );

  res.<span class="code-function">json</span>({ <span class="code-variable">message</span>: <span class="code-string">'Password reset successful'</span> });
});</pre>

                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                                    <p style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 600;">🔒 Security Best Practices:</p>
                                    <ul style="margin-left: 1.5rem; line-height: 2; margin-bottom: 0;">
                                        <li><strong>Never reveal</strong> if email exists ("If email exists..." message)</li>
                                        <li><strong>Hash tokens</strong> before storing in database</li>
                                        <li><strong>Short expiry:</strong> 1 hour max for reset links</li>
                                        <li><strong>One-time use:</strong> Delete token after password change</li>
                                        <li><strong>Rate limit:</strong> Max 3 requests per email per hour</li>
                                        <li><strong>Use crypto.randomBytes</strong> (not Math.random!)</li>
                                    </ul>
                                </div>
                            </div>
                        </details>`;
