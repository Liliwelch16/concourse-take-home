const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLib, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/analyze-rfp', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Fetch website content
    console.log('Fetching website content from:', url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // Parse HTML content
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, header, footer').remove();
    
    // Extract text content
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    
    // Limit content length for API call
    const maxLength = 8000;
    const content = textContent.length > maxLength ? 
      textContent.substring(0, maxLength) + '...' : textContent;

    console.log('Analyzing content with OpenAI...');
    
    // Analyze with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing RFP (Request for Proposal) documents. Extract key information including what services/products are being requested, requirements, due dates, and submission guidelines. Be concise but comprehensive."
        },
        {
          role: "user",
          content: `Please analyze this RFP content and provide a summary that includes:
1. What services/products are being requested
2. Key requirements and qualifications
3. Due date and submission deadline
4. Budget or value (if mentioned)
5. Key contact information
6. Important submission requirements

Content: ${content}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    res.json({
      success: true,
      analysis: analysis,
      url: url
    });

  } catch (error) {
    console.error('Error analyzing RFP:', error.message);
    
    if (error.response?.status === 403 || error.response?.status === 404) {
      res.status(400).json({ 
        error: 'Unable to access the website. The site may be restricted or the URL may be incorrect.' 
      });
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      res.status(400).json({ 
        error: 'Invalid URL or website is not accessible.' 
      });
    } else if (error.message.includes('API key')) {
      res.status(500).json({ 
        error: 'OpenAI API configuration error. Please check your API key.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to analyze the RFP. Please try again later.' 
      });
    }
  }
});

// PDF analysis endpoint
app.post('/api/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('Processing PDF file:', req.file.originalname);
    
    // Parse PDF content
    const pdfData = await pdfParse(req.file.buffer);
    const content = pdfData.text;
    
    // Limit content length for API call
    const maxLength = 12000;
    const limitedContent = content.length > maxLength ? 
      content.substring(0, maxLength) + '...' : content;

    console.log('Analyzing PDF content with OpenAI...');
    
    // Analyze with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Scan these RFP documents from the perspective of someone who is trying to win the bid from the government. Analyze ALL documents together and consolidate findings into three main topics. Do NOT organize by individual document names. Provide a comprehensive analysis formatted with **bold headers** and bullet points:

**Requirements for the Contract**
Consolidate all contract requirements from across all documents:
• [Detailed requirement 1 with specifics on how to meet it]
• [Detailed requirement 2 with specifics on how to meet it]
• [Detailed requirement 3 with specifics on how to meet it]
• [Additional requirements as needed]

**Evaluation Criteria that the Government is Evaluating On**
Consolidate all evaluation criteria from across all documents:
• [Evaluation criterion 1 with scoring/weighting and strategy to excel]
• [Evaluation criterion 2 with scoring/weighting and strategy to excel]
• [Evaluation criterion 3 with scoring/weighting and strategy to excel]
• [Additional criteria as needed]

**Deadlines**
Consolidate all deadlines and important dates from across all documents:
• [Critical deadline 1 with specific date, time, and what's due]
• [Critical deadline 2 with specific date, time, and what's due]
• [Critical deadline 3 with specific date, time, and what's due]
• [Additional deadlines as needed]

Focus on providing strategic insights that will help win this government contract. Synthesize information from all documents into these three consolidated sections.

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
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('Error analyzing PDF:', error.message);
    
    if (error.message.includes('API key') || error.message.includes('quota')) {
      res.status(500).json({ 
        error: 'OpenAI API configuration error. Please check your API key and billing.' 
      });
    } else if (error.message.includes('PDF')) {
      res.status(400).json({ 
        error: 'Invalid PDF file or corrupted document.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to analyze the PDF. Please try again later.' 
      });
    }
  }
});

// Multiple RFP files analysis endpoint (for first uploader)
app.post('/api/analyze-rfp-multiple', upload.array('rfpFiles', 10), async (req, res) => {
  try {
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
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n${pdfData.text}`;
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n[Error: Could not parse this PDF file]`;
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
});

// Multiple attachments analysis endpoint
app.post('/api/analyze-attachments', upload.array('attachments', 10), async (req, res) => {
  try {
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
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n${pdfData.text}`;
        fileNames.push(file.originalname);
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n[Error: Could not parse this PDF file]`;
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
});

// Proposal Generation endpoint using Gemini
app.post('/api/generate-rfp', upload.array('attachments', 10), async (req, res) => {
  try {
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
        allTextContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n${pdfData.text}`;
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        allTextContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n[Error: Could not parse this PDF file]`;
      }
    }

    // Use Gemini to convert to clean text format and fill in fields
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Build form field information for the prompt
    let formFieldInfo = '';
    Object.keys(formFieldResponses).forEach(key => {
      const field = formFieldResponses[key];
      formFieldInfo += `- ${field.originalName}: ${field.value}\n`;
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
});

// Draft RFP Response endpoint
app.post('/api/generate-draft-response', upload.array('rfpFiles', 10), async (req, res) => {
  try {
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
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n${pdfData.text}`;
      } catch (pdfError) {
        console.error(`Error parsing ${file.originalname}:`, pdfError.message);
        combinedContent += `\n\n=== DOCUMENT: ${file.originalname} ===\n[Error: Could not parse this PDF file]`;
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
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend server is running' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
});