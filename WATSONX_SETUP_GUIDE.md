# IBM watsonx.ai Setup Guide

This guide walks you through setting up IBM watsonx.ai for the AI-powered System Design Assistant.

## Prerequisites

- IBM Cloud account (free tier available)
- Node.js 18+ installed
- Basic understanding of API integration

## Step 1: Create IBM Cloud Account

1. Visit [IBM Cloud](https://cloud.ibm.com/registration)
2. Sign up for a free account or log in to existing account
3. Verify your email address

## Step 2: Create watsonx.ai Project

### 2.1 Access watsonx.ai

1. Log in to [IBM Cloud Console](https://cloud.ibm.com/)
2. Navigate to **Catalog** in the top menu
3. Search for "watsonx.ai"
4. Click on **watsonx.ai** service

### 2.2 Create Service Instance

1. Click **Create** button
2. Select your region (e.g., Dallas, Frankfurt, Tokyo)
3. Choose pricing plan:
   - **Lite Plan**: Free tier with limited requests (good for development)
   - **Essentials Plan**: Pay-as-you-go for production
4. Give your service a name (e.g., "system-design-assistant")
5. Click **Create**

### 2.3 Create Project

1. After service creation, click **Launch watsonx.ai**
2. In watsonx.ai interface, click **Projects** in left sidebar
3. Click **New project**
4. Choose **Create an empty project**
5. Enter project details:
   - **Name**: "System Design Assistant"
   - **Description**: "AI-powered architecture design tool"
   - **Storage**: Select or create Cloud Object Storage instance
6. Click **Create**

## Step 3: Get API Credentials

### 3.1 Get API Key

1. In IBM Cloud Console, go to **Manage** → **Access (IAM)**
2. Click **API keys** in left sidebar
3. Click **Create an IBM Cloud API key**
4. Enter name: "watsonx-system-design"
5. Click **Create**
6. **IMPORTANT**: Copy and save the API key immediately (you won't see it again)

### 3.2 Get Project ID

1. In watsonx.ai interface, open your project
2. Click **Manage** tab
3. Under **General**, find **Project ID**
4. Copy the Project ID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 3.3 Get Service URL

The service URL depends on your region:

- **Dallas**: `https://us-south.ml.cloud.ibm.com`
- **Frankfurt**: `https://eu-de.ml.cloud.ibm.com`
- **Tokyo**: `https://jp-tok.ml.cloud.ibm.com`
- **London**: `https://eu-gb.ml.cloud.ibm.com`

## Step 4: Configure Environment Variables

Create a `.env.local` file in your project root:

```bash
# IBM watsonx.ai Configuration
WATSONX_API_KEY=your_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_project_id_here

# Optional: Model Configuration
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
WATSONX_MAX_TOKENS=2000
WATSONX_TEMPERATURE=0.7
```

### Security Best Practices

1. **Never commit `.env.local` to version control**
2. Add to `.gitignore`:
   ```
   .env.local
   .env*.local
   ```
3. Use different API keys for development and production
4. Rotate API keys regularly
5. Set up API key restrictions in IBM Cloud IAM

## Step 5: Install SDK

Install the IBM watsonx.ai SDK:

```bash
npm install @ibm-cloud/watsonx-ai
```

Or with yarn:

```bash
yarn add @ibm-cloud/watsonx-ai
```

## Step 6: Test Connection

Create a test script to verify your setup:

```typescript
// scripts/test-watsonx.ts
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';

async function testConnection() {
  try {
    const watsonxClient = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: process.env.WATSONX_URL!,
      apikey: process.env.WATSONX_API_KEY!,
    });

    const response = await watsonxClient.generateText({
      input: 'Hello, this is a test message.',
      modelId: 'ibm/granite-13b-chat-v2',
      projectId: process.env.WATSONX_PROJECT_ID!,
      parameters: {
        max_new_tokens: 50,
        temperature: 0.7,
      },
    });

    console.log('✅ Connection successful!');
    console.log('Response:', response.result.results[0].generated_text);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();
```

Run the test:

```bash
npx tsx scripts/test-watsonx.ts
```

## Step 7: Choose Model

watsonx.ai offers several models. For this project, recommended options:

### IBM Granite Models (Recommended)

- **granite-13b-chat-v2**: Best for conversational AI
  - Good for clarifying questions
  - Natural dialogue flow
  - Moderate token usage

- **granite-20b-code**: Best for technical content
  - Excellent for architecture generation
  - Strong code understanding
  - Higher token usage

### Meta Llama Models

- **llama-3-70b-instruct**: Most capable
  - Best overall performance
  - Highest quality responses
  - Higher cost

- **llama-3-8b-instruct**: Faster and cheaper
  - Good for simple tasks
  - Lower latency
  - Cost-effective

### Model Selection Strategy

```typescript
// config/models.ts
export const MODEL_CONFIG = {
  clarification: {
    modelId: 'ibm/granite-13b-chat-v2',
    temperature: 0.7,
    maxTokens: 500,
  },
  architecture: {
    modelId: 'meta-llama/llama-3-70b-instruct',
    temperature: 0.5,
    maxTokens: 2000,
  },
  justification: {
    modelId: 'ibm/granite-13b-chat-v2',
    temperature: 0.3,
    maxTokens: 1500,
  },
  diagram: {
    modelId: 'ibm/granite-20b-code',
    temperature: 0.2,
    maxTokens: 1000,
  },
};
```

## Step 8: Implement API Client

Create a reusable watsonx.ai client:

```typescript
// lib/watsonx-client.ts
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';

class WatsonXClient {
  private client: WatsonXAI;
  private projectId: string;

  constructor() {
    this.client = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: process.env.WATSONX_URL!,
      apikey: process.env.WATSONX_API_KEY!,
    });
    this.projectId = process.env.WATSONX_PROJECT_ID!;
  }

  async generateText(
    prompt: string,
    options: {
      modelId?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ) {
    const {
      modelId = 'ibm/granite-13b-chat-v2',
      temperature = 0.7,
      maxTokens = 2000,
    } = options;

    try {
      const response = await this.client.generateText({
        input: prompt,
        modelId,
        projectId: this.projectId,
        parameters: {
          max_new_tokens: maxTokens,
          temperature,
          top_p: 0.9,
          top_k: 50,
          repetition_penalty: 1.1,
        },
      });

      return response.result.results[0].generated_text;
    } catch (error) {
      console.error('watsonx.ai API error:', error);
      throw new Error('Failed to generate text from watsonx.ai');
    }
  }

  async generateWithRetry(
    prompt: string,
    options: any = {},
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateText(prompt, options);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }
}

export const watsonxClient = new WatsonXClient();
```

## Step 9: Rate Limiting & Cost Management

### Monitor Usage

1. In IBM Cloud Console, go to your watsonx.ai service
2. Click **Usage** tab
3. Monitor:
   - API calls per day
   - Token usage
   - Cost estimates

### Implement Rate Limiting

```typescript
// lib/rate-limiter.ts
import { RateLimiter } from 'limiter';

// Allow 50 requests per minute to watsonx.ai
export const watsonxRateLimiter = new RateLimiter({
  tokensPerInterval: 50,
  interval: 'minute',
});

// Usage in API routes
export async function callWatsonX(prompt: string) {
  await watsonxRateLimiter.removeTokens(1);
  return watsonxClient.generateText(prompt);
}
```

### Cost Optimization Tips

1. **Cache responses**: Store common patterns
2. **Optimize prompts**: Shorter prompts = lower cost
3. **Use appropriate models**: Don't use Llama-70b for simple tasks
4. **Batch requests**: Combine multiple questions when possible
5. **Set token limits**: Prevent runaway generation

## Step 10: Error Handling

Implement robust error handling:

```typescript
// lib/watsonx-error-handler.ts
export class WatsonXError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'WatsonXError';
  }
}

export function handleWatsonXError(error: any): WatsonXError {
  if (error.status === 401) {
    return new WatsonXError(
      'Invalid API key or unauthorized access',
      'UNAUTHORIZED',
      401
    );
  }

  if (error.status === 429) {
    return new WatsonXError(
      'Rate limit exceeded. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }

  if (error.status === 500) {
    return new WatsonXError(
      'watsonx.ai service error. Please try again.',
      'SERVICE_ERROR',
      500
    );
  }

  return new WatsonXError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    500
  );
}
```

## Troubleshooting

### Common Issues

#### 1. "Invalid API Key" Error

**Solution**:
- Verify API key is correct in `.env.local`
- Check API key hasn't expired
- Ensure API key has proper permissions in IAM

#### 2. "Project not found" Error

**Solution**:
- Verify Project ID is correct
- Ensure project exists in watsonx.ai
- Check you're using the right IBM Cloud account

#### 3. "Rate limit exceeded" Error

**Solution**:
- Implement rate limiting in your code
- Upgrade to higher tier plan
- Add exponential backoff retry logic

#### 4. Slow Response Times

**Solution**:
- Use smaller models for simple tasks
- Reduce max_tokens parameter
- Implement caching for common queries
- Consider using streaming responses

#### 5. High Costs

**Solution**:
- Monitor usage in IBM Cloud Console
- Set up billing alerts
- Implement request caching
- Use Lite plan for development
- Optimize prompt lengths

## Production Checklist

Before deploying to production:

- [ ] API keys stored securely (not in code)
- [ ] Rate limiting implemented
- [ ] Error handling in place
- [ ] Usage monitoring configured
- [ ] Billing alerts set up
- [ ] Caching strategy implemented
- [ ] Retry logic with exponential backoff
- [ ] Logging for debugging
- [ ] Different API keys for dev/prod
- [ ] Cost optimization measures active

## Additional Resources

- [IBM watsonx.ai Documentation](https://www.ibm.com/docs/en/watsonx-as-a-service)
- [watsonx.ai API Reference](https://cloud.ibm.com/apidocs/watsonx-ai)
- [Model Cards](https://www.ibm.com/products/watsonx-ai/foundation-models)
- [Pricing Calculator](https://www.ibm.com/products/watsonx-ai/pricing)
- [IBM Cloud Support](https://cloud.ibm.com/unifiedsupport/supportcenter)

## Support

If you encounter issues:

1. Check [IBM Cloud Status](https://cloud.ibm.com/status)
2. Review [watsonx.ai Documentation](https://www.ibm.com/docs/en/watsonx-as-a-service)
3. Contact IBM Cloud Support
4. Join [IBM Developer Community](https://community.ibm.com/)

## Next Steps

After completing this setup:

1. Test the connection with the provided script
2. Implement the API client in your Next.js application
3. Create prompt templates for different use cases
4. Set up monitoring and logging
5. Begin integration with your application features

Your watsonx.ai setup is now complete! You're ready to integrate AI capabilities into your System Design Assistant.