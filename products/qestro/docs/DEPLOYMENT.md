# Qestro Deployment Guide

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database
- Redis (optional, for caching)

## Environment Setup

Copy environment template:
```bash
cp .env.development.example .env
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key for AI features |

### Optional Cloud Provider Keys

| Variable | Description |
|----------|-------------|
| `BROWSERSTACK_USERNAME` | BrowserStack account username |
| `BROWSERSTACK_ACCESS_KEY` | BrowserStack access key |
| `SAUCELABS_USERNAME` | Sauce Labs username |
| `SAUCELABS_ACCESS_KEY` | Sauce Labs access key |
| `LAMBDATEST_USERNAME` | LambdaTest username |
| `LAMBDATEST_ACCESS_KEY` | LambdaTest access key |

---

## Local Development

### Start Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:8000`

### Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`

---

## Build Verification

### Frontend Build
```bash
cd frontend
npm run build
```
Output: `frontend/dist/`

### Backend Build
```bash
cd backend
npm run build
```
Output: `backend/dist/`

---

## Running Tests

### Unit Tests
```bash
npm test
```

### E2E Tests
```bash
npx playwright test
```

### Platform Module Tests
```bash
npx playwright test tests/e2e/platform/
```

---

## Deployment

### Render Deployment

1. Connect GitHub repository to Render
2. Create Web Service for backend:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
   - Port: `8000`

3. Create Static Site for frontend:
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`

4. Set environment variables in Render dashboard

### Cloudflare Pages (Frontend)

```bash
cd frontend
npm run build
npx wrangler pages publish dist --project-name=qestro
```

### Database Migration

```bash
npm run db:migrate
```

---

## Health Check

After deployment, verify:

- Backend: `https://your-domain.com/health`
- API: `https://your-domain.com/api`
- Frontend: `https://your-domain.com`

---

## Module Routes

| Module | Frontend Route | Backend API |
|--------|---------------|-------------|
| API Studio | `/api-studio` | `/api/api-testing` |
| Security Center | `/security` | `/api/security` |
| Compliance Hub | `/compliance` | `/api/security/compliance` |
| Cloud Devices | `/cloud-devices` | `/api/devices` |
