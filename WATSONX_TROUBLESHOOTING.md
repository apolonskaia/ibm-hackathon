# watsonx.ai Setup Troubleshooting Guide

## Current Issue

**Error:** `project_id is not associated with a WML instance`

This means your watsonx.ai project needs to be properly linked to a Watson Machine Learning service.

## Solution Steps

### Step 1: Verify Watson Machine Learning Service

1. Go to IBM Cloud Console: https://cloud.ibm.com
2. Navigate to **Resource List**
3. Look for **Watson Machine Learning** under "AI / Machine Learning"
4. If you don't see it, you need to create one:
   - Click **Create resource**
   - Search for "Watson Machine Learning"
   - Select the **Lite** plan (free)
   - Click **Create**

### Step 2: Create watsonx.ai Project Correctly

1. Go to watsonx.ai: https://dataplatform.cloud.ibm.com/wx/home
2. Click **"Work with data and models in a project"**
3. Click **"Create a project"**
4. Select **"Create an empty project"**
5. **Important:** When creating the project:
   - Give it a name (e.g., "System Design Assistant")
   - **Select a storage service** (Cloud Object Storage)
   - **Associate with Watson Machine Learning** service
6. Click **Create**

### Step 3: Get the Correct Project ID

1. Open your newly created project
2. Click on the **Manage** tab
3. Go to **General** section
4. Copy the **Project ID** (it's a UUID like `86a219fc-05d3-46b6-98a4-2ed24e6dd769`)

### Step 4: Verify WML Association

1. In your project, go to **Manage** → **Services and integrations**
2. You should see **Watson Machine Learning** listed
3. If not, click **Associate service** and select your WML instance

### Step 5: Get API Key

1. Go to IBM Cloud Console: https://cloud.ibm.com
2. Click on **Manage** → **Access (IAM)**
3. Click **API keys** in the left sidebar
4. Click **Create an IBM Cloud API key**
5. Give it a name (e.g., "watsonx-api-key")
6. Click **Create**
7. **Copy the API key immediately** (you won't be able to see it again)

### Step 6: Update .env.local

```env
WATSONX_API_KEY=your-new-api-key-here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your-new-project-id-here
```

### Step 7: Test Connection

```bash
npx tsx scripts/test-watsonx.ts
```

## Common Issues

### Issue 1: "No associated service instance"
**Cause:** Project not linked to Watson Machine Learning
**Solution:** Follow Step 4 above to associate WML service

### Issue 2: "Invalid credentials"
**Cause:** Wrong API key or expired key
**Solution:** Create a new API key (Step 5)

### Issue 3: "Project not found"
**Cause:** Wrong Project ID or project in different region
**Solution:** Verify Project ID in project settings

### Issue 4: "Service not available in region"
**Cause:** WML service not available in your region
**Solution:** Create WML service in us-south region

## Alternative: Use OpenAI Instead

If you continue to have issues with watsonx.ai, you can use OpenAI as an alternative:

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key

### 2. Update .env.local

```env
# Use OpenAI instead of watsonx.ai
USE_OPENAI=true
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4
```

### 3. Install OpenAI SDK

```bash
npm install openai --legacy-peer-deps
```

### 4. I'll modify the code to support OpenAI

Let me know if you want to switch to OpenAI, and I'll update the code accordingly.

## Verification Checklist

- [ ] Watson Machine Learning service created
- [ ] watsonx.ai project created
- [ ] WML service associated with project
- [ ] API key created and copied
- [ ] Project ID copied from project settings
- [ ] .env.local updated with correct values
- [ ] Test script runs successfully

## Need Help?

If you're still having issues:

1. **Check IBM Cloud Status:** https://cloud.ibm.com/status
2. **Review watsonx.ai docs:** https://cloud.ibm.com/docs/watsonx
3. **Contact IBM Support:** https://cloud.ibm.com/unifiedsupport/supportcenter

## Quick Switch to OpenAI

If you want to use OpenAI instead (easier setup, no IBM Cloud configuration needed):

```bash
# 1. Get OpenAI API key from https://platform.openai.com/api-keys
# 2. Update .env.local:
echo "USE_OPENAI=true" >> .env.local
echo "OPENAI_API_KEY=your-key-here" >> .env.local

# 3. Install OpenAI
npm install openai --legacy-peer-deps

# 4. Let me know, and I'll update the code to support OpenAI
```

This will be much simpler and faster to set up!