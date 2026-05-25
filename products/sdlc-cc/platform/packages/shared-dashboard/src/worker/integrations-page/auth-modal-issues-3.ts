// AutoBoot Integration Hub - Auth modal: issues 8-9 (phone auth, frameworks)

export const authModalIssues3 = `
                        <!-- Issue 8: Phone Number Authentication -->
                        <details style="margin-bottom: 1.5rem; cursor: pointer;">
                            <summary style="font-weight: 600; color: var(--text-primary); padding: 0.75rem; background: var(--bg-primary); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                                <span style="color: #10b981; margin-right: 0.5rem;">📱</span>
                                What if login is phone number instead of email?
                            </summary>
                            <div style="padding: 1rem; background: var(--bg-primary); border-radius: 0.5rem; margin-top: 0.5rem;">
                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Use Case:</strong> Mobile-first apps, international markets, or when users prefer phone login over email.</p>

                                <p style="margin-bottom: 1rem;"><strong style="color: var(--text-primary);">Complete Phone Authentication Flow:</strong></p>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 1: Send OTP (Backend)</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-comment">// TypeScript - Send OTP via SMS</span>
<span class="code-keyword">import</span> { AutoBootSMS } <span class="code-keyword">from</span> <span class="code-string">'@autoboot/sdk'</span>;

<span class="code-variable">app</span>.<span class="code-function">post</span>(<span class="code-string">'/auth/phone/send-otp'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-keyword">const</span> { phoneNumber } = req.body; <span class="code-comment">// "+14155551234"</span>

  <span class="code-comment">// 1. Validate phone format (E.164 format)</span>
  <span class="code-keyword">if</span> (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
    <span class="code-keyword">return</span> res.<span class="code-function">status</span>(<span class="code-number">400</span>).<span class="code-function">json</span>({ <span class="code-variable">error</span>: <span class="code-string">'Invalid phone format'</span> });
  }

  <span class="code-comment">// 2. Generate 6-digit OTP</span>
  <span class="code-keyword">const</span> otp = Math.<span class="code-function">floor</span>(<span class="code-number">100000</span> + Math.<span class="code-function">random</span>() * <span class="code-number">900000</span>);

  <span class="code-comment">// 3. Store OTP (expires in 5 min)</span>
  <span class="code-keyword">await</span> redis.<span class="code-function">setex</span>(<span class="code-string">\`otp:\${phoneNumber}\`</span>, <span class="code-number">300</span>, otp);

  <span class="code-comment">// 4. Send via SMS</span>
  <span class="code-keyword">const</span> sms = <span class="code-keyword">new</span> <span class="code-function">AutoBootSMS</span>({
    <span class="code-variable">apiKey</span>: process.env.AUTOBOOT_SMS_API_KEY
  });
  <span class="code-keyword">await</span> sms.<span class="code-function">send</span>({
    <span class="code-variable">to</span>: phoneNumber,
    <span class="code-variable">message</span>: <span class="code-string">\`Your code: \${otp}\`</span>
  });

  res.<span class="code-function">json</span>({ <span class="code-variable">success</span>: <span class="code-keyword">true</span> });
});</pre>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 2: Verify OTP &amp; Issue Token (Backend)</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-variable">app</span>.<span class="code-function">post</span>(<span class="code-string">'/auth/phone/verify-otp'</span>, <span class="code-keyword">async</span> (<span class="code-variable">req</span>, <span class="code-variable">res</span>) => {
  <span class="code-keyword">const</span> { phoneNumber, otp } = req.body;

  <span class="code-comment">// 1. Get stored OTP</span>
  <span class="code-keyword">const</span> storedOTP = <span class="code-keyword">await</span> redis.<span class="code-function">get</span>(<span class="code-string">\`otp:\${phoneNumber}\`</span>);

  <span class="code-comment">// 2. Validate</span>
  <span class="code-keyword">if</span> (!storedOTP || storedOTP !== otp) {
    <span class="code-keyword">return</span> res.<span class="code-function">status</span>(<span class="code-number">401</span>).<span class="code-function">json</span>({ <span class="code-variable">error</span>: <span class="code-string">'Invalid OTP'</span> });
  }

  <span class="code-comment">// 3. Delete OTP (prevent replay)</span>
  <span class="code-keyword">await</span> redis.<span class="code-function">del</span>(<span class="code-string">\`otp:\${phoneNumber}\`</span>);

  <span class="code-comment">// 4. Find or create user</span>
  <span class="code-keyword">let</span> user = <span class="code-keyword">await</span> db.users.<span class="code-function">findOne</span>({ phoneNumber });
  <span class="code-keyword">if</span> (!user) {
    user = <span class="code-keyword">await</span> db.users.<span class="code-function">create</span>({ phoneNumber });
  }

  <span class="code-comment">// 5. Generate JWT</span>
  <span class="code-keyword">const</span> auth = <span class="code-keyword">new</span> <span class="code-function">AutoBootAuth</span>({
    <span class="code-variable">apiKey</span>: process.env.AUTOBOOT_API_KEY
  });
  <span class="code-keyword">const</span> token = <span class="code-keyword">await</span> auth.<span class="code-function">generateToken</span>({
    <span class="code-variable">id</span>: user.id,
    <span class="code-variable">phoneNumber</span>: user.phoneNumber
  });

  res.<span class="code-function">json</span>({ token, user });
});</pre>

                                <p style="margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 600;">Step 3: Frontend (React)</p>
                                <pre style="background: var(--bg-secondary); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.875rem; margin-bottom: 1.5rem;"><span class="code-keyword">import</span> { useState } <span class="code-keyword">from</span> <span class="code-string">'react'</span>;

<span class="code-keyword">function</span> <span class="code-function">PhoneLogin</span>() {
  <span class="code-keyword">const</span> [step, setStep] = <span class="code-function">useState</span>(<span class="code-number">1</span>); <span class="code-comment">// 1=phone, 2=OTP</span>
  <span class="code-keyword">const</span> [phone, setPhone] = <span class="code-function">useState</span>(<span class="code-string">''</span>);
  <span class="code-keyword">const</span> [otp, setOTP] = <span class="code-function">useState</span>(<span class="code-string">''</span>);

  <span class="code-comment">// Send OTP</span>
  <span class="code-keyword">const</span> <span class="code-function">sendOTP</span> = <span class="code-keyword">async</span> () => {
    <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'/auth/phone/send-otp'</span>, {
      <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
      <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ phoneNumber: phone })
    });
    <span class="code-function">setStep</span>(<span class="code-number">2</span>);
  };

  <span class="code-comment">// Verify OTP</span>
  <span class="code-keyword">const</span> <span class="code-function">verifyOTP</span> = <span class="code-keyword">async</span> () => {
    <span class="code-keyword">const</span> res = <span class="code-keyword">await</span> <span class="code-function">fetch</span>(<span class="code-string">'/auth/phone/verify-otp'</span>, {
      <span class="code-variable">method</span>: <span class="code-string">'POST'</span>,
      <span class="code-variable">body</span>: <span class="code-function">JSON.stringify</span>({ phoneNumber: phone, otp })
    });
    <span class="code-keyword">const</span> { token } = <span class="code-keyword">await</span> res.<span class="code-function">json</span>();
    localStorage.<span class="code-function">setItem</span>(<span class="code-string">'access_token'</span>, token);
    window.location.href = <span class="code-string">'/dashboard'</span>;
  };

  <span class="code-keyword">return</span> step === <span class="code-number">1</span> ? (
    &lt;div&gt;
      &lt;input
        placeholder=<span class="code-string">"+1 (555) 123-4567"</span>
        value={phone}
        onChange={e => <span class="code-function">setPhone</span>(e.target.value)}
      /&gt;
      &lt;button onClick={sendOTP}&gt;Send Code&lt;/button&gt;
    &lt;/div&gt;
  ) : (
    &lt;div&gt;
      &lt;input
        maxLength={<span class="code-number">6</span>}
        placeholder=<span class="code-string">"123456"</span>
        value={otp}
        onChange={e => <span class="code-function">setOTP</span>(e.target.value)}
      /&gt;
      &lt;button onClick={verifyOTP}&gt;Verify&lt;/button&gt;
    &lt;/div&gt;
  );
}</pre>

                                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 0.5rem; padding: 1rem; margin-top: 1.5rem;">
                                    <p style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-weight: 600;">💡 Best Practices:</p>
                                    <ul style="margin-left: 1.5rem; line-height: 2; margin-bottom: 0;">
                                        <li><strong>E.164 Format:</strong> Always use +1234567890 (not (555) 123-4567)</li>
                                        <li><strong>Rate Limit:</strong> Max 3 OTP requests per phone per hour</li>
                                        <li><strong>Expiry:</strong> 5 minutes (300 seconds) standard</li>
                                        <li><strong>One-Time Use:</strong> Delete OTP after verification</li>
                                        <li><strong>Resend Cooldown:</strong> 60 second wait between sends</li>
                                        <li><strong>Cost:</strong> SMS = $0.01-0.05 per message (optimize!)</li>
                                    </ul>
                                </div>
                            </div>
                        </details>`;
