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

    console.log('Processing RFP files:', req.files.map(f => f.originalname));
    
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

    console.log('Analyzing RFP content with OpenAI...');
    
    // Analyze with OpenAI using the first uploader format
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `CRITICAL ANALYSIS: Review these RFP documents with the critical lens of a competitive bidder who is determined to win this government contract. You must identify every advantage, risk, and strategic opportunity. Analyze ALL documents together and consolidate findings into three main topics. Do NOT organize by individual document names.

**Requirements for the Contract**
Consolidate all contract requirements from across all documents with a winning strategy focus:
• [Critical requirement 1: What's required + How to exceed expectations + Competitive advantage opportunities]
• [Critical requirement 2: What's required + How to exceed expectations + Competitive advantage opportunities]
• [Critical requirement 3: What's required + How to exceed expectations + Competitive advantage opportunities]
• [Additional requirements with strategic insights]

**Evaluation Criteria that the Government is Evaluating On**
Consolidate all evaluation criteria with scoring intelligence and winning tactics:
• [Evaluation criterion 1: Scoring/weighting + What wins points + How to maximize score + Common competitor weaknesses]
• [Evaluation criterion 2: Scoring/weighting + What wins points + How to maximize score + Common competitor weaknesses]
• [Evaluation criterion 3: Scoring/weighting + What wins points + How to maximize score + Common competitor weaknesses]
• [Additional criteria with tactical insights]

**Deadlines**
Consolidate all critical deadlines with strategic timing considerations:
• [Critical deadline 1: Date/time + What's due + Strategic preparation timeline + Risk mitigation]
• [Critical deadline 2: Date/time + What's due + Strategic preparation timeline + Risk mitigation]
• [Critical deadline 3: Date/time + What's due + Strategic preparation timeline + Risk mitigation]
• [Additional deadlines with strategic timing insights]

WINNING MINDSET: Provide insights that give this bidder a competitive edge. Identify what the government truly values, where competitors typically fail, and how to position for maximum scoring advantage.

RFP Content: ${limitedContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    res.json({
      success: true,
      analysis: analysis,
      files: req.files.map(f => f.originalname),
      fileCount: req.files.length
    });

  } catch (error) {
    console.error('Error analyzing RFP files:', error.message);
    
    if (error.message.includes('API key') || error.message.includes('quota')) {
      res.status(500).json({ 
        error: 'OpenAI API configuration error. Please check your API key and billing.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to analyze the RFP files. Please try again later.' 
      });
    }
  }
}