# 🔗 GitHub Connect Integration Setup Guide

## 📋 Overview

This guide will help you set up GitHub Connect integration for the Claude Code plugin, allowing users to directly access and optimize GitHub repositories within the RAG system.

## 🚀 What's Included

### **Features**
- **OAuth 2.0 Authentication**: Secure GitHub login flow
- **Repository Access**: Browse and index user repositories
- **File Content Optimization**: Direct optimization of GitHub files
- **Permission Management**: Respects GitHub repository permissions
- **Real-time Synchronization**: Sync changes from GitHub automatically
- **Batch Indexing**: Index entire repositories for RAG optimization

### **Architecture**
```
Claude Code Plugin → RAG API → GitHub API → Token Optimization
     ↓              ↓               ↓           ↓
   User Session  → JWT Auth → OAuth Flow → Content Processing → Optimized Results
```

## 🛠️ Prerequisites

### **Required Services**
1. **GitHub Account** (for creating OAuth App)
2. **Claude Code Plugin** (already configured)
3. **RAG API** (already deployed)
4. **Database** (for storing connections)

### **Required GitHub Permissions**
- `repo` - Access repositories
- `read:org` - Read organization data (optional)
- `user:email` - Read user email
- `read:user` - Read user profile

## 🔧 Step 1: Create GitHub OAuth App

### **1.1. Navigate to GitHub Settings**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in application details

### **1.2. Application Configuration**
```json
{
  "Application name": "Claude Code RAG Optimizer",
  "Homepage URL": "https://lunaos.ai",
  "Authorization callback URL": "https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/callback",
  "Application description": "Advanced token optimization system for Claude Code"
}
```

### **1.3. Set Permissions**
Configure the following GitHub scopes:
- `repo` - Full repository access
- `read:org` - Organization read access
- `user:email` - User email access
- `read:user` - User profile access

### **1.4. Generate Credentials**
Save the following values:
- **Client ID**: `github_client_id`
- **Client Secret**: `github_client_secret`

## 🔧 Step 2: Configure Environment Variables

### **2.1. Production Environment**
```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Redirect URLs
GITHUB_CALLBACK_URL=https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/callback
GITHUB_BASE_URL=https://github.com/login/oauth/authorize
```

### **2.2. Staging Environment** (Optional)
```bash
GITHUB_CLIENT_ID=your_staging_client_id
GITHUB_CLIENT_SECRET=your_staging_client_secret
GITHUB_CALLBACK_URL=https://luna-rag-api-staging.broad-dew-49ad.workers.dev/github/auth/callback
```

### **2.3. Local Development**
```bash
GITHUB_CLIENT_ID=your_dev_client_id
GITHUB_CLIENT_SECRET=your_dev_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/github/auth/callback
```

## 🔧 Step 3: Database Setup

### **3.1. Create Database Tables**
Run the migration script:

```sql
-- Create GitHub connections table
CREATE TABLE "github_connections" (
  "id" SERIAL NOT NULL,
  "user_id" UUID NOT NULL,
  "github_user_id" TEXT NOT NULL,
  "github_username" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "user_data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "github_connections_user_id_idx" ON "github_connections"("user_id");
CREATE UNIQUE INDEX "github_connections_user_id_key" ON "github_connections"("user_id");
```

### **3.2. Add Foreign Key Constraint**
```sql
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## 🔧 Step 4: Update Dependencies

### **4.1. Install Required Packages**
```bash
cd packages/api

npm install @nestjs/axios axios
npm install @nestjs/config @nestjs/swagger
npm install @nestjs/common @nestjs/core
```

### **4.2. Update Package Dependencies**
Add to `packages/api/package.json`:

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/axios": "^3.0.0",
    "axios": "^1.6.0",
    "class-transformer": "^0.5.0",
    "class-validator": "^0.14.0",
    "prisma": "^5.0.0"
  }
}
```

## 🔧 Step 5: Configuration Files

### **5.1. Environment Configuration**
Create `packages/api/.env`:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/callback

# GitHub API Rate Limiting
GITHUB_RATE_LIMIT=5000
GITHUB_RATE_LIMIT_WINDOW=3600000

# GitHub Integration Settings
GITHUB_MAX_FILES_PER_REPO=1000
GITHUB_MAX_FILE_SIZE=10485760
GITHUB_SUPPORTED_EXTENSIONS=.ts,.tsx,.js,.jsx,.py,.md,.json,.yaml,.yml
```

### **5.2. Wrangler Configuration**
Update `packages/api/wrangler.toml`:

```toml
name = "luna-rag-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[env.production]
GITHUB_CLIENT_ID = "your_production_client_id"
GITHUB_CLIENT_SECRET = "your_production_client_secret"

