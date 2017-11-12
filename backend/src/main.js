const config = require('./node-common').config();
const data = require('./modules/data.js');
const log = require('./node-common').log();
const server = require('./node-common').server();

config.requireKeys('main.js', {
  ENV: {
    UPDATE_INTERVAL_M: 15
  }
});

(() => {
  log.begin();
  server.start();

  setInterval(data.download, config.ENV.UPDATE_INTERVAL_M * 1000 * 60);
  data.download();
})();
