const express = require('express');
const path = require('path');

const pageRoutes = require('./routes/pagerouting.js');
const logicRoutes = require('./routes/logicrouting.js');
const authRoutes = require('./routes/authroute.js');

const app = express();
const frontEndFolder = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.urlencoded());

app.use(authRoutes);
app.use(logicRoutes);
app.use(pageRoutes);
app.use(express.static(frontEndFolder));

const port = process.env.PORT || 3000;

app.listen(port, () => {
   console.log(`Server running on http://localhost:${port}`);
});