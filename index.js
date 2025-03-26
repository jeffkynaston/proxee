const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3030;

// Cookie storage object to store cookies by client instance ID
const cookieStore = {};

const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://cdn.stage.goboomtown.com', 'https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--5a421e5b.local-credentialless.webcontainer-api.io/', 'https://*.local-credentialless.webcontainer-api.io/', 'https://*.netlify.app', 'https://*.webcontainer-api.io', 'https://credentialless.webcontainer-api.io', 'https://67dc7dba6172ba1110409551--cxme-ui.netlify.app', 'https://*.netlify.app', 'https://cxme-ui.netlify.app', 'https://cxme-ui.netlify.app/'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept', 
    'x-request-id', 
    'x-boomtown-client-instance-id',
    'x-boomtown-csrf-token',
    'Origin',
    'X-Requested-With',
    'Accept-Encoding',
    'Accept-Language',
    'Referer',
    'Connection',
    'User-Agent',
    'Platform-Version'
  ]
};

// Enhanced CORS debug logging middleware
app.use((req, res, next) => {
  console.log('\n--- CORS Debug - Incoming Request ---');
  console.log(`Path: ${req.path}`);
  console.log(`Method: ${req.method}`);
  console.log('Headers:');
  Object.keys(req.headers).forEach(key => {
    console.log(`  ${key}: ${req.headers[key]}`);
  });
  
  // Check if the origin is not in the allowed list
  const origin = req.headers.origin;
  if (origin && !corsOptions.origin.includes(origin) && !isWildcardMatch(origin, corsOptions.origin)) {
    console.log('\n⚠️ CORS WARNING ⚠️');
    console.log(`Origin "${origin}" is not in the allowed list!`);
    console.log('This request will likely fail with a CORS error');
    console.log('Allowed origins:');
    corsOptions.origin.forEach(allowedOrigin => {
      console.log(`  - ${allowedOrigin}`);
    });
    console.log('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️\n');
  }
  
  console.log('-------------------------------\n');
  next();
});

// Helper function to check if an origin matches a wildcard pattern
function isWildcardMatch(origin, allowedOrigins) {
  // Remove trailing slash if present for consistent comparison
  if (origin && origin.endsWith('/')) {
    origin = origin.slice(0, -1);
  }
  
  // Convert to URL to extract domain parts
  try {
    const url = new URL(origin);
    
    // Check each allowed origin for wildcard matches
    return allowedOrigins.some(pattern => {
      // Remove trailing slash if present
      if (pattern && pattern.endsWith('/')) {
        pattern = pattern.slice(0, -1);
      }
      
      if (!pattern.includes('*')) return false;
      
      // Replace the wildcard with a regex pattern
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\*/g, '.*');  // Replace * with .*
        
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(origin);
    });
  } catch (e) {
    return false;
  }
}

// Use the cors middleware
app.use(cors({
  ...corsOptions,
  // Add a custom origin function to better handle wildcards
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list or matches a wildcard
    if (corsOptions.origin.includes(origin) || isWildcardMatch(origin, corsOptions.origin)) {
      return callback(null, true);
    }
    
    // Origin not allowed
    console.log(`CORS Error: Origin ${origin} not allowed`);
    return callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
  }
}));

// Parse JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hello World endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint hit!');
  res.send('Hello World!');
});

// Improved cookie parsing
function parseSetCookieHeader(header) {
  if (!header) return null;
  
  // Extract the cookie name and value (first part before semicolon)
  const firstSemicolon = header.indexOf(';');
  const nameValuePair = firstSemicolon > -1 ? header.substring(0, firstSemicolon) : header;
  const equalsSign = nameValuePair.indexOf('=');
  
  if (equalsSign > -1) {
    const name = nameValuePair.substring(0, equalsSign).trim();
    const value = nameValuePair.substring(equalsSign + 1).trim();
    
    return {
      name: name,
      value: value,
      fullHeader: header // Keep the full header for future use
    };
  }
  
  return null;
}

// Helper function to get stored cookies for a client
function getStoredCookies(clientId) {
  return cookieStore[clientId] || {};
}

