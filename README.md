# Concourse RFP Builder - Next.js Version

A Next.js application for analyzing RFP (Request for Proposal) documents and generating completed forms with AI assistance.

## Features

- **RFP Document Analysis**: Upload and analyze government RFP documents
- **Form Field Detection**: Automatically detect fillable form fields from attachments
- **AI-Powered Form Completion**: Use OpenAI and Google Gemini to generate completed forms
- **Draft Response Generation**: Create professional RFP responses
- **Serverless Architecture**: Built with Next.js API routes for scalability

## Tech Stack

- **Frontend**: Next.js 14, React 18
- **Backend**: Next.js API Routes (Serverless Functions)
- **AI Integration**: OpenAI GPT-3.5 Turbo, Google Gemini 1.5 Flash
- **File Processing**: PDF parsing with pdf-parse
- **File Uploads**: Multer for handling multipart form data

## Getting Started

### Prerequisites

- Node.js 18 or higher
- OpenAI API key
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## API Endpoints

- `POST /api/analyze-rfp-multiple` - Analyze multiple RFP documents
- `POST /api/analyze-attachments` - Analyze RFP attachments for form fields
- `POST /api/generate-rfp` - Generate completed forms using Gemini AI
- `POST /api/generate-draft-response` - Generate draft RFP responses

## Deployment

This application is ready for deployment on Vercel, Netlify, or any platform that supports Next.js.

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

## Project Structure

```
├── pages/
│   ├── api/           # API routes (serverless functions)
│   ├── _app.js        # Next.js app component
│   ├── _document.js   # Next.js document component
│   └── index.js       # Main application page
├── lib/
│   └── upload.js      # File upload utilities
├── styles/
│   └── globals.css    # Global styles
├── .env.local         # Environment variables
└── next.config.js     # Next.js configuration
```

## Migration Notes

This application was migrated from a React + Express.js architecture to Next.js with serverless API routes:

- **Frontend**: Converted React components to Next.js pages
- **Backend**: Migrated Express routes to Next.js API routes
- **File Uploads**: Adapted Multer for serverless environment
- **Environment**: Moved from Node.js server to serverless functions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.