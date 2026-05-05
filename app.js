const { movecheck } = require('./movecheck');
const http = require('http');
const fs = require('fs');
const path = require('path');
let islegal;

const mimeTypes = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
};

const server = http.createServer((req, res) => {
  // Map "/" to your HTML file, otherwise use the URL as the filename
  if (req.url === '/move' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {

        body += chunk.toString();
      });
      req.on('end', () => {
        const moveData = JSON.parse(body);
        const movecheckResult = movecheck(moveData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
             
        res.end(JSON.stringify({
          status: 'Move received',
          islegal: movecheckResult.islegal,
          state: movecheckResult.state,
          eatenpeices: movecheckResult.eatenpeices,
          eatencolor: movecheckResult.eatencolor
     
        }));
      });
    }
    else {
  const filePath = req.url === '/'
    ? path.join(__dirname, '/front end', 'chess.html')
    : path.join(__dirname, '/front end',req.url);


  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
    
  });
}  
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

 
