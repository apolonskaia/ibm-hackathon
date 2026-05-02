#!/bin/bash

# IBM Cloud Deployment Script for AI System Design Assistant
# This script automates the deployment process to IBM Cloud

set -e  # Exit on error

echo "🚀 IBM Cloud Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if IBM Cloud CLI is installed
if ! command -v ibmcloud &> /dev/null; then
    echo -e "${RED}❌ IBM Cloud CLI is not installed${NC}"
    echo "Please install it from: https://cloud.ibm.com/docs/cli"
    exit 1
fi

echo -e "${GREEN}✓ IBM Cloud CLI found${NC}"

# Check if logged in
if ! ibmcloud target &> /dev/null; then
    echo -e "${YELLOW}⚠ Not logged in to IBM Cloud${NC}"
    echo "Logging in..."
    ibmcloud login --sso
fi

echo -e "${GREEN}✓ Logged in to IBM Cloud${NC}"

# Prompt for deployment method
echo ""
echo "Select deployment method:"
echo "1) Cloud Foundry (Quick & Easy)"
echo "2) Code Engine (Recommended for Production)"
echo "3) Kubernetes (Advanced)"
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying to Cloud Foundry..."
        
        # Check if CF is targeted
        if ! ibmcloud target --cf &> /dev/null; then
            echo "Setting up Cloud Foundry target..."
            ibmcloud target --cf
        fi
        
        # Build the application
        echo "Building application..."
        npm run build
        
        # Deploy
        echo "Pushing to Cloud Foundry..."
        ibmcloud cf push
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        echo "Your app is available at:"
        ibmcloud cf app ai-system-design-assistant
        ;;
        
    2)
        echo ""
        echo "🚢 Deploying to Code Engine..."
        
        # Check if Code Engine plugin is installed
        if ! ibmcloud plugin show code-engine &> /dev/null; then
            echo "Installing Code Engine plugin..."
            ibmcloud plugin install code-engine
        fi
        
        # Prompt for project name
        read -p "Enter Code Engine project name (default: ai-design-assistant): " project_name
        project_name=${project_name:-ai-design-assistant}
        
        # Create or select project
        if ! ibmcloud ce project get --name "$project_name" &> /dev/null; then
            echo "Creating Code Engine project..."
            ibmcloud ce project create --name "$project_name"
        else
            echo "Using existing project..."
            ibmcloud ce project select --name "$project_name"
        fi
        
        # Prompt for watsonx credentials
        echo ""
        echo "Enter watsonx.ai credentials:"
        read -p "API Key: " watsonx_api_key
        read -p "Project ID: " watsonx_project_id
        
        # Create secret
        echo "Creating secret for credentials..."
        ibmcloud ce secret create --name watsonx-credentials \
            --from-literal WATSONX_API_KEY="$watsonx_api_key" \
            --from-literal WATSONX_PROJECT_ID="$watsonx_project_id" \
            --from-literal WATSONX_URL="https://us-south.ml.cloud.ibm.com" \
            --force
        
        # Build and deploy
        echo "Building container image..."
        ibmcloud ce build create --name ai-design-build \
            --source . \
            --strategy dockerfile \
            --size large \
            --force
        
        echo "Submitting build..."
        ibmcloud ce buildrun submit --build ai-design-build --wait
        
        echo "Deploying application..."
        ibmcloud ce application create --name ai-design-assistant \
            --build-source . \
            --env-from-secret watsonx-credentials \
            --min-scale 1 \
            --max-scale 5 \
            --cpu 1 \
            --memory 2G \
            --port 3000 \
            --force
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        echo "Your app URL:"
        ibmcloud ce application get --name ai-design-assistant --output url
        ;;
        
    3)
        echo ""
        echo "☸️  Deploying to Kubernetes..."
        
        # Prompt for cluster name
        read -p "Enter Kubernetes cluster name: " cluster_name
        
        # Get cluster config
        echo "Configuring kubectl..."
        ibmcloud ks cluster config --cluster "$cluster_name"
        
        # Prompt for watsonx credentials
        echo ""
        echo "Enter watsonx.ai credentials:"
        read -p "API Key: " watsonx_api_key
        read -p "Project ID: " watsonx_project_id
        
        # Create secret
        echo "Creating Kubernetes secret..."
        kubectl create secret generic watsonx-credentials \
            --from-literal=api-key="$watsonx_api_key" \
            --from-literal=project-id="$watsonx_project_id" \
            --dry-run=client -o yaml | kubectl apply -f -
        
        # Build and push image
        echo "Building Docker image..."
        docker build -t us.icr.io/namespace/ai-design-assistant:latest .
        
        echo "Pushing to IBM Container Registry..."
        docker push us.icr.io/namespace/ai-design-assistant:latest
        
        # Deploy
        echo "Deploying to Kubernetes..."
        kubectl apply -f k8s/deployment.yaml
        
        echo -e "${GREEN}✓ Deployment complete!${NC}"
        echo "Getting service URL..."
        kubectl get service ai-design-assistant
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 Deployment successful!${NC}"
echo ""
echo "Next steps:"
echo "1. Test your application"
echo "2. Configure custom domain (optional)"
echo "3. Set up monitoring and alerts"
echo "4. Review logs for any issues"
echo ""
echo "For more information, see IBM_CLOUD_DEPLOYMENT.md"

# Made with Bob
