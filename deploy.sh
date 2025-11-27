#!/bin/bash

# Google Cloud Deployment Script
# Usage: ./deploy.sh [staging|production]

set -e

# Configuration
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
SERVICE_NAME="expert-coaching-hub"
ENVIRONMENT=${1:-production}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting deployment to $ENVIRONMENT...${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Set project
echo -e "${YELLOW}Setting project to $PROJECT_ID${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${YELLOW}Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Check if .env.production exists
if [ "$ENVIRONMENT" = "production" ] && [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    echo -e "${YELLOW}Please copy .env.production.example to .env.production and update the values${NC}"
    exit 1
fi

# Build and deploy
echo -e "${YELLOW}Building and deploying...${NC}"
if [ "$ENVIRONMENT" = "staging" ]; then
    # Deploy to staging
    gcloud builds submit --config cloudbuild.yaml . \
        --substitutions=_SERVICE_NAME=${SERVICE_NAME}-staging,_REGION=$REGION
else
    # Deploy to production
    gcloud builds submit --config cloudbuild.yaml . \
        --substitutions=_SERVICE_NAME=$SERVICE_NAME,_REGION=$REGION
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region $REGION \
    --format 'value(status.url)')

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"

# Health check
echo -e "${YELLOW}Performing health check...${NC}"
if curl -f "$SERVICE_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}Health check passed!${NC}"
else
    echo -e "${RED}Health check failed!${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment to $ENVIRONMENT completed successfully!${NC}"
