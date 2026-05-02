// scripts/test-watsonx.ts
import { WatsonXAI } from '@ibm-cloud/watsonx-ai';
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testConnection() {
  try {
    console.log('🔍 Testing watsonx.ai connection...');
    console.log('API Key:', process.env.WATSONX_API_KEY?.substring(0, 20) + '...');
    console.log('URL:', process.env.WATSONX_URL);
    console.log('Project ID:', process.env.WATSONX_PROJECT_ID);

    // Create IAM authenticator
    const authenticator = new IamAuthenticator({
      apikey: process.env.WATSONX_API_KEY!,
    });

    const watsonxClient = WatsonXAI.newInstance({
      version: '2024-05-31',
      serviceUrl: process.env.WATSONX_URL!,
      authenticator: authenticator,
    });

    console.log('📡 Sending test request...');

    // Try with the correct model ID format
    const response = await watsonxClient.generateText({
      input: 'Hello, this is a test message.',
      modelId: 'ibm/granite-3-8b-instruct',  // Updated model ID
      projectId: process.env.WATSONX_PROJECT_ID!,
      parameters: {
        max_new_tokens: 50,
        temperature: 0.7,
      },
    });

    console.log('✅ Connection successful!');
    console.log('Response:', response.result.results[0].generated_text);
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    if (error.body) {
      console.error('Error details:', JSON.stringify(error.body, null, 2));
    }
  }
}

testConnection();