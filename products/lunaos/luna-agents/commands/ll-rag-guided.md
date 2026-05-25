# luna-rag - Single Guided Flow

## 🌟 Luna RAG - Complete Intelligent Code Search

**One command, one guided experience. No need to remember multiple commands.**

## 🚀 Usage

```bash
/luna-rag
```

That's it! Luna RAG will guide you through everything based on your current status.

---

## 🎯 The Guided Flow Experience

### **First-Time User (Free Tier)**

**User runs:** `/luna-rag`

**Response:**
```
🌙 Welcome to Luna RAG!

I see you're new here! Let's get you set up with intelligent code search.

🎁 Your Free Starter Kit:
✅ 100 searches per day
✅ 1,000 files indexed
✅ Basic semantic search
✅ Community support

🚀 Ready to explore your codebase?
Try asking me about your project:
"How does authentication work in this codebase?"
"Find similar implementations to user profiles"
"What are the error handling patterns?"

💡 Or, I can help you get started with a quick project analysis:
/luna-rag analyze
```

### **When User Hits Usage Limits**

**User runs:** `/luna-rag "complex authentication flow"`

**Response (when at limit):**
```
🎯 Great question! However, I see you've reached your daily limit of 100 searches.

⏰ Your limit resets in: 6 hours, 23 minutes

🚀 Ready for unlimited searches + Vision AI?
Upgrade to Luna RAG Pro:

💎 What you'll unlock:
✅ Unlimited semantic searches (no limits!)
✅ Unlimited file indexing
✅ Luna Vision RAG™ - analyze screenshots with code context
✅ GLM Vision - advanced visual AI testing
✅ Priority support (24hr response)

💳 Special offer: $29/month with 14-day FREE trial

Would you like to:
1️⃣ Start your free trial now
2️⃣ Learn more about Pro features
3️⃣ Wait for your free limit to reset

Just tell me your choice! 👆
```

### **When User Chooses to Upgrade**

**User responds:** "1" or "start trial" or "upgrade"

**Guided Response:**
```
🚀 Excellent choice! Let's get you set up with Luna RAG Pro.

📧 First, what's your email address?
I'll use this for your account and API key delivery.

Example: john@example.com
```

**User provides email:** "john@example.com"

**Continued Guidance:**
```
✅ Great! Email set: john@example.com

💳 Now let's set up your secure payment:

🎁 Your 14-day FREE trial includes:
• Unlimited searches immediately
• Luna Vision RAG™ screenshot analysis
• GLM Vision advanced testing
• Priority support

💰 Pricing: $0.00 today, then $29/month
🔒 Secure payment via LemonSqueezy (PCI compliant)

Ready for checkout? I'll open the secure payment page for you.

1️⃣ Open secure checkout now
2️⃣ Learn about payment methods
3️⃣ Ask questions first

What would you like to do? 👆
```

### **After Payment Success**

**Automatic Response:**
```
🎉 Congratulations! Welcome to Luna RAG Pro!

✅ Payment successful
✅ Trial activated: 14 days free
✅ Your API key: luna_AbCdEfGh1234567890IjKlMnOpQrSt
✅ Pro features enabled immediately

🚀 Try your new Pro features:
• /luna-rag "analyze login-screenshot.png" "How does this compare to our auth code?"
• /luna-rag "complex microservices architecture patterns"
• /luna-rag "comprehensive codebase analysis"

💡 Your Pro benefits:
✅ Unlimited searches and indexing
✅ Luna Vision RAG™ (screenshot analysis)
✅ GLM Vision (advanced visual AI)
✅ Priority support
✅ Advanced analytics

Ready to explore your code like never before? Try asking me anything about your project! 🌙
```

### **Returning Pro User**

**User runs:** `/luna-rag`

**Response:**
```
🌙 Welcome back, John!

💎 Luna RAG Pro Status:
✅ Trial active - 11 days remaining
✅ 1,234 searches this month
✅ 45 Vision analyses completed
✅ Priority support enabled

🚀 What can I help you with today?
• Search your codebase: "How does the payment system work?"
• Analyze screenshots: Upload an image and ask questions
• Find patterns: "Show me authentication patterns"
• Compare implementations: "Compare these two approaches"

Just ask me anything about your code! 👇
```

### **Enterprise Team Setup**

**When team user runs:** `/luna-rag`

