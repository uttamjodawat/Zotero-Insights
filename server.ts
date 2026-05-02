import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const ZOTERO_CONSUMER_KEY = process.env.ZOTERO_CONSUMER_KEY || '';
const ZOTERO_CONSUMER_SECRET = process.env.ZOTERO_CONSUMER_SECRET || '';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const oauth = new OAuth({
  consumer: {
    key: ZOTERO_CONSUMER_KEY,
    secret: ZOTERO_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64');
  },
});

app.set('trust proxy', 1);
app.use(cors({
  origin: APP_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'zotero-insight-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, // App runs over HTTPS in AI Studio
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// OAuth Endpoints
app.get('/api/auth/zotero', async (req, res) => {
  const request_data = {
    url: 'https://www.zotero.org/oauth/request',
    method: 'POST',
    data: { oauth_callback: `${APP_URL}/auth/callback` },
  };

  try {
    const response = await axios.post(request_data.url, null, {
      headers: oauth.toHeader(oauth.authorize(request_data)) as any,
      params: request_data.data
    });

    const urlParams = new URLSearchParams(response.data);
    const oauth_token = urlParams.get('oauth_token');
    const oauth_token_secret = urlParams.get('oauth_token_secret');

    // Store secret in session
    (req.session as any).oauth_token_secret = oauth_token_secret;

    res.json({ url: `https://www.zotero.org/oauth/authorize?oauth_token=${oauth_token}` });
  } catch (error: any) {
    console.error('Zotero Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate Zotero OAuth' });
  }
});

app.get('/auth/callback', async (req, res) => {
  const oauth_token = req.query.oauth_token as string;
  const oauth_verifier = req.query.oauth_verifier as string;
  const oauth_token_secret = (req.session as any).oauth_token_secret;

  const request_data = {
    url: 'https://www.zotero.org/oauth/access',
    method: 'POST',
    data: { oauth_verifier },
  };

  const token = {
    key: oauth_token,
    secret: oauth_token_secret,
  };

  try {
    const response = await axios.post(request_data.url, null, {
      headers: oauth.toHeader(oauth.authorize(request_data, token)) as any,
    });

    const urlParams = new URLSearchParams(response.data);
    const final_token = urlParams.get('oauth_token');
    const final_secret = urlParams.get('oauth_token_secret');
    const username = urlParams.get('username');
    const userID = urlParams.get('userID');

    // In a real app, you'd store these in a database.
    // For this dashboard, we'll send them back to the client via postMessage.
    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              payload: { 
                token: '${final_token}', 
                secret: '${final_secret}',
                username: '${username}',
                userID: '${userID}'
              } 
            }, '*');
            window.close();
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Zotero Callback Error:', error.response?.data || error.message);
    res.status(500).send('OAuth callback failed');
  }
});

// Proxy for Zotero API - Security Enhanced: Credentials moved to headers
app.get('/api/zotero/:type', async (req, res) => {
  const { type } = req.params;
  const { userID, apiKey, libraryType } = req.query as any;
  const token = req.headers['x-zotero-token'] as string;
  const secret = req.headers['x-zotero-secret'] as string;
  
  const libraryPrefix = libraryType === 'group' ? 'groups' : 'users';

  if (!userID) {
    return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
  }

  // Sanitize userID
  if (!/^\d+$/.test(userID)) {
    return res.status(400).json({ error: 'Invalid User ID' });
  }

  // Pass along all query parameters except the ones we handle specially
  const zoteroParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!['userID', 'apiKey', 'libraryType'].includes(key)) {
      zoteroParams.append(key, value as string);
    }
  }
  if (!zoteroParams.has('format')) zoteroParams.append('format', 'json');

  try {
    let zoteroUrl = `https://api.zotero.org/${libraryPrefix}/${userID}/${type}?${zoteroParams.toString()}`;
    
    let response;
    if (apiKey) {
      response = await axios.get(zoteroUrl, {
        headers: {
          'Zotero-API-Key': apiKey,
          'Zotero-API-Version': '3'
        }
      });
    } else if (token && secret) {
      const request_data = { url: zoteroUrl, method: 'GET' };
      const oauth_token_obj = { key: token, secret: secret };
      response = await axios.get(zoteroUrl, {
        headers: {
          ...oauth.toHeader(oauth.authorize(request_data, oauth_token_obj)),
          'Zotero-API-Version': '3'
        } as any,
      });
    } else {
      return res.status(401).json({ error: 'Unauthorized: No credentials provided' });
    }

    const totalResults = response.headers['total-results'] || '0';
    const lastModifiedVersion = response.headers['last-modified-version'] || '0';
    
    res.setHeader('x-total-results', totalResults);
    res.setHeader('x-last-modified-version', lastModifiedVersion);
    res.json(response.data);
  } catch (error: any) {
    console.error(`Zotero API Error (${type}):`, error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch from Zotero' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started at http://localhost:${PORT}`);
  });
}

start();
