# Google Cloud Production Deployment

## Architecture
- **Frontend**: Cloud Run (React app container)
- **Backend**: Supabase (Database + Edge Functions)
- **CI/CD**: Cloud Build
- **Storage**: Supabase Storage + Cloud Storage (if needed)

## Prerequisites
1. Google Cloud project with billing enabled
2. gcloud CLI installed and authenticated
3. Supabase project already created
4. Domain name configured (optional)

## Deployment Steps

### 1. Set up Google Cloud Project
```bash
# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 2. Create Dockerfile
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

### 3. Create nginx.conf
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 8080;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Handle React Router
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }
}
```

### 4. Create cloudbuild.yaml
```yaml
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/expert-coaching-hub:$COMMIT_SHA', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/expert-coaching-hub:$COMMIT_SHA']
  
  # Deploy container image to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
    - 'run'
    - 'deploy'
    - 'expert-coaching-hub'
    - '--image'
    - 'gcr.io/$PROJECT_ID/expert-coaching-hub:$COMMIT_SHA'
    - '--region'
    - 'us-central1'
    - '--platform'
    - 'managed'
    - '--allow-unauthenticated'
    - '--port'
    - '8080'
    - '--memory'
    - '1Gi'
    - '--cpu'
    - '1'
    - '--timeout'
    - '30s'
    - '--concurrency'
    - '80'
    - '--max-instances'
    - '100'

substitutions:
  _REGION: us-central1

images:
  - 'gcr.io/$PROJECT_ID/expert-coaching-hub:$COMMIT_SHA'
```

### 5. Production Environment Variables
Create `.env.production`:
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key

# Withdrawal Limits (Production)
VITE_MAX_WITHDRAWAL=10000
VITE_MIN_WITHDRAWAL=10
VITE_DAILY_WITHDRAWAL_LIMIT=50000
VITE_CREDIT_AGING_DAYS=3
VITE_RATE_LIMIT_PER_HOUR=5
VITE_CONVERSION_RATE=100

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false

# External Services
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_PAYCHANGU_SECRET=your-paychangu-secret
```

### 6. Deploy Commands
```bash
# Build and deploy
gcloud builds submit --config cloudbuild.yaml .

# Set environment variables for Cloud Run
gcloud run services update expert-coaching-hub \
  --region us-central1 \
  --set-env-vars "VITE_SUPABASE_URL=https://your-project.supabase.co,VITE_SUPABASE_ANON_KEY=your-production-anon-key"
```

### 7. Domain Setup (Optional)
```bash
# Map custom domain
gcloud run services update-traffic expert-coaching-hub \
  --region us-central1 \
  --to-latest-revision

# Create domain mapping
gcloud beta run domain-mappings create \
  --domain=yourdomain.com \
  --service=expert-coaching-hub \
  --region us-central1
```

## Cost Optimization
- Cloud Run: Pay per request (free tier: 2M requests/month)
- Cloud Build: 120 build minutes/month free
- Supabase: Free tier then scale as needed

## Monitoring
- Cloud Run metrics in Google Cloud Console
- Supabase dashboard for database performance
- Set up Cloud Monitoring alerts

## Security Considerations
- All secrets in Secret Manager
- HTTPS enforced by default
- Environment variables for sensitive data
- Regular security updates

## Rollback Strategy
```bash
# List revisions
gcloud run revisions list --service expert-coaching-hub --region us-central1

# Rollback to previous revision
gcloud run services update-traffic expert-coaching-hub \
  --to-revisions=expert-coaching-hub-previous-revision=100 \
  --region us-central1
```
