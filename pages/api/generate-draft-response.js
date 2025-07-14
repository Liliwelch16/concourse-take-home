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
    const uploadMiddleware = createUploadMiddleware('rfpFiles', 10);
    await uploadMiddleware(req, res);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'RFP files are required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Generating draft RFP response from files:', req.files.map(f => f.originalname));
    
    // Parse all RFP files
    let combinedContent = '';
    
    for (const file of req.files) {
      try {
        const pdfData = await pdfParse(file.buffer);
        combinedContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n${pdfData.text}`;
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        combinedContent += `\\n\\n=== DOCUMENT: ${file.originalname} ===\\n[Error: Could not parse this PDF file]`;
      }
    }
    
    // Limit content length for API call
    const maxLength = 15000;
    const limitedContent = combinedContent.length > maxLength ? 
      combinedContent.substring(0, maxLength) + '...' : combinedContent;

    console.log('Generating draft response with OpenAI...');
    
    // Generate draft response with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Read through the uploaded RFP documents with a critical eye and in the lens of a bidder to draft an RFP response. Use a professional RFP response template structure with these sections:

**Executive Summary**
Provide a compelling overview of your proposal and why you're the best choice for this contract.

**Company Overview**
Brief description of your company, experience, and qualifications relevant to this RFP.

**Understanding of Requirements**
Demonstrate your understanding of the project requirements and scope of work.

**Proposed Solution**
Detail your approach to meeting the requirements, including methodology, timeline, and deliverables.

**Team and Qualifications**
Highlight your team's experience and qualifications relevant to this project.

**Pricing and Budget**
Provide pricing structure and budget breakdown (use placeholder information if specific pricing isn't available).

**Timeline and Milestones**
Propose a realistic timeline with key milestones and deliverables.

**Risk Management**
Identify potential risks and your mitigation strategies.

**Conclusion**
Summarize why you're the best choice and reinforce your value proposition.

Use the details from the RFP documents to craft relevant, specific content for each section. Be professional, compelling, and demonstrate clear understanding of the requirements.

RFP Content: ${limitedContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const draftResponse = completion.choices[0].message.content;

    res.json({
      success: true,
      draftResponse: draftResponse,
      processedFiles: req.files.map(f => f.originalname)
    });

  } catch (error) {
    console.error('Error generating draft response:', error.message);
    
    if (error.message.includes('API key') || error.message.includes('quota')) {
      res.status(500).json({ 
        error: 'OpenAI API configuration error. Please check your API key and billing.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to generate draft response. Please try again later.' 
      });
    }
  }
}