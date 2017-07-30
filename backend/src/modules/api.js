const config = require('../common/config');
const log = require('../common/log');
const server = require('../common/server');

function setup() {
  server.start();
}

module.exports = {
  setup: setup
};