**Response (for team leads):**
```
🏢 I see you're working with a team!

For teams of 10+ users, Luna RAG Enterprise offers:
👥 Team collaboration with shared workspaces
🔒 SSO integration (SAML, LDAP)
📊 Team analytics and usage tracking
🎓 Custom AI training on your codebase
📞 Dedicated support with SLA

💰 Team pricing starts at $39/user/month

Would you like me to:
1️⃣ Connect you with our enterprise team
2️⃣ Schedule a personalized demo
3️⃣ Continue with individual Pro account

What's best for your team? 👆
```

---

## 🎯 Guided Decision Tree Logic

The `/luna-rag` command intelligently handles all scenarios:

### **1. New User Detection**
```javascript
if (!user.exists) {
  showWelcomeAndStarterKit();
}
```

### **2. Usage Limit Check**
```javascript
if (user.tier === 'free' && user.dailyUsage >= 100) {
  showUpgradePrompt();
}
```

### **3. Feature Gate Detection**
```javascript
if (request.includes('screenshot') && user.tier === 'free') {
  showPremiumFeaturePreview();
}
```

### **4. Team Size Detection**
```javascript
if (user.teamSize >= 10) {
  showEnterpriseOptions();
}
```

### **5. Subscription Management**
```javascript
if (user.subscription.expiresSoon) {
  showRenewalReminder();
}
```

---

## 💬 Conversation Examples

### **Complete New User Journey**

```
User: /luna-rag

Luna: 🌙 Welcome to Luna RAG! I see you're new here...
       Try asking: "How does authentication work?"

User: How does authentication work here?

Luna: 🔍 I found 23 authentication patterns in your codebase...
       [Provides comprehensive analysis]

User: Wow! Can you analyze this login screenshot I have?

Luna: 🖼️ That's Luna Vision RAG™ - our premium feature!
       🎁 Try it free (watermarked) or upgrade for full analysis.
       Ready to unlock unlimited Vision AI? (14-day free trial)

User: Yes, let's try the trial!

Luna: 🚀 Great! What's your email address?
       [Guides through email setup → payment → activation]

Luna: 🎉 Welcome to Luna RAG Pro! Your API key is ready...
       Try: /luna-rag "analyze login-screenshot.png"
```

### **Seamless Upgrade Experience**

```
User: /luna-rag "Find all microservices patterns"

Luna: ⚠️ You've reached your daily limit of 100 searches.
       🚀 Upgrade for unlimited searches + Vision AI (14-day free trial)
       Ready to continue your search immediately?

User: Yes, upgrade me!

Luna: 💳 Opening secure checkout...
       [Seamless payment flow]

Luna: ✅ Welcome to Pro! Your search results are ready...
       [Provides immediate value]
```

---

## 🎨 Key Benefits of Single Guided Flow

### **For Users:**
- ✅ **Zero confusion** - One command handles everything
- ✅ **Context awareness** - Remembers conversation history
- ✅ **Natural language** - No technical commands to remember
- ✅ **Progressive disclosure** - Features revealed as needed
- ✅ **Frictionless** - Smooth upgrade path when needed

### **For Business:**
- ✅ **Higher conversion** - Natural progression from free to paid
- ✅ **Better engagement** - Conversational interface
- ✅ **Reduced support** - Self-guided onboarding
- ✅ **Clear value** - Premium benefits shown at right time
- ✅ **Team expansion** - Automatic enterprise detection

### **Technical Benefits:**
- ✅ **State management** - Maintains conversation context
- ✅ **Smart routing** - Directs users to optimal path
- ✅ **Usage tracking** - Monitors conversion triggers
- ✅ **A/B testing** - Easy to test different flows
- ✅ **Analytics** - Tracks drop-off points and conversions

---

## 🔄 Implementation Notes

### **State Management**
```javascript
const conversationState = {
  userTier: 'free',
  usageCount: 45,
  lastQuery: 'authentication patterns',
  upgradeShown: false,
  emailCollected: false,
  trialStarted: false
};
```

### **Response Templates**
```javascript
const responses = {
  welcome: '🌙 Welcome to Luna RAG...',
  limitReached: '⚠️ You\'ve reached your daily limit...',
  upgradeSuccess: '🎉 Welcome to Luna RAG Pro!',
  enterprise: '🏢 For teams of 10+ users...'
};
```

### **Conversion Tracking**
```javascript
function trackConversion(step, action) {
  analytics.track('rag_conversion', {
    step, // 'welcome', 'upgrade_prompt', 'payment', 'success'
    action,
    userTier,
    timestamp: Date.now()
  });
}
```

---

**🌙 One command, perfect experience. Users never need to learn multiple commands - just ask `/luna-rag` and let the intelligent guide handle everything!**