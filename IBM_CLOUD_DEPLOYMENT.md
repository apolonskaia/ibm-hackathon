# IBM Cloud Deployment Guide

This guide provides step-by-step instructions for deploying the AI System Design Assistant to IBM Cloud.

## Prerequisites

1. **IBM Cloud Account**: Sign up at https://cloud.ibm.com
2. **IBM Cloud CLI**: Install from https://cloud.ibm.com/docs/cli
3. **watsonx.ai Access**: Ensure you have access to IBM watsonx.ai service
4. **Git**: For version control and deployment

## Deployment Options

### Option 1: IBM Cloud Foundry (Recommended for Quick Start)

#### Step 1: Install IBM Cloud CLI
```bash
# macOS
curl -fsSL https://clis.cloud.ibm.com/install/osx | sh

# Linux
curl -fsSL https://clis.cloud.ibm.com/install/linux | sh

# Windows (PowerShell)
iex(New-Object Net.WebClient).DownloadString('https://clis.cloud.ibm.com/install/powershell')
```

#### Step 2: Login to IBM Cloud
```bash
ibmcloud login
# Or with SSO
ibmcloud login --sso

# Target your organization and space
ibmcloud target --cf
```

#### Step 3: Create watsonx.ai Service
```bash
# Create watsonx.ai service instance
ibmcloud resource service-instance-create watsonx-ai-service pm-20 lite us-south

# Create service key
ibmcloud resource service-key-create watsonx-ai-key Manager --instance-name watsonx-ai-service

# Get credentials
ibmcloud resource service-key watsonx-ai-key
```

#### Step 4: Set Environment Variables
Create a `.env.production` file:
```bash
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
NODE_ENV=production
```

#### Step 5: Build the Application
```bash
npm run build
```

#### Step 6: Deploy to Cloud Foundry
```bash
# Push the application
ibmcloud cf push

# Or with custom manifest
ibmcloud cf push -f manifest.yml
```

#### Step 7: Verify Deployment
```bash
# Check app status
ibmcloud cf apps

# View logs
ibmcloud cf logs ai-system-design-assistant --recent

# Open in browser
ibmcloud cf app ai-system-design-assistant
```

### Option 2: IBM Code Engine (Recommended for Production)

Code Engine is IBM's serverless container platform, ideal for production deployments.

#### Step 1: Install Code Engine Plugin
```bash
ibmcloud plugin install code-engine
```

#### Step 2: Create Code Engine Project
```bash
# Create a new project
ibmcloud ce project create --name ai-design-assistant

# Select the project
ibmcloud ce project select --name ai-design-assistant
```

#### Step 3: Create Dockerfile
A `Dockerfile` is already included in the project root. Review it:
```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Step 4: Build and Push Container
```bash
# Build the container image
ibmcloud ce build create --name ai-design-build \
  --source . \
  --strategy dockerfile \
  --size large

# Run the build
ibmcloud ce buildrun submit --build ai-design-build
```

#### Step 5: Create Secrets for Environment Variables
```bash
# Create secret for watsonx credentials
ibmcloud ce secret create --name watsonx-credentials \
  --from-literal WATSONX_API_KEY=your_api_key \
  --from-literal WATSONX_PROJECT_ID=your_project_id \
  --from-literal WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

#### Step 6: Deploy Application
```bash
# Deploy the application
ibmcloud ce application create --name ai-design-assistant \
  --image private.us.icr.io/namespace/ai-design-assistant:latest \
  --env-from-secret watsonx-credentials \
  --min-scale 1 \
  --max-scale 5 \
  --cpu 1 \
  --memory 2G \
  --port 3000

# Get application URL
ibmcloud ce application get --name ai-design-assistant
```

### Option 3: IBM Kubernetes Service (IKS)

For full control and scalability.

#### Step 1: Create Kubernetes Cluster
```bash
# Create a free cluster (for testing)
ibmcloud ks cluster create classic --name ai-design-cluster

# Or create a standard cluster (for production)
ibmcloud ks cluster create vpc-gen2 \
  --name ai-design-cluster \
  --zone us-south-1 \
  --flavor bx2.4x16 \
  --workers 3
```

#### Step 2: Configure kubectl
```bash
# Get cluster config
ibmcloud ks cluster config --cluster ai-design-cluster

# Verify connection
kubectl get nodes
```

#### Step 3: Create Kubernetes Manifests
Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-design-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-design-assistant
  template:
    metadata:
      labels:
        app: ai-design-assistant
    spec:
      containers:
      - name: app
        image: us.icr.io/namespace/ai-design-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: WATSONX_API_KEY
          valueFrom:
            secretKeyRef:
              name: watsonx-credentials
              key: api-key
        - name: WATSONX_PROJECT_ID
          valueFrom:
            secretKeyRef:
              name: watsonx-credentials
              key: project-id
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: ai-design-assistant
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: ai-design-assistant
```

#### Step 4: Deploy to Kubernetes
```bash
# Create secret
kubectl create secret generic watsonx-credentials \
  --from-literal=api-key=your_api_key \
  --from-literal=project-id=your_project_id

# Deploy application
kubectl apply -f k8s/deployment.yaml

