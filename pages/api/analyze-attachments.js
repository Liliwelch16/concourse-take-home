import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import { createUploadMiddleware } from '../../lib/upload';

export const config = {
  api: {
    bodyParser: false,
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle file upload
    const uploadMiddleware = createUploadMiddleware('attachments', 10);
    await uploadMiddleware(req, res);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one attachment file is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Processing attachment files:', req.files.map(f => f.originalname));
    
    // Parse all PDF files
    let combinedContent = '';
    const fileNames = [];
    
    for (const file of req.files) {
      try {
        const pdfData = await pdfParse(file.buffer);
        combinedContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n${pdfData.text}`;
        fileNames.push(file.originalname);
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        combinedContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n[Error: Could not parse this PDF file]`;
        fileNames.push(file.originalname);
      }
    }
    
    // Limit content length for API call
    const maxLength = 15000;
    const limitedContent = combinedContent.length > maxLength ? 
      combinedContent.substring(0, maxLength) + '...' : combinedContent;

    console.log('Analyzing attachment content with OpenAI...');
    
    // Analyze with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Analyze these RFP package documents to identify all items that need to be filled out by the bidder. Look for:
- Questions (anything with a question mark ?)
- Checkboxes ([ ] or ☐)  
- Form fields with colons followed by blank lines or underscores (:______)
- Signature lines
- Date fields
- Any other fields requiring bidder input

**Requirements for Completion**

Organize your findings by document and list each fillable item:

**[Document Name 1]**
• [Question or field description]: [Type of response needed]
• [Question or field description]: [Type of response needed]
• [Question or field description]: [Type of response needed]

**[Document Name 2]**
• [Question or field description]: [Type of response needed]
• [Question or field description]: [Type of response needed]

Use **bold** formatting for document names. Be thorough and specific about what type of response is needed for each field (text, date, signature, checkbox, etc.).

Content: ${limitedContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    res.json({
      success: true,
      analysis: analysis,
      files: fileNames,
      fileCount: req.files.length
    });

  } catch (error) {
    console.error('Error analyzing attachments:', error.message);
    
    if (error.message.includes('API key') || error.message.includes('quota')) {
      res.status(500).json({ 
        error: 'OpenAI API configuration error. Please check your API key and billing.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to analyze the attachments. Please try again later.' 
      });
    }
  }
}