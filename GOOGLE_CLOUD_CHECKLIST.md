# Google Cloud Production Setup Checklist

## Pre-Deployment Checklist

### Google Cloud Setup
- [ ] Create Google Cloud project
- [ ] Enable billing
- [ ] Install and authenticate gcloud CLI
- [ ] Enable required APIs:
  - [ ] Cloud Run API
  - [ ] Cloud Build API  
  - [ ] Artifact Registry API

### Supabase Production
- [ ] Create production Supabase project
- [ ] Migrate database schema
- [ ] Deploy edge functions to production
- [ ] Set up production secrets:
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] PAYCHANGU_SECRET_KEY
  - [ ] GOOGLE_CLIENT_SECRET
  - [ ] JWT_SECRET

### Environment Configuration
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Update all production values
- [ ] Test locally with production config

### Domain & SSL
- [ ] Purchase domain (if needed)
- [ ] Configure DNS records
- [ ] Set up SSL certificate (auto-provided by Cloud Run)

## Deployment Commands

### Initial Setup
```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Make deploy script executable
chmod +x deploy.sh
```

### Deploy to Production
```bash
# Build and deploy
npm run deploy:prod

# Or manually
./deploy.sh production
```

### Deploy to Staging
```bash
npm run deploy:staging
```

## Post-Deployment Verification

### Health Checks
- [ ] Service responds at URL
- [ ] `/health` endpoint returns 200
- [ ] Supabase connection works
- [ ] Authentication flows work

### Feature Testing
- [ ] User signup/login
- [ ] Course enrollment
- [ ] Credit purchase
- [ ] Withdrawal system
- [ ] Google Meet integration
- [ ] File uploads

### Monitoring Setup
- [ ] Cloud Run metrics dashboard
- [ ] Error reporting in Google Cloud Console
- [ ] Supabase monitoring
- [ ] Set up alerts for:
  - [ ] High error rates
  - [ ] High response times
  - [ ] Memory usage spikes

## Security Checklist

### Secrets Management
- [ ] All secrets in Google Secret Manager
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly set
- [ ] API keys have minimal permissions

### Security Headers
- [ ] HTTPS enforced
- [ ] CSP headers configured
- [ ] XSS protection enabled
- [ ] Frame protection set

### Access Control
- [ ] IAM roles configured
- [ ] Service accounts with minimal permissions
- [ ] Audit logging enabled

## Performance Optimization

### Cloud Run Settings
- [ ] Concurrency set appropriately (80)
- [ ] Memory allocation sufficient (1Gi)
- [ ] CPU allocation adequate (1)
- [ ] Timeout set (30s)
- [ ] Max instances configured (100)

### Frontend Optimization
- [ ] Bundle size analyzed
- [ ] Images optimized
- [ ] Caching headers set
- [ ] Gzip compression enabled

## Rollback Plan

### Quick Rollback
```bash
# List revisions
gcloud run revisions list --service expert-coaching-hub --region us-central1

# Rollback to previous
gcloud run services update-traffic expert-coaching-hub \
  --to-revisions=expert-coaching-hub-previous-revision=100 \
  --region us-central1
```

### Emergency Procedures
- [ ] Document emergency contacts
- [ ] Prepare rollback script
- [ ] Test rollback procedure
- [ ] Communicate with users

## Cost Monitoring

### Expected Costs (Monthly)
- Cloud Run: ~$10-50 (depending on traffic)
- Cloud Build: ~$0-20 (120 free minutes)
- Supabase: ~$25+ (Pro tier)
- Domain: ~$10-15/year

### Budget Alerts
- [ ] Set budget alerts in Google Cloud
- [ ] Monitor usage daily
- [ ] Review costs monthly

## Troubleshooting

### Common Issues
1. **Build fails** - Check Dockerfile and dependencies
2. **Deployment fails** - Verify IAM permissions
3. **502 errors** - Check health endpoint
4. **Authentication fails** - Verify Supabase keys
5. **Edge functions fail** - Check Supabase logs

### Debug Commands
```bash
# Check build logs
gcloud builds list --limit=5

# Check service logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50

# Check service status
gcloud run services describe expert-coaching-hub --region us-central1
```

## Maintenance

### Regular Tasks
- [ ] Update dependencies monthly
- [ ] Review security advisories
- [ ] Backup database regularly
- [ ] Monitor performance metrics
- [ ] Review costs quarterly

### Update Process
1. Test changes in staging
2. Create backup of production
3. Deploy to production
4. Monitor for issues
5. Rollback if needed
