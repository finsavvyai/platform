# Beta Testing Service Email Templates

## Template: beta-application-received
Subject: Your SDLC.ai Beta Program Application Has Been Received

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>SDLC.ai Beta Application Received</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .timeline { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Thank You for Applying!</h1>
            <p>Your SDLC.ai Beta Program application has been received</p>
        </div>
        <div class="content">
            <h2>Hello {{name}},</h2>
            <p>Thank you for your interest in joining the SDLC.ai Beta Program! We're excited to have experienced {{experience}} developers like you helping shape the future of secure AI integration.</p>
            
            <div class="timeline">
                <h3>What Happens Next?</h3>
                <ul>
                    <li><strong>Review Period:</strong> We'll carefully review your application ({{expectedResponseTime}})</li>
                    <li><strong>Acceptance Email:</strong> You'll receive an email with our decision</li>
                    <li><strong>Onboarding:</strong> If accepted, you'll get access to the beta platform</li>
                    <li><strong>Testing Begins:</strong> Start exploring and providing valuable feedback!</li>
                </ul>
            </div>
            
            <p>While you wait, check out our <a href="https://docs.sdlc.ai">documentation</a> to learn more about SDLC.ai's capabilities.</p>
            
            <p>Selected beta testers will receive:</p>
            <ul>
                <li>✨ Early access to cutting-edge AI security features</li>
                <li>🎯 Direct influence on product development</li>
                <li>💰 Reward credits for valuable feedback</li>
                <li>👥 Priority support from our engineering team</li>
            </ul>
            
            <p>Have questions? Reach out to us at <a href="mailto:beta@sdlc.ai">beta@sdlc.ai</a></p>
            
            <p>Best regards,<br>The SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>You're receiving this email because you applied for the SDLC.ai Beta Program.</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-approved
Subject: 🎉 Welcome to the SDLC.ai Beta Program!

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to SDLC.ai Beta Program</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 18px; }
        .feature-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 You're In!</h1>
            <p>Welcome to the SDLC.ai Beta Program</p>
        </div>
        <div class="content">
            <h2>Congratulations, {{name}}!</h2>
            <p>Your application has been approved, and we're thrilled to welcome you to the SDLC.ai Beta Program! Your expertise as a {{experience}} developer will be invaluable in helping us refine our platform.</p>
            
            <a href="{{onboardingUrl}}" class="button">Start Your Onboarding</a>
            
            <h3>Your Beta Program Details:</h3>
            <div class="feature-box">
                <h4>📅 Program Duration</h4>
                <p>Your beta access is valid until: <strong>{{endDate}}</strong></p>
            </div>
            
            <div class="feature-box">
                <h4>🎁 Beta Benefits</h4>
                <ul>
                    <li>Full access to all SDLC.ai features</li>
                    <li>10GB storage and 10,000 API calls/day</li>
                    <li>Priority email and chat support</li>
                    <li>Earn credits for feedback and bug reports</li>
                    <li>Direct line to our product team</li>
                </ul>
            </div>
            
            <div class="feature-box">
                <h4>📋 Your First Steps</h4>
                <ol>
                    <li><strong>Complete Onboarding:</strong> Get familiar with the platform (15 minutes)</li>
                    <li><strong>Join Community:</strong> Connect with other beta testers</li>
                    <li><strong>Test Core Features:</strong> Try document processing and RAG</li>
                    <li><strong>Share Feedback:</strong> Help us improve with your insights</li>
                </ol>
            </div>
            
            <h3>📚 Resources to Get Started:</h3>
            <ul>
                <li><a href="{{welcomeKitUrl}}">Beta Welcome Kit</a> - Everything you need to know</li>
                <li><a href="https://docs.sdlc.ai/beta/testing-guide">Testing Guide</a> - Scenarios and best practices</li>
                <li><a href="https://calendly.com/sdlc-beta/office-hours">Office Hours</a> - Book a 1:1 with our team</li>
            </ul>
            
            <p>We're committed to making this a valuable experience for you. Your feedback will directly shape the future of SDLC.ai!</p>
            
            <p>Let's build something amazing together,<br>The SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Beta access is granted under the SDLC.ai Beta Program Terms of Service.</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-welcome
