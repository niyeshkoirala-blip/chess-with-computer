require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const { connectDatabase } = require('./config/db.js');

const pageRoutes = require('./routes/pagerouting.js');
const logicRoutes = require('./routes/logicrouting.js');
const authRoutes = require('./routes/authroute.js');

const app = express();
const frontEndFolder = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionConfig = {
   name: 'regicide.sid',
   secret: process.env.SESSION_SECRET || 'dev-regicide-secret',
   resave: false,
   saveUninitialized: false,
   cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 1000 * 60 * 60 * 24 * 14,
   },
};

function installRoutes() {
   sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
   });

   app.use(session(sessionConfig));
   app.use(authRoutes);
   app.use(logicRoutes);
   app.use(pageRoutes);
   app.use(express.static(frontEndFolder));

   app.use((err, req, res, next) => {
      const status = err.status || 500;
      console.error(err);
      res.status(status).json({
         error: status === 500 ? 'Server error.' : err.message,
      });
   });
}

const port = process.env.PORT || 3000;

connectDatabase()
   .then(() => {
      installRoutes();
      app.listen(port, () => {
         console.log(`Server running on http://localhost:${port}`);
      });
   })
   .catch(err => {
      console.error('Could not start server:', err.message);
      process.exit(1);
   });