// Helper function to update cookie store
function storeCookie(clientId, cookie) {
  if (!clientId || !cookie) return;
  
  if (!cookieStore[clientId]) {
    cookieStore[clientId] = {};
  }
  
  cookieStore[clientId][cookie.name] = cookie;
  console.log(`Stored cookie '${cookie.name}' for client ${clientId}`);
}

// Helper function to build cookie header from stored cookies
function buildCookieHeader(clientId) {
  const cookies = getStoredCookies(clientId);
  return Object.values(cookies)
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

// Forward all other GET requests to https://app.stage.goboomtown.com
app.get('*', async (req, res) => {
  if (req.path === '/') return; // Skip the root path as it's handled above
  
  try {
    // Construct the URL with query parameters
    const url = new URL(`https://app.stage.goboomtown.com${req.path}`);
    
    // Add all query parameters to the URL
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });
    
    const clientId = req.headers['x-boomtown-client-instance-id'];
    console.log(`\n--- Forwarding GET request ---`);
    console.log(`URL: ${url.toString()}`);
    console.log(`Client ID: ${clientId}`);
    
    // Forward the original request headers that might be needed
    const headers = {};
    ['authorization', 'x-request-id', 'x-boomtown-client-instance-id', 'x-boomtown-csrf-token', 'content-type', 'origin', 'referer', 'platform-version'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });
    
    // Add stored cookies for this client if available
    if (clientId && cookieStore[clientId]) {
      const cookieHeader = buildCookieHeader(clientId);
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
    }
    
    // Log the outgoing request headers
    console.log('Outgoing Headers:');
    Object.keys(headers).forEach(key => {
      console.log(`  ${key}: ${headers[key]}`);
    });
    
    // Make the request to the external API
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: headers
    });
    
    // Log the response headers
    console.log('\n--- Response Headers ---');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    console.log('------------------------\n');
    
    // Check if the response includes a Set-Cookie header
    const setCookieHeaders = response.headers.raw ? 
      response.headers.raw()['set-cookie'] : 
      response.headers.get('set-cookie')?.split(',');
      
    if (clientId && setCookieHeaders && setCookieHeaders.length > 0) {
      console.log('Set-Cookie headers found:');
      
      // Forward any Set-Cookie headers back to the client
      // This ensures the client's cookies stay in sync with the API
      setCookieHeaders.forEach(cookieHeader => {
        console.log(`  ${cookieHeader}`);
        res.setHeader('Set-Cookie', cookieHeader);
        
        const cookie = parseSetCookieHeader(cookieHeader);
        if (cookie && cookie.name === 'relay') {
          storeCookie(clientId, cookie);
        }
      });
    }
    
    // Get the response data as JSON
    const data = await response.json();
    
    // Send the API response back to the client
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error forwarding GET request:', error.message);
    console.error(error.stack);
    
    // For network errors or other issues
    res.status(500).json({ 
      error: 'Failed to proxy request',
      message: error.message
    });
  }
});

// Forward all POST requests to https://app.stage.goboomtown.com
app.post('*', async (req, res) => {
  try {
    const url = new URL(`https://app.stage.goboomtown.com${req.path}`);
    
    // Add any query parameters to the URL
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });
    
    const clientId = req.headers['x-boomtown-client-instance-id'];
    console.log(`\n--- Forwarding POST request ---`);
    console.log(`URL: ${url.toString()}`);
    console.log(`Client ID: ${clientId}`);
    
    // Forward the original request headers
    const headers = {};
    ['authorization', 'x-request-id', 'x-boomtown-client-instance-id', 'x-boomtown-csrf-token', 'content-type', 'origin', 'referer', 'platform-version'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });
    
    // Add stored cookies for this client if available
    if (clientId && cookieStore[clientId]) {
      const cookieHeader = buildCookieHeader(clientId);
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
    }
    
    // Log the outgoing request headers
    console.log('Outgoing Headers:');
    Object.keys(headers).forEach(key => {
      console.log(`  ${key}: ${headers[key]}`);
    });
    
    // Make the request to the external API with the same body
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: headers,
      body: createRequestBody(req)
    });
    
    // Log the response headers
    console.log('\n--- Response Headers ---');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    console.log('------------------------\n');
    
    // Check if the response includes a Set-Cookie header
    const setCookieHeaders = response.headers.raw ? 
      response.headers.raw()['set-cookie'] : 
      response.headers.get('set-cookie')?.split(',');
      
    if (clientId && setCookieHeaders && setCookieHeaders.length > 0) {
      console.log('Set-Cookie headers found:');
      
      // Forward any Set-Cookie headers back to the client
      // This ensures the client's cookies stay in sync with the API
      setCookieHeaders.forEach(cookieHeader => {
        console.log(`  ${cookieHeader}`);
        res.setHeader('Set-Cookie', cookieHeader);
        
        const cookie = parseSetCookieHeader(cookieHeader);
        if (cookie && cookie.name === 'relay') {
          storeCookie(clientId, cookie);
        }
      });
    }
    
    // Try to get JSON response, but handle other types too
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      res.status(response.status).json(data);
    } else {
      data = await response.text();
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Error forwarding POST request:', error.message);
    console.error(error.stack);
    
    // For network errors or other issues
    res.status(500).json({ 
      error: 'Failed to proxy POST request',
      message: error.message
    });
  }
});

