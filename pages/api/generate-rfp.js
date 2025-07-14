import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import { createUploadMiddleware } from '../../lib/upload';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle file upload
    const uploadMiddleware = createUploadMiddleware('attachments', 10);
    await uploadMiddleware(req, res);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'RFP attachments are required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    console.log('Converting RFP attachments to text using Gemini...');
    
    // Get form field responses from request
    const formFieldsCount = parseInt(req.body.formFieldsCount) || 0;
    const formFieldResponses = {};
    
    for (let i = 0; i < formFieldsCount; i++) {
      const fieldName = req.body[`field_${i}_name`];
      const fieldValue = req.body[`field_${i}`];
      const fieldType = req.body[`field_${i}_type`];
      
      if (fieldName && fieldValue) {
        formFieldResponses[fieldName.toLowerCase()] = {
          value: fieldValue,
          type: fieldType,
          originalName: fieldName
        };
      }
    }
    
    console.log('Form field responses:', formFieldResponses);
    
    let allTextContent = '';
    
    // Parse all attachment files and convert to text
    for (const file of req.files) {
      try {
        console.log(`Processing ${file.originalname}...`);
        const pdfData = await pdfParse(file.buffer);
        allTextContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n${pdfData.text}`;
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        allTextContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n[Error: Could not parse this PDF file]`;
      }
    }

    // Use Gemini to convert to clean text format and fill in fields
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build form field information for the prompt
    let formFieldInfo = '';
    Object.keys(formFieldResponses).forEach(key => {
      const field = formFieldResponses[key];
      formFieldInfo += `- ${field.originalName}: ${field.value}\\n`;
    });

    const prompt = `Convert these RFP attachment documents to text with clean formatting. FILL IN all empty fields and blank lines using the form field responses provided:

**FORM FIELD RESPONSES TO USE:**
${formFieldInfo}

**DOCUMENT CONTENT:**
${allTextContent}

**INSTRUCTIONS:**
- Clean up the formatting to remove floating letters or words that appear in isolated paragraphs
- Use **bold** ONLY for major section headers and form field labels that need responses
- Do NOT bold regular content, certifications, legal requirements, or list items
- Use bullet points (•) for lists of items, certifications, and requirements
- Group related content together into coherent paragraphs
- FILL IN all blank lines, empty fields, and spaces after colons (:) with the appropriate responses from the form fields
- When you see "Name of Authorized Representative:" or similar, fill it with the value from "Name of Authorized Representative" field
- When you see "Title:" fill it with the value from "Title" field
- When you see "Date:" fill it with the value from "Date" field
- When you see "Signature:" fill it with the appropriate name from the form fields
- For Yes/No questions, use the exact response provided (Yes or No)
- Leave checkboxes as [ ] without adding any check marks unless a specific checkbox response is provided
- Match form field names to document field requests intelligently (e.g., "Name of Offerer/Bidder Firm" matches requests for company name, bidder name, etc.)
- Maintain logical structure but eliminate awkward spacing and orphaned text
- Ensure each paragraph contains complete thoughts and sentences

**EXAMPLE OF PROPER FORMATTING:**
Items like "Affirmation of Understanding of and Agreement pursuant to State Finance Law §139-j (3) and §139-j (6) (b)" should be formatted as bullet points, NOT bolded:
• Affirmation of Understanding of and Agreement pursuant to State Finance Law §139-j (3) and §139-j (6) (b)
• Offerer's Certification of Compliance with State Finance Law §139-k(5)
• Offerer Disclosure of Prior Non-Responsibility Determinations`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const convertedText = response.text();

    res.json({
      success: true,
      convertedText: convertedText,
      processedFiles: req.files.map(f => f.originalname),
      formFieldResponses: formFieldResponses
    });

  } catch (error) {
    console.error('Error converting attachments:', error.message);
    
    if (error.message.includes('API key')) {
      res.status(500).json({ 
        error: 'Gemini API configuration error. Please check your API key.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to convert attachments to text. Please try again later.' 
      });
    }
  }
}