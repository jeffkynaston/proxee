const express = require('express');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3030;
const TARGET_URL = 'https://app.stage.goboomtown.com';

// Simple CORS middleware - absolutely permissive
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Basic body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test endpoint to verify the server is working
app.get('/test', (req, res) => {
  console.log('Test endpoint hit!');
  return res.json({ message: 'Proxy server is working!' });
});

// Custom proxy handler for all routes
app.all('*', (req, res) => {
  // Log the request
  console.log(`Proxying ${req.method} ${req.url} to ${TARGET_URL}${req.url}`);
  
  // Skip the /test endpoint
  if (req.url === '/test') {
    return;
  }
  
  // Parse the target URL
  const targetUrl = new URL(req.url, TARGET_URL);
  
  // Setup the proxy request options
  const options = {
    method: req.method,
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.pathname + targetUrl.search,
    headers: {
      ...req.headers,
      host: targetUrl.hostname
    }
  };
  
  // Remove connection header as it's handled by Node.js
  if (options.headers.connection) {
    delete options.headers.connection;
  }
  
  // Create the proxy request
  const proxyReq = https.request(options, (proxyRes) => {
    // Set status code
    res.status(proxyRes.statusCode);
    
    // Copy headers from the proxied response
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Stream the proxied response to the client
    proxyRes.pipe(res);
  });
  
  // Handle errors
  proxyReq.on('error', (error) => {
    console.error('Proxy request error:', error);
    res.status(500).send('Proxy request error');
  });
  
  // If there's a body, send it
  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  } else if (req.readable) {
    // For non-parsed body data like binary uploads
    req.pipe(proxyReq);
    return;
  }
  
  // End the request
  proxyReq.end();
});

// Start the server
app.listen(PORT, () => {
  console.log(`Custom proxy server running on http://localhost:${PORT}`);
  console.log(`Proxying all requests to ${TARGET_URL}`);
  console.log(`Test endpoint available at http://localhost:${PORT}/test`);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Server error occurred');
}); 