// Forward all PUT requests to https://app.stage.goboomtown.com
app.put('*', async (req, res) => {
  try {
    const url = new URL(`https://app.stage.goboomtown.com${req.path}`);
    
    // Add any query parameters to the URL
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });
    
    const clientId = req.headers['x-boomtown-client-instance-id'];
    console.log(`\n--- Forwarding PUT request ---`);
    console.log(`URL: ${url.toString()}`);
    console.log(`Client ID: ${clientId}`);
    
    // Forward the original request headers
    const headers = {};
    ['authorization', 'x-request-id', 'x-boomtown-client-instance-id', 'x-boomtown-csrf-token', 'content-type', 'origin', 'referer', 'platform-version'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });
    
    // Add stored cookies for this client if available
    if (clientId && cookieStore[clientId]) {
      const cookieHeader = buildCookieHeader(clientId);
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
    }
    
    // Log the outgoing request headers
    console.log('Outgoing Headers:');
    Object.keys(headers).forEach(key => {
      console.log(`  ${key}: ${headers[key]}`);
    });
    
    // Make the request to the external API with the same body
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: headers,
      body: createRequestBody(req)
    });
    
    // Log the response headers
    console.log('\n--- Response Headers ---');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    console.log('------------------------\n');
    
    // Check if the response includes a Set-Cookie header
    const setCookieHeaders = response.headers.raw ? 
      response.headers.raw()['set-cookie'] : 
      response.headers.get('set-cookie')?.split(',');
      
    if (clientId && setCookieHeaders && setCookieHeaders.length > 0) {
      console.log('Set-Cookie headers found:');
      
      // Forward any Set-Cookie headers back to the client
      // This ensures the client's cookies stay in sync with the API
      setCookieHeaders.forEach(cookieHeader => {
        console.log(`  ${cookieHeader}`);
        res.setHeader('Set-Cookie', cookieHeader);
        
        const cookie = parseSetCookieHeader(cookieHeader);
        if (cookie && cookie.name === 'relay') {
          storeCookie(clientId, cookie);
        }
      });
    }
    
    // Try to get JSON response, but handle other types too
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      res.status(response.status).json(data);
    } else {
      data = await response.text();
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Error forwarding PUT request:', error.message);
    console.error(error.stack);
    
    // For network errors or other issues
    res.status(500).json({ 
      error: 'Failed to proxy PUT request',
      message: error.message
    });
  }
});