[env.staging]
GITHUB_CLIENT_ID = "your_staging_client_id"
GITHUB_CLIENT_SECRET = "your_staging_client_secret"
```

## 🔧 Step 6: Claude Code Plugin Integration

### **6.1. Update Plugin Configuration**
Update `luna-agents/.claude-plugin/lib/api-client.js`:

```javascript
class LunaRAGClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 
                   process.env.LUNA_API_URL || 
                   'https://luna-rag-api-prod.broad-dew-49ad.workers.dev';
    
    this.githubURL = config.githubURL || 
                  process.env.GITHUB_API_URL || 
                  'https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github';
  }

  // GitHub Integration Methods
  async connectGitHub() {
    try {
      const response = await fetch(`${this.githubURL}/auth/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('GitHub connection failed:', error);
      throw error;
    }
  }

  async getUserRepositories() {
    try {
      const response = await fetch(`${this.githubURL}/repositories`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      return { repositories: [] };
    }
  }

  async indexRepository(owner, repo, options = {}) {
    try {
      const response = await fetch(`${this.githubURL}/repositories/${owner}/${repo}/index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          owner,
          repo,
          ...options
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('Repository indexing failed:', error);
      throw error;
    }
  }

  async optimizeGitHubFile(owner, repo, filePath, options = {}) {
    try {
      const response = await fetch(`${this.githubURL}/repositories/${owner}/${repo}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          path: filePath,
          ...options
        })
      });
      
      return await response.json();
    } catch (error) {
      console.error('File optimization failed:', error);
      throw error;
    }
  }
}
```

### **6.2. Add GitHub Commands to Plugin**
Update `luna-agents/.claude-plugin/commands.js`:

```javascript
const githubCommands = {
  'github-connect': async () => {
    return await client.connectGitHub();
  },

  'github-repos': async () => {
    return await client.getUserRepositories();
  },

  'github-index': async (owner, repo) => {
    return await client.indexRepository(owner, repo);
  },

  'github-optimize': async (owner, repo, filePath) => {
    return await client.optimizeGitHubFile(owner, repo, filePath);
  },

  'github-search': async (query) => {
    return await client.searchRepositories(query);
  }
};
```

## 🔧 Step 7: Testing the Integration

### **7.1. Test GitHub Authentication**
```bash
# Test the GitHub callback endpoint
curl -X POST https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "test_code", "state": "random_state"}'
```

### **7.2. Test Repository Access**
```bash
# Get user repositories
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/repositories

# Get specific repository
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/repositories/owner/repo
```

### **7.3. Test File Optimization**
```bash
# Optimize a file from GitHub
curl -X POST https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/repositories/owner/repo/optimize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "src/components/Button.tsx",
    "strategies": ["compression", "selection"],
    "targetTokens": 1000
  }'
```

## 🔧 Step 8: Deploy Updates

### **8.1. Deploy Updated API**
```bash
cd packages/api
npm run build
npm run deploy:prod
```

### **8.2. Update Claude Code Plugin**
```bash
cd luna-agents
npm run build
npm run publish
```

## 🔒 Security Considerations

### **8.1. Access Control**
- ✅ Users can only access repositories they have permissions for
- ✅ OAuth tokens are encrypted and stored securely
- ✅ User-specific data isolation in database
- ✅ Rate limiting for GitHub API calls

### **8.2. Data Protection**
- ✅ Access tokens never exposed in responses
- ✅ File content cached with expiration
- ✅ Audit logging for all GitHub operations
- ✅ Automatic token refresh when needed

### **8.3. Privacy**
- ✅ Only repositories with explicit user permission are accessed
- ✅ User data separated by organization and user ID
- ✅ File content processing respects privacy settings
- ✅ No sharing of private repository data

## 📊 Usage Examples

### **Example 1: Developer Workflow**
```javascript
// Developer connects GitHub account
const connection = await client.connectGitHub();

// Browse available repositories
const repos = await client.getUserRepositories();
console.log('Available repositories:', repos.repositories);

// Index a repository for optimization
const result = await client.indexRepository('my-org', 'my-repo', {
  includePatterns: ['**/*.ts', '**/*.js'],
  excludePatterns: ['**/node_modules/**', '**/dist/**'],
  strategies: ['compression', 'selection']
});

// Optimize a specific file
const optimized = await client.optimizeGitHubFile(
  'my-org', 
  'my-repo', 
  'src/components/Header.tsx',
  { targetTokens: 800 }
);
```

### **Example 2: Batch Repository Processing**
```javascript
// Process multiple repositories
const repositories = [
  { owner: 'my-org', repo: 'frontend', branch: 'main' },
  { owner: 'my-org', repo: 'backend', branch: 'main' },
  { owner: 'my-org', repo: 'docs', branch: 'main' }
];

for (const repo of repositories) {
  try {
    const result = await client.indexRepository(repo.owner, repo.repo, {
      ref: repo.branch,
      maxFiles: 200
    });
    console.log(`Indexed ${repo.owner}/${repo.repo}: ${result.indexing.indexedFiles} files`);
  } catch (error) {
    console.error(`Failed to index ${repo.owner}/${repo.repo}:`, error.message);
  }
}
```

### **Example 3: Real-time Optimization**
```javascript
// Claude Code automatically optimizes GitHub files when referenced
const optimizeGitHubContext = async (context) => {
  if (context.source === 'github') {
    const optimized = await client.optimizeGitHubFile(
      context.owner,
      context.repo,
      context.filePath,
      {
        strategies: ['compression', 'selection', 'deduplication'],
        targetTokens: context.maxTokens || 1000
      }
    );
    
    return {
      ...context,
      content: optimized.optimization.optimizedContent,
      savings: optimized.optimization.savings
    };
  }
  
  return context;
};
```

## 🚀 Next Steps

### **1. Complete the Setup**
- ✅ Create GitHub OAuth App
- ✅ Configure environment variables
- ✅ Set up database tables
- ✅ Install dependencies
- ✅ Update Claude Code plugin

### **2. Test Integration**
- ✅ Test GitHub authentication
- ✅ Verify repository access
- ✅ Test file optimization
- ✅ Validate permissions

### **3. Deploy to Production**
- ✅ Deploy updated API
- ✅ Update Claude Code plugin
- ✅ Test production endpoints
- ✅ Monitor performance

## 🆘 Troubleshooting

### **Common Issues**

#### **GitHub OAuth Callback Errors**
```bash
# Check callback URL configuration
# Must match exactly in GitHub OAuth App settings
GITHUB_CALLBACK_URL=https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/callback
```

#### **Repository Access Denied**
```bash
# Verify GitHub permissions
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/user/repos
```

#### **File Not Found**
```bash
# Check file path and repository access
curl -H "Authorization: Bearer TOKEN" \
  https://api.github.com/repos/owner/repo/contents/path/to/file
```

### **Debug Commands**
```bash
# Check GitHub connection status
curl -H "Authorization: Bearer JWT_TOKEN" \
  https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/auth/status

# List user repositories
curl -H "Authorization: Bearer JWT_TOKEN" \
  https://luna-rag-api-prod.broad-dew-49ad.workers.dev/github/repositories

# Check API health
curl https://luna-rag-api-prod.broad-dew-49ad.workers.dev/health
```

## 📚 API Documentation

### **GitHub Authentication Endpoints**
- `POST /github/auth/callback` - Handle OAuth callback
- `GET /github/auth/status` - Check connection status
- `POST /github/auth/disconnect` - Disconnect GitHub account

### **Repository Management Endpoints**
- `GET /github/repositories` - List user repositories
- `GET /github/repositories/{owner}/{repo}` - Get repository details
- `POST /github/repositories/{owner}/{repo}/index` - Index repository
- `GET /github/repositories/{owner}/{repo}/branches` - List branches
- `GET /github/repositories/{owner}/{repo}/contents` - Get file tree
- `GET /github/repositories/{owner}/{repo}/files/{path}` - Get file content

### **Optimization Endpoints**
- `POST /github/repositories/{owner}/{repo}/optimize` - Optimize file content
- `GET /github/search/repositories` - Search repositories

## 🎉 Success Criteria

The GitHub Connect integration is successful when:

✅ **Authentication**: Users can connect their GitHub accounts securely  
✅ **Access Control**: Users can only access repositories they have permissions for  
✅ **File Processing**: GitHub files can be downloaded and optimized  
✅ **Real-time Updates**: Changes in GitHub are reflected in the system  
✅ **Performance**: GitHub API calls are properly rate-limited and cached  
✅ **Security**: User data is properly isolated and protected  
✅ **Usability**: Claude Code plugin can seamlessly integrate GitHub workflows  

Your GitHub Connect integration is now ready for production use! 🚀