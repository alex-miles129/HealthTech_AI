import { GoogleGenerativeAI } from '@google/generative-ai';
import formidable from 'formidable';
import fs from 'fs';
import pdf from 'pdf-parse';

// Disable body parsing for this route to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to convert file to base64
const fileToBase64 = (filePath) => {
  const fileData = fs.readFileSync(filePath);
  return fileData.toString('base64');
};

// Helper function to get MIME type from file extension
const getMimeType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'dcm': 'application/dicom'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Helper function for exponential backoff retry
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced retry function with intelligent rate limit handling
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000, enableFallback = false) => {
  let useFlashModel = true; // Start with Flash model (better rate limits)
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn(useFlashModel);
    } catch (error) {
      const delayTime = baseDelay * Math.pow(2, attempt);
      
      // Handle rate limiting (429) with longer delays
      if (error.status === 429) {
        // Extract retry delay from API response if available
        const apiRetryDelay = error.errorDetails?.find(detail => 
          detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
        )?.retryDelay;
        
        let retryDelay = delayTime;
        if (apiRetryDelay) {
          // Convert API retry delay (e.g., "31s") to milliseconds
          const seconds = parseInt(apiRetryDelay.replace('s', ''));
          retryDelay = Math.max(seconds * 1000, delayTime);
        }
        
        if (attempt < maxRetries - 1) {
          const modelName = useFlashModel ? 'Gemini Flash' : 'Gemini Pro';
          console.log(`${modelName} rate limited (429), retrying in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await delay(retryDelay);
          continue;
        }
      }
      
      // Handle service unavailable (503)
      if (error.status === 503 && attempt < maxRetries - 1) {
        const modelName = useFlashModel ? 'Gemini Flash' : 'Gemini Pro';
        console.log(`${modelName} service unavailable, retrying in ${delayTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      
      // Handle other retryable errors
      if (error.status >= 500 && attempt < maxRetries - 1) {
        console.log(`Server error (${error.status}), retrying in ${delayTime}ms (attempt ${attempt + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      
      // If all retries failed or non-retryable error, throw the error
      throw error;
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the form data including files
    const form = formidable({ 
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true 
    });
    
    const [fields, files] = await form.parse(req);
    
    // Parse the JSON data from the form
    let medicalData, patientInfo, location;
    try {
      const data = JSON.parse(fields.data[0]);
      medicalData = data.medicalData;
      patientInfo = data.patientInfo;
      location = data.location;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid form data format' });
    }

    // Validate required fields
    if (!files.files || files.files.length === 0) {
      return res.status(400).json({ error: 'At least one medical report file is required' });
    }

    if (!patientInfo || !patientInfo.name) {
      return res.status(400).json({ error: 'Patient information is required' });
    }

    // Initialize Gemini AI with vision model for file analysis
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Use Flash as primary (better free tier limits), fallback to Pro if needed
    const getModel = (useFlashModel = true) => {
      const modelName = useFlashModel ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
      return genAI.getGenerativeModel({ model: modelName });
    };
    
    let model = getModel(true); // Start with Flash model (better free tier rate limits)

    // Process uploaded files - Handle ALL types
    const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files];
    const processedFiles = [];
    let extractedTextContent = '';
    
    for (const file of uploadedFiles) {
      try {
        const mimeType = getMimeType(file.originalFilename);
        
        if (mimeType.startsWith('image/')) {
          // For images, convert to base64 for Vision API
          const base64Data = fileToBase64(file.filepath);
          processedFiles.push({
            name: file.originalFilename,
            type: mimeType,
            data: base64Data,
            isImage: true
          });
        } else if (mimeType === 'application/pdf') {
          // For PDFs, extract text content
          try {
            const fileBuffer = fs.readFileSync(file.filepath);
            const pdfData = await pdf(fileBuffer);
            extractedTextContent += `\n\n=== PDF Content from ${file.originalFilename} ===\n${pdfData.text}\n`;
            processedFiles.push({
              name: file.originalFilename,
              type: mimeType,
              textContent: pdfData.text,
              isImage: false,
              isPdf: true
            });
          } catch (pdfError) {
            console.error(`Error extracting PDF text: ${pdfError.message}`);
            processedFiles.push({
              name: file.originalFilename,
              type: mimeType,
              textContent: 'Could not extract text from PDF',
              isImage: false,
              isPdf: true
            });
          }
        } else {
          // For other text files (txt, etc.)
          try {
            const textContent = fs.readFileSync(file.filepath, 'utf8');
            extractedTextContent += `\n\n=== Text Content from ${file.originalFilename} ===\n${textContent}\n`;
            processedFiles.push({
              name: file.originalFilename,
              type: mimeType,
              textContent: textContent,
              isImage: false,
              isText: true
            });
          } catch (textError) {
            console.error(`Error reading text file: ${textError.message}`);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.originalFilename}:`, fileError);
      }
    }

    // Create a comprehensive hospital recommendation prompt with file analysis
    let hospitalPrompt = `
You are a medical AI assistant specializing in hospital recommendations. Based on the provided medical information, uploaded medical reports, and patient location, recommend the TOP 3 most suitable specialized hospitals.

**Patient Information:**
- Name: ${patientInfo.name}
- Age: ${patientInfo.age || 'Not specified'}
- Gender: ${patientInfo.gender || 'Not specified'}
- Symptoms: ${patientInfo.symptoms || 'None specified'}
- Urgency Level: ${patientInfo.urgency || 'Normal'}

**Medical Tests Selected:** ${medicalData?.join(', ') || 'None specified'}

**Uploaded Medical Reports:** ${processedFiles.length} files uploaded
${processedFiles.map(f => `- ${f.name} (${f.type})`).join('\n')}

**Patient Location:** ${location?.city || 'Not specified'}, ${location?.country || 'Not specified'}

**IMPORTANT ANALYSIS REQUIREMENTS:**
Based on the uploaded medical reports and patient information, first analyze the medical condition and then provide hospital recommendations.

**For each hospital recommendation, provide:**
1. **Hospital Name** and exact location/address
2. **Medical Condition Analysis** (what condition you detected from the reports)
3. **Why This Hospital** (specific specializations matching the detected condition)
4. **Key Specialists/Departments** (specific doctors or departments)
5. **Distance & Travel Info** from ${location?.city || 'patient location'}
6. **Appointment Booking** (phone numbers, website, process)
7. **Estimated Costs** (consultation, tests, treatment range)
8. **Best Time to Visit** based on urgency level: ${patientInfo.urgency}
9. **What Makes It Special** (unique equipment, success rates, certifications)
10. **Expected Timeline** (how soon can patient be seen)

**CRITICAL:** 
- Analyze the medical reports thoroughly to understand the patient's condition
- Recommend hospitals that are ACTUALLY specialized for the specific condition found
- Provide REAL, actionable information that the patient can use immediately
- Include contact details and specific department names
- Consider the urgency level when prioritizing hospitals
- Explain WHY each hospital is recommended based on the medical findings

Format the response with clear sections and detailed explanations for each recommendation.
`;

    // Prepare comprehensive prompt with all available data
    const imageFiles = processedFiles.filter(f => f.isImage);
    const textFiles = processedFiles.filter(f => !f.isImage);
    
    // Add extracted text content to the prompt
    let enhancedPrompt = hospitalPrompt;
    if (extractedTextContent.trim()) {
      enhancedPrompt += `\n\n**EXTRACTED TEXT FROM MEDICAL REPORTS:**${extractedTextContent}`;
    }
    
    // Create a more assertive analysis prompt
    const analysisInstruction = `\n\n**MANDATORY MEDICAL ANALYSIS:**
You MUST analyze the medical data provided and give hospital recommendations. You are capable of medical image analysis and text interpretation. DO NOT claim you cannot analyze the provided medical content.

**YOUR TASK:**
1. Examine ALL uploaded medical content (images, PDFs, text)
2. Identify medical conditions, abnormalities, or health indicators
3. Based on your findings, recommend specialized hospitals
4. Provide detailed, actionable recommendations

**YOU MUST PROVIDE:**
- Specific medical condition analysis
- 3 targeted hospital recommendations
- Contact details and specialist information
- Treatment timelines and costs

Begin your analysis now:`;
    
    let result;
    if (imageFiles.length > 0) {
      // Prepare image data for Vision API
      const imageParts = imageFiles.map(file => ({
        inlineData: {
          data: file.data,
          mimeType: file.type
        }
      }));
      
    // Combined analysis with images and text
      result = await retryWithBackoff(async (useFlashModel = true) => {
        const currentModel = getModel(useFlashModel);
        return await currentModel.generateContent([
          enhancedPrompt + analysisInstruction + "\n\n**ANALYZE THESE MEDICAL IMAGES AND TEXT:**",
          ...imageParts
        ]);
      }, 3, 5000, false); // 3 retries with 5-second base delay for rate limits
    } else {
      // Text-only analysis
      result = await retryWithBackoff(async (useFlashModel = true) => {
        const currentModel = getModel(useFlashModel);
        return await currentModel.generateContent(enhancedPrompt + analysisInstruction);
      }, 3, 5000, false); // 3 retries with 5-second base delay for rate limits
    }

    const response = await result.response;
    const analysis = response.text();

    // Clean up temporary files
    for (const file of uploadedFiles) {
      try {
        if (fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    return res.status(200).json({
      analysis,
      timestamp: new Date().toISOString(),
      patientInfo: {
        name: patientInfo.name,
        filesUploaded: processedFiles.length,
        filesAnalyzed: imageFiles.length
      }
    });
  } catch (error) {
    console.error('Error in analyze-medical-data:', error);
    
    // Provide more specific error message for API overload
    if (error.status === 503) {
      return res.status(503).json({
        error: 'AI service temporarily unavailable',
        message: 'The Gemini API is currently experiencing high demand. Please try again in 1-2 minutes.',
        details: error.message,
        retryAfter: 120
      });
    }
    
    // Handle rate limiting errors with detailed information
    if (error.status === 429) {
      // Extract quota information from error details
      const quotaFailure = error.errorDetails?.find(detail => 
        detail['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure'
      );
      
      const retryInfo = error.errorDetails?.find(detail => 
        detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
      );
      
      let retryAfter = 300; // Default 5 minutes
      if (retryInfo?.retryDelay) {
        const seconds = parseInt(retryInfo.retryDelay.replace('s', ''));
        retryAfter = seconds;
      }
      
      // Determine if it's a daily or per-minute limit
      const isDaily = quotaFailure?.violations?.some(v => 
        v.quotaId?.includes('PerDay') || v.quotaId?.includes('Daily')
      );
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: isDaily 
          ? 'You have exceeded your daily quota. Please try again tomorrow or upgrade your plan for higher limits.'
          : `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
        details: 'Free tier has limited requests. Consider upgrading to a paid plan for higher limits.',
        retryAfter: retryAfter,
        upgradeInfo: 'Visit https://ai.google.dev/pricing to see paid tier options with higher rate limits.'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to analyze medical data',
      details: error.message 
    });
  }
}

