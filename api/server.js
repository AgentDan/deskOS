const path = require('path');
const express = require('express');
const { attachRoutes } = require('./routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'renderer')));
  attachRoutes(app);
  return app;
}

if (require.main === module) {
  createApp().listen(3000, () => {
    console.log('Forma running at http://localhost:3000');
  });
}

module.exports = { createApp };
