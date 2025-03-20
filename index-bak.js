const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = 'https://app.stage.goboomtown.com';

// Configure CORS - more permissive settings
const corsOptions = {
  origin: '*', // Allow any origin
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'], // Allow all headers
  exposedHeaders: ['*'], // Expose all headers
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware before anything else
app.use(cors(corsOptions));

// Handle OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// Add body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Proxy configuration
const proxyOptions = {
  target: TARGET_URL,
  changeOrigin: true,
  cookieDomainRewrite: { '*': '' },
  autoRewrite: true,
  withCredentials: true,
  secure: true,
  followRedirects: true,
  selfHandleResponse: false, // Let the proxy handle the response
  onProxyReq: (proxyReq, req, res) => {
    // Log the request
    console.log(`Proxying ${req.method} ${req.url} to ${TARGET_URL}${req.url}`);
    
    // Forward cookies
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }
    
    // If there's a request body, forward it
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      // Remove existing content-type and content-length as we'll set them again
      proxyReq.removeHeader('Content-Type');
      proxyReq.removeHeader('Content-Length');
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers to the proxied response
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    proxyRes.headers['Access-Control-Allow-Headers'] = '*';
    
    // Handle Set-Cookie headers if present
    const setCookieHeaders = proxyRes.headers['set-cookie'];
    if (setCookieHeaders) {
      // Remove domain restrictions and secure flags for local development
      const modifiedSetCookieHeaders = setCookieHeaders.map(cookie =>
        cookie
          .replace(/Domain=[^;]+;/gi, '')
          .replace(/SameSite=[^;]+;/gi, 'SameSite=None;')
      );
      proxyRes.headers['set-cookie'] = modifiedSetCookieHeaders;
    }
  }
};

// Apply the proxy middleware to all routes
app.use('/', createProxyMiddleware(proxyOptions));

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`Proxying requests to ${TARGET_URL}`);
  console.log(`CORS enabled for all origins`);
}); 