const express = require('express');
const path = require('path');

/**
 * Creates a static file server for production mode
 * This is an optional feature that can help if file:// protocol has issues
 */
function createStaticServer(distPath, port = 3000) {
  const app = express();
  
  // Serve static files from the dist directory
  app.use(express.static(distPath));
  
  // For any request that doesn't match a static file, serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  // Start the server
  const server = app.listen(port, () => {
    console.log(`Static server running at http://localhost:${port}`);
  });
  
  return {
    url: `http://localhost:${port}`,
    close: () => server.close()
  };
}

module.exports = { createStaticServer };