// Forward all DELETE requests to https://app.stage.goboomtown.com
app.delete('*', async (req, res) => {
  try {
    const url = new URL(`https://app.stage.goboomtown.com${req.path}`);
    
    // Add any query parameters to the URL
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });
    
    const clientId = req.headers['x-boomtown-client-instance-id'];
    console.log(`\n--- Forwarding DELETE request ---`);
    console.log(`URL: ${url.toString()}`);
    console.log(`Client ID: ${clientId}`);
    
    // Forward the original request headers
    const headers = {};
    ['authorization', 'x-request-id', 'x-boomtown-client-instance-id', 'x-boomtown-csrf-token', 'content-type', 'origin', 'referer', 'platform-version'].forEach(header => {
      if (req.headers[header]) {
        headers[header] = req.headers[header];
      }
    });
    
    // Add stored cookies for this client if available
    if (clientId && cookieStore[clientId]) {
      const cookieHeader = buildCookieHeader(clientId);
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
    }
    
    // Log the outgoing request headers
    console.log('Outgoing Headers:');
    Object.keys(headers).forEach(key => {
      console.log(`  ${key}: ${headers[key]}`);
    });
    
    // Make the request to the external API
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: headers,
      // DELETE requests may or may not have a body
      ...(Object.keys(req.body).length > 0 && { body: createRequestBody(req) })
    });
    
    // Log the response headers
    console.log('\n--- Response Headers ---');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    console.log('------------------------\n');
    
    // Check if the response includes a Set-Cookie header
    const setCookieHeaders = response.headers.raw ? 
      response.headers.raw()['set-cookie'] : 
      response.headers.get('set-cookie')?.split(',');
      
    if (clientId && setCookieHeaders && setCookieHeaders.length > 0) {
      console.log('Set-Cookie headers found:');
      
      // Forward any Set-Cookie headers back to the client
      // This ensures the client's cookies stay in sync with the API
      setCookieHeaders.forEach(cookieHeader => {
        console.log(`  ${cookieHeader}`);
        res.setHeader('Set-Cookie', cookieHeader);
        
        const cookie = parseSetCookieHeader(cookieHeader);
        if (cookie && cookie.name === 'relay') {
          storeCookie(clientId, cookie);
        }
      });
    }
    
    // Try to get JSON response, but handle other types too
    let data;
    // Some DELETE responses might be empty
    if (response.headers.get('content-length') === '0') {
      res.status(response.status).end();
      return;
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      res.status(response.status).json(data);
    } else {
      data = await response.text();
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Error forwarding DELETE request:', error.message);
    console.error(error.stack);
    
    // For network errors or other issues
    res.status(500).json({ 
      error: 'Failed to proxy DELETE request',
      message: error.message
    });
  }
});

// Handle OPTIONS requests directly
app.options('*', (req, res) => {
  console.log('\n--- Handling OPTIONS request directly ---');
  console.log(`Path: ${req.path}`);
  
  // Extract the requested method and headers from the preflight request
  const requestMethod = req.headers['access-control-request-method'];
  const requestHeaders = req.headers['access-control-request-headers'];
  
  console.log(`Requested Method: ${requestMethod}`);
  console.log(`Requested Headers: ${requestHeaders}`);
  
  // Set CORS headers for preflight response
  // Always use the actual origin that made the request
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Always use the exact requested headers
  if (requestHeaders) {
    res.header('Access-Control-Allow-Headers', requestHeaders);
  } else {
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Log response headers
  console.log('\n--- OPTIONS Response Headers ---');
  const headers = res._headers || res.getHeaders();
  Object.keys(headers).forEach(key => {
    console.log(`  ${key}: ${headers[key]}`);
  });
  console.log('----------------------------------\n');
  
  // Send 200 OK for the OPTIONS request
  res.status(200).send();
});

// Helper function to handle different body types
function createRequestBody(req) {
  const contentType = req.headers['content-type'] || '';
  
  // For URL-encoded form data
  if (contentType.includes('application/x-www-form-urlencoded')) {
    // Express has already parsed this into req.body
    // Convert back to URLSearchParams format
    const params = new URLSearchParams();
    Object.keys(req.body).forEach(key => {
      params.append(key, req.body[key]);
    });
    return params;
  }
  
  // For JSON data
  if (contentType.includes('application/json')) {
    // Express has already parsed this into req.body
    // We need to stringify it again for fetch
    return JSON.stringify(req.body);
  }
  
  // For multipart/form-data, this is more complex and would require formdata handling
  // A simple implementation could forward the raw body, but proper handling would need
  // additional libraries like 'multer' for file uploads
  
  // Default case - just return whatever is in the body
  return req.body;
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 