# Get external IP
kubectl get service ai-design-assistant
```

## Environment Variables

Required environment variables for all deployment options:

```bash
# watsonx.ai Configuration
WATSONX_API_KEY=your_watsonx_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com

# Application Configuration
NODE_ENV=production
PORT=3000

# Optional: Database Configuration (if using external DB)
DATABASE_URL=path_to_database
```

## Post-Deployment Configuration

### 1. Set Up Custom Domain (Optional)
```bash
# Cloud Foundry
ibmcloud cf create-domain myorg mydomain.com
ibmcloud cf map-route ai-system-design-assistant mydomain.com

# Code Engine
ibmcloud ce application update --name ai-design-assistant \
  --domain mydomain.com
```

### 2. Configure SSL/TLS
IBM Cloud automatically provides SSL certificates for all deployments.

### 3. Set Up Monitoring
```bash
# Enable logging
ibmcloud logging config-create --name ai-design-logs

# Enable monitoring
ibmcloud monitoring config-create --name ai-design-metrics
```

### 4. Configure Auto-scaling
```bash
# Code Engine auto-scaling (already configured in deployment)
ibmcloud ce application update --name ai-design-assistant \
  --min-scale 1 \
  --max-scale 10 \
  --scale-down-delay 300
```

## Continuous Deployment with IBM Toolchain

### Step 1: Create Toolchain
1. Go to IBM Cloud Console → DevOps → Toolchains
2. Click "Create toolchain"
3. Select "Develop a Cloud Foundry app" or "Develop a Kubernetes app"

### Step 2: Configure Git Integration
1. Connect your GitHub repository
2. Set up automatic builds on push

### Step 3: Configure Delivery Pipeline
```yaml
# .bluemix/pipeline.yml
stages:
- name: BUILD
  inputs:
  - type: git
    branch: main
  jobs:
  - name: Build
    type: builder
    script: |
      npm install
      npm run build

- name: DEPLOY
  inputs:
  - type: job
    stage: BUILD
    job: Build
  jobs:
  - name: Deploy to Cloud Foundry
    type: deployer
    target:
      region_id: us-south
      organization: your-org
      space: production
    script: |
      cf push
```

## Monitoring and Maintenance

### View Application Logs
```bash
# Cloud Foundry
ibmcloud cf logs ai-system-design-assistant

# Code Engine
ibmcloud ce application logs --name ai-design-assistant

# Kubernetes
kubectl logs -l app=ai-design-assistant
```

### Monitor Performance
```bash
# View metrics
ibmcloud monitoring metric-query --metric cpu.usage \
  --resource ai-design-assistant

# Set up alerts
ibmcloud monitoring alert-create --name high-cpu \
  --condition "cpu.usage > 80" \
  --notification email
```

### Scale Application
```bash
# Cloud Foundry
ibmcloud cf scale ai-system-design-assistant -i 3

# Code Engine
ibmcloud ce application update --name ai-design-assistant \
  --max-scale 10

# Kubernetes
kubectl scale deployment ai-design-assistant --replicas=5
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start
```bash
# Check logs
ibmcloud cf logs ai-system-design-assistant --recent

# Verify environment variables
ibmcloud cf env ai-system-design-assistant
```

#### 2. watsonx.ai Connection Issues
- Verify API key is correct
- Check project ID matches your watsonx.ai project
- Ensure service is bound correctly

#### 3. Memory Issues
```bash
# Increase memory allocation
ibmcloud cf scale ai-system-design-assistant -m 1G
```

#### 4. Database Connection Issues
- Ensure data directory is writable
- Consider using IBM Cloud Object Storage for persistence

## Cost Optimization

### Tips for Reducing Costs

1. **Use Lite Plans**: Start with free tier services
2. **Auto-scaling**: Configure min-scale to 0 for Code Engine
3. **Resource Limits**: Set appropriate CPU and memory limits
4. **Monitoring**: Track usage to optimize resource allocation

### Estimated Monthly Costs

- **Cloud Foundry (512MB)**: ~$25/month
- **Code Engine (1 vCPU, 2GB)**: ~$15-30/month (pay-per-use)
- **Kubernetes (3 workers)**: ~$150/month
- **watsonx.ai**: Based on token usage (~$50-200/month)

## Security Best Practices

1. **Never commit credentials**: Use environment variables
2. **Enable HTTPS**: Automatic with IBM Cloud
3. **Regular updates**: Keep dependencies updated
4. **Access control**: Use IBM Cloud IAM
5. **Audit logs**: Enable and monitor access logs

## Support and Resources

- **IBM Cloud Docs**: https://cloud.ibm.com/docs
- **watsonx.ai Docs**: https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-overview.html
- **IBM Cloud Support**: https://cloud.ibm.com/unifiedsupport/supportcenter

## Next Steps

1. ✅ Deploy to IBM Cloud using one of the methods above
2. Configure custom domain (optional)
3. Set up monitoring and alerts
4. Configure CI/CD pipeline
5. Test the deployed application
6. Monitor usage and optimize costs

---

**Need Help?** Contact IBM Cloud Support or refer to the documentation links above.