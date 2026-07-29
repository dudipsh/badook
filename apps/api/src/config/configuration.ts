const isProduction = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function warnEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`Warning: ${name} is not set. Related features will be unavailable.`);
  }
  return value || '';
}

export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  openai: {
    apiKey: warnEnv('OPENAI_API_KEY'),
  },
  gemini: {
    apiKey: warnEnv('GEMINI_API_KEY'),
  },
  gcp: {
    projectId: warnEnv('GCP_PROJECT_ID'),
    location: process.env.GCP_LOCATION || 'us-central1',
    tunedModel: warnEnv('VERTEX_TUNED_MODEL'),
  },
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    userEmail: process.env.GMAIL_USER_EMAIL || '',
    redirectUri:
      process.env.GMAIL_REDIRECT_URI ||
      'http://localhost:3001/api/gmail/oauth/callback',
  },
  outlook: {
    clientId: process.env.OUTLOOK_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    tenantId: process.env.OUTLOOK_TENANT_ID || 'common',
    redirectUri:
      process.env.OUTLOOK_REDIRECT_URI ||
      'http://localhost:3001/api/outlook/oauth/callback',
  },
  // Login OAuth — SEPARATE from the email-reading OAuth above.
  // Login requests only openid/email/profile (no mailbox access).
  googleLogin: {
    clientId: process.env.GOOGLE_LOGIN_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_LOGIN_CLIENT_SECRET || '',
    redirectUri:
      process.env.GOOGLE_LOGIN_REDIRECT_URI ||
      'http://localhost:3001/api/auth/oauth/google/callback',
  },
  msLogin: {
    clientId: process.env.MS_LOGIN_CLIENT_ID || '',
    clientSecret: process.env.MS_LOGIN_CLIENT_SECRET || '',
    tenantId: process.env.MS_LOGIN_TENANT_ID || 'common',
    redirectUri:
      process.env.MS_LOGIN_REDIRECT_URI ||
      'http://localhost:3001/api/auth/oauth/microsoft/callback',
  },
  frontendUrl: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0],
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '20', 10),
  },
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'eu-north-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  scanLog: {
    verbose: process.env.SCAN_LOG_VERBOSE !== 'false',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },
  redis: {
    url: process.env.REDIS_URL || '',
  },
  queue: {
    enabled: !!process.env.REDIS_URL,
    ocrConcurrency: parseInt(process.env.OCR_CONCURRENCY || '2', 10),
  },
});
