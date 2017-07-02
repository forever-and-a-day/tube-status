const express = require('express');

const config = require('../common/config');
const log = require('../common/log');

config.requireKeys('server.js', {
  ENV: {
    PORT: 5050
  }
});

const app = express();

function setup() {
  app.get('/status', (req, res) => {
    log.info('Status requested.');
    res.status(200);
    res.send('OK\n');
  });

  app.listen(config.ENV.PORT, () => log.info(`Express app is running on ${config.ENV.PORT}`));
}

module.exports = {
  setup: setup
};
