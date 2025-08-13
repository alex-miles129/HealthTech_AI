import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testApiKey() {
  try {
    console.log('Testing Gemini API Key...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
    
    if (!apiKey || apiKey === 'YOUR_ACTUAL_GEMINI_API_KEY' || apiKey === 'PASTE_YOUR_REAL_API_KEY_HERE') {
      console.error('❌ API key not set properly in .env.local');
      console.log('Please update GEMINI_API_KEY in .env.local with your actual API key from Google AI Studio');
      return;
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const result = await model.generateContent('Hello, world!');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ API Key is working!');
    console.log('Response:', text);
    
  } catch (error) {
    console.error('❌ API Key test failed:', error.message);
    
    if (error.message.includes('API key not valid')) {
      console.log('\n🔧 How to fix:');
      console.log('1. Go to https://makersuite.google.com/app/apikey');
      console.log('2. Create a new API key');
      console.log('3. Update GEMINI_API_KEY in .env.local');
      console.log('4. Restart your development server');
    }
  }
}

testApiKey();