Subject: Welcome to the SDLC.ai Beta Program - Let's Get Started!

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to SDLC.ai Beta</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .checklist { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .checklist li { margin: 10px 0; }
        .phase-box { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 You're Ready!</h1>
            <p>Your SDLC.ai Beta Onboarding is Complete</p>
        </div>
        <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Congratulations on completing your onboarding! You now have full access to the SDLC.ai Beta Program. We're excited to see what you'll build and learn from your feedback.</p>
            
            <h3>📋 Your Beta Testing Journey</h3>
            <p>Over the next 8 weeks, you'll progress through these testing phases:</p>
            
            <div class="phase-box">
                <h4>Phase 1: Onboarding (Week 1)</h4>
                <p>✅ Complete! You've successfully set up your account and made your first API call.</p>
            </div>
            
            <div class="phase-box">
                <h4>Phase 2: Core Features (Weeks 2-3)</h4>
                <p>Test document processing, vector search, and basic RAG functionality.</p>
            </div>
            
            <div class="phase-box">
                <h4>Phase 3: Advanced Features (Weeks 4-5)</h4>
                <p>Explore advanced authentication, audit logging, and compliance features.</p>
            </div>
            
            <div class="phase-box">
                <h4>Phase 4: Load Testing (Week 6)</h4>
                <p>Help us test performance under realistic load conditions.</p>
            </div>
            
            <div class="phase-box">
                <h4>Phase 5: Integration (Weeks 7-8)</h4>
                <p>Build complete application integrations and test end-to-end workflows.</p>
            </div>
            
            <h3>🎯 Your Next Steps</h3>
            <div class="checklist">
                <ul>
                    <li>☐ <a href="{{firstScenarioUrl}}">Start your first testing scenario</a></li>
                    <li>☐ <a href="https://slack.sdlc.ai/beta-invite">Join our beta Slack community</a></li>
                    <li>☐ <a href="https://calendly.com/sdlc-beta/office-hours">Schedule a check-in call</a></li>
                    <li>☐ <a href="{{testingGuideUrl}}">Review the testing guide</a></li>
                </ul>
            </div>
            
            <h3>💡 Pro Tips for Success</h3>
            <ul>
                <li><strong>Document Everything:</strong> Use the feedback widget to report issues immediately</li>
                <li><strong>Be Specific:</strong> Include steps to reproduce when reporting bugs</li>
                <li><strong>Test Your Use Cases:</strong> Try to implement your actual use case</li>
                <li><strong>Engage with Community:</strong> Share experiences and learn from others</li>
            </ul>
            
            <p>Remember, there are rewards for valuable feedback!</p>
            <ul>
                <li>🏆 100 credits for feedback submission</li>
                <li>🐛 500 credits for critical bug reports</li>
                <li>✅ 50 credits for scenario completion</li>
            </ul>
            
            <p>Need help? Reach out anytime at <a href="mailto:{{supportChannel}}">{{supportChannel}}</a></p>
            
            <p>Happy testing!<br>The SDLC.ai Beta Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>You're receiving this email as a participant in the SDLC.ai Beta Program.</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-feedback-received
Subject: We've Received Your Feedback - Thank You!

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Feedback Received</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .feedback-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .credits { background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Feedback Received!</h1>
            <p>Thank you for helping improve SDLC.ai</p>
        </div>
        <div class="content">
            <h2>Hi {{name}},</h2>
            <p>We've received your feedback about <strong>{{feedbackType}}</strong>. Your input is incredibly valuable in helping us build a better product.</p>
            
            <div class="feedback-box">
                <h3>Feedback Details:</h3>
                <p><strong>ID:</strong> #{{feedbackId}}</p>
                <p><strong>Type:</strong> {{feedbackType}}</p>
                <p><strong>Status:</strong> Under Review</p>
                <p><strong>Expected Response:</strong> {{expectedResponseTime}}</p>
            </div>
            
            <div class="credits">
                <h3>🎁 You've Earned Credits!</h3>
                <p>We've added <strong>{{creditsEarned}} credits</strong> to your account for your valuable feedback.</p>
                <p>Total credits: <strong>{{totalCredits}}</strong></p>
                <p>Use credits for extended beta access or future discounts!</p>
            </div>
            
            <h3>What Happens Next?</h3>
            <ol>
                <li><strong>Analysis:</strong> Our team will analyze your feedback within 24 hours</li>
                <li><strong>Triage:</strong> We'll categorize and prioritize the issue</li>
                <li><strong>Action:</strong> Critical issues will be addressed immediately</li>
                <li><strong>Update:</strong> You'll receive an email when we take action</li>
            </ol>
            
            <p>Keep exploring and testing! The more feedback you provide, the more credits you earn.</p>
            
            <p>Questions about your feedback? Reply to this email or reach out to <a href="mailto:beta-support@sdlc.ai">beta-support@sdlc.ai</a></p>
            
            <p>Best,<br>The SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Feedback ID: {{feedbackId}} | Submitted: {{date}}</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-feedback-resolved
Subject: Good News! Your Feedback Has Been Addressed

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Feedback Resolved</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .resolution-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
        .action-button { display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Resolved!</h1>
            <p>Your feedback has been addressed</p>
        </div>
        <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Great news! The feedback you submitted regarding <strong>"{{feedbackTitle}}"</strong> has been resolved.</p>
            
            <div class="resolution-box">
                <h3>Resolution Details:</h3>
                <p><strong>Feedback ID:</strong> #{{feedbackId}}</p>
                <p><strong>Resolution:</strong></p>
                <p>{{response}}</p>
            </div>
            
            <h3>What We Did</h3>
            <p>Our team has carefully reviewed your feedback and implemented the necessary changes. Here's what we've done:</p>
            <p>{{response}}</p>
            
            <h3>Test It Out</h3>
            <p>Please take a moment to test the fix and let us know if everything is working as expected.</p>
            <a href="{{testUrl}}" class="action-button">Test the Fix</a>
            
            <h3>Was This Helpful?</h3>
            <p>Your feedback on our response helps us improve our support:</p>
            <ul>
                <li><a href="{{helpfulUrl}}?rating=helpful">👍 Yes, this was helpful</a></li>
                <li><a href="{{helpfulUrl}}?rating=not-helpful">👎 Not quite what I expected</a></li>
            </ul>
            
            <p>Thank you for being an amazing beta tester! Your contributions make SDLC.ai better for everyone.</p>
            
            <p>Keep the feedback coming,<br>The SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Feedback ID: {{feedbackId}} | Resolved: {{resolutionDate}}</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-weekly-digest
Subject: Beta Program Weekly Update - {{date}}

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Beta Weekly Digest</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .metric-box { display: inline-block; width: 30%; margin: 1%; background: white; padding: 15px; border-radius: 8px; text-align: center; }
        .update-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .top-feedback { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Beta Weekly Update</h1>
            <p>{{date}} - Week {{weekNumber}} of Beta Program</p>
        </div>
        <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Here's your weekly update on the SDLC.ai Beta Program!</p>
            
            <h3>📈 Program Metrics</h3>
            <div style="text-align: center;">
                <div class="metric-box">
                    <h4>{{activeUsers}}</h4>
                    <p>Active Testers</p>
                </div>
                <div class="metric-box">
                    <h4>{{feedbackCount}}</h4>
                    <p>Feedback Items</p>
                </div>
                <div class="metric-box">
                    <h4>{{bugsFixed}}</h4>
                    <p>Bugs Fixed</p>
                </div>
            </div>
            
            <h3>🚀 Latest Updates</h3>
            <div class="update-box">
                <h4>New Features</h4>
                <ul>
                    <li>Enhanced document processing with better OCR accuracy</li>
                    <li>New vector search filters for precise results</li>
                    <li>Improved SDK error handling and debugging</li>
                </ul>
            </div>
            
            <div class="update-box">
                <h4>Recent Fixes</h4>
                <ul>
                    <li>Fixed timeout issue with large document uploads</li>
                    <li>Resolved authentication token refresh bug</li>
                    <li>Improved RAG response generation speed</li>
                </ul>
            </div>
            
            <h3>🔥 Top Feedback This Week</h3>
            <div class="top-feedback">
                <h4>{{topIssueTitle}}</h4>
                <p>{{topIssueDescription}}</p>
                <p><strong>Status:</strong> {{topIssueStatus}}</p>
            </div>
            
            <h3>🎯 Your Contribution</h3>
            <div class="update-box">
                <p><strong>Your Activity:</strong></p>
                <ul>
                    <li>Feedback submitted: {{userFeedbackCount}}</li>
                    <li>Scenarios completed: {{userScenariosCompleted}}</li>
                    <li>Credits earned: {{userCredits}}</li>
                </ul>
            </div>
            
            <h3>📅 Upcoming Events</h3>
            <ul>
                <li><strong>Office Hours:</strong> Every Tuesday & Thursday at 2 PM EST</li>
                <li><strong>Beta Showcase:</strong> {{nextShowcaseDate}} - Share your experience!</li>
                <li><strong>Product Roadmap Review:</strong> {{roadmapDate}}</li>
            </ul>
            
            <p>Keep up the great work! Your feedback is making a real difference.</p>
            
            <p>Best regards,<br>The SDLC.ai Beta Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Update your email preferences: <a href="{{unsubscribeUrl}}">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-phase-transition
Subject: Moving to the Next Phase - {{newPhase}} Testing

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Phase Transition</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .phase-card { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff6b6b; }
        .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 20px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Level Up!</h1>
            <p>You're advancing to {{newPhase}} testing</p>
        </div>
        <div class="content">
            <h2>Congratulations, {{name}}!</h2>
            <p>Amazing progress! You've completed the previous phase and are ready to tackle new challenges. Your engagement score is now <strong>{{engagementScore}}</strong> points!</p>
            
            <h3>📊 Your Progress</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: {{progressPercentage}}%"></div>
            </div>
            <p>You've completed {{completedScenarios}} of {{totalScenarios}} scenarios in the previous phase.</p>
            
            <h3>🚀 Welcome to {{newPhase}} Phase</h3>
            <div class="phase-card">
                <h4>What to Expect:</h4>
                <p>{{phaseDescription}}</p>
                <h4>Focus Areas:</h4>
                <ul>
                    {{#each phaseFocus}}
                    <li>{{this}}</li>
                    {{/each}}
                </ul>
            </div>
            
            <h3>📋 New Scenarios Available</h3>
            <p>We've unlocked {{newScenariosCount}} new testing scenarios for you:</p>
            {{#each newScenarios}}
            <div class="phase-card">
                <h4>{{name}}</h4>
                <p>{{description}}</p>
                <p><strong>Time Estimate:</strong> {{estimatedTime}} minutes | <strong>Points:</strong> {{points}}</p>
            </div>
            {{/each}}
            
            <h3>🎁 Phase Completion Bonus</h3>
            <p>Complete all {{newPhase}} scenarios to earn a special bonus of <strong>200 extra credits!</strong></p>
            
            <p>Ready to continue? <a href="{{phaseUrl}}">Start {{newPhase}} Testing</a></p>
            
            <p>You're doing fantastic work! Every scenario you complete and every piece of feedback you provide helps us build a better product.</p>
            
            <p>Keep pushing forward,<br>The SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Current Phase: {{newPhase}} | Engagement Score: {{engagementScore}}</p>
        </div>
    </div>
</body>
</html>
```

## Template: beta-completion
Subject: 🏆 Beta Program Complete - Thank You!

Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Beta Program Complete</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%); padding: 30px; text-align: center; color: #333; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .stat-box { background: white; padding: 20px; border-radius: 8px; text-align: center; }
        .offer-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px dashed #4caf50; }
        .testimonial { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Congratulations!</h1>
            <p>You've completed the SDLC.ai Beta Program</p>
        </div>
        <div class="content">
            <h2>Amazing work, {{name}}!</h2>
            <p>Thank you for being an incredible beta tester! Your dedication and valuable feedback have helped shape the future of SDLC.ai. We couldn't have done it without you.</p>
            
            <h3>📊 Your Impact</h3>
            <div class="stats-grid">
                <div class="stat-box">
                    <h4>{{totalFeedback}}</h4>
                    <p>Feedback Items</p>
                </div>
                <div class="stat-box">
                    <h4>{{bugsFound}}</h4>
                    <p>Bugs Reported</p>
                </div>
                <div class="stat-box">
                    <h4>{{scenariosCompleted}}</h4>
                    <p>Scenarios Completed</p>
                </div>
                <div class="stat-box">
                    <h4>{{creditsEarned}}</h4>
                    <p>Total Credits</p>
                </div>
            </div>
            
            <h3>🌟 Your Top Contributions</h3>
            <ul>
                {{#each topContributions}}
                <li>{{this}}</li>
                {{/each}}
            </ul>
            
            <h3>🎁 A Special Thank You</h3>
            <div class="offer-box">
                <h4>Exclusive Beta Tester Offer</h4>
                <p>As a token of our appreciation, we're offering you:</p>
                <ul>
                    <li>50% discount on your first year of SDLC.ai</li>
                    <li>12 months of free access to SDLC.ai Pro ({{creditsEarned}} credits applied)</li>
                    <li>Lifetime "Founding Beta Tester" badge on your profile</li>
                    <li>Direct access to our product team for 6 months</li>
                </ul>
                <p><strong>Total Value: $2,400</strong></p>
                <p><a href="{{claimOfferUrl}}" style="background: #4caf50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Claim Your Offer</a></p>
                <p><small>Offer expires on {{offerExpiryDate}}</small></p>
            </div>
            
            <h3>📝 Share Your Experience</h3>
            <div class="testimonial">
                <p>We'd love to hear about your beta testing experience. Your testimonial helps other developers understand the value of SDLC.ai.</p>
                <p><a href="{{testimonialUrl}}">Share Your Story</a></p>
            </div>
            
            <h3>What's Next?</h3>
            <ol>
                <li><strong>Claim Your Offer:</strong> Don't miss your exclusive beta tester discount</li>
                <li><strong>Stay Connected:</strong> You'll continue to have access to our beta community</li>
                <li><strong>Early Access:</strong> Be the first to try new features as we release them</li>
                <li><strong>Refer Friends:</strong> Get additional credits for successful referrals</li>
            </ol>
            
            <p>Once again, thank you for being an essential part of our journey. Your contributions have made SDLC.ai better, and we're excited to have you as part of our community.</p>
            
            <p>With gratitude,<br>The entire SDLC.ai Team</p>
        </div>
        <div class="footer">
            <p>© 2025 SDLC.ai. All rights reserved.</p>
            <p>Beta Program Completion Date: {{completionDate}}</p>
        </div>
    </div>
</body>
</html>
```