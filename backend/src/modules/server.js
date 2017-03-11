var express = require('express');

var activityServerClient = require('../common/activity_server_client.js');
var config = require('../../config.json');
var log = require('../common/log.js');

var app = express();

function setup() {
  app.get('/status', function(req, res) {
    log.verbose('Status requested.');
    activityServerClient.post();
    res.write('OK\n');
    res.end();
  });

  app.listen(config.ENV.PORT, function() {
    log.verbose('Node app is running at localhost:' + config.ENV.PORT);
  });
}

module.exports.setup = setup;
