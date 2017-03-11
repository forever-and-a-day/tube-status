var config = require('./common/config.js');
var data = require('./modules/data.js');
var log = require('./common/log.js');
var server = require('./modules/server.js');

(function main() {
  log.verbose('===== Tube Status Backend =====');
  server.setup();

  setInterval(data.download, config.ENV.UPDATE_INTERVAL_MS);
  data.download();
})();
