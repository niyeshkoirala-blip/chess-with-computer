const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const frontEndFolder = path.join(__dirname, '..', 'public');

function sendFrontendPage(res, fileName) {
   const pagePath = path.join(frontEndFolder, fileName);
   fs.readFile(pagePath, 'utf8', (err, html) => {
      if (err) {
         res.status(404).send('Page not found');
         return;
      }

      const authStylesheet = '<link rel="stylesheet" href="auth-widget.css">';
      const authScript = '<script src="auth-widget.js" defer></script>';
      let pageHtml = html;

      if (!pageHtml.includes('auth-widget.css')) {
         pageHtml = pageHtml.replace('</head>', `  ${authStylesheet}\n</head>`);
      }

      if (!pageHtml.includes('auth-widget.js')) {
         pageHtml = pageHtml.replace('</body>', `  ${authScript}\n</body>`);
      }

      res.type('html').send(pageHtml);
   });
}

router.get('/chess.html', (req, res, next) => {
   global.blackcastle = true;
   global.whitecastle = true;
   sendFrontendPage(res, 'chess.html');
});

router.get(['/', '/index.html'], (req, res, next) => {
   sendFrontendPage(res, 'index.html');
});

router.get('/auth-widget.html', (req, res, next) => {
   res.sendFile(path.join(frontEndFolder, 'auth-widget.html'));
});

router.get('/:page.html', (req, res, next) => {
   sendFrontendPage(res, `${req.params.page}.html`);
});

module.exports = router;