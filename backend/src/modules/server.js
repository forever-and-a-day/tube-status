const express = require('express');

const config = require('../common/config.js');
const evtDaily = require('../common/evt-daily.js');
const ledServerClient = require('../common/led-server-client.js');
const log = require('../common/log.js');

config.requireKeys('server.js', {
  ENV: {
    PORT: 5050
  }
});

const app = express();

function setup() {
  app.get('/status', (req, res) => {
    log.verbose('Status requested.');
    ledServerClient.blink(6, [0, 0, 20]);
    evtDaily.increment();

    res.write('OK\n');
    res.end();
  });

  app.listen(config.ENV.PORT, () => {
    log.verbose(`Express app is running at localhost:${config.ENV.PORT}`);
  });
}

module.exports = {
  setup: setup
};
