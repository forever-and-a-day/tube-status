var express = require('express');

var ledServerClient = require('../common/led-server-client.js');
var config = require('../common/config.js');
var log = require('../common/log.js');

var app = express();

function setup() {
  app.get('/status', function(req, res) {
    log.verbose('Status requested.');
    ledServerClient.blink(6, [0, 0, 20]);
    res.write('OK\n');
    res.end();
  });

  app.listen(config.ENV.PORT, function() {
    log.verbose('Express app is running at localhost:' + config.ENV.PORT);
  });
}

module.exports.setup = setup;
