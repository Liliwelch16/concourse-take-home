# Security Guidelines

## API Key Management

### ✅ DO:
- Store API keys in environment variables only
- Use Vercel's environment variables dashboard for production
- Keep `.env.local` in `.gitignore`
- Use `.env.example` as a template
- Rotate keys regularly
- Set usage limits on API keys

### ❌ DON'T:
- Commit API keys to version control
- Store keys in client-side code
- Share keys in chat/email
- Use production keys in development
- Store keys in plain text files

## Vercel Deployment Security

1. **Environment Variables**: Use Vercel dashboard only
2. **Build Process**: Keys are automatically secured during build
3. **Runtime**: Keys are encrypted in serverless functions
4. **Logs**: API keys are automatically redacted from logs

## Emergency Response

If a key is compromised:
1. Immediately disable the key in the provider dashboard
2. Generate a new key
3. Update Vercel environment variables
4. Redeploy the application
5. Review commit history for any exposed keys

## Monitoring

- Set up usage alerts for API keys
- Monitor unusual API usage patterns
- Review Vercel function logs regularly
- Enable rate limiting where possible