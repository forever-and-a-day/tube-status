const request = require('request');
const timeline = require('pebble-timeline-js-node');

const config = require('../common/config.js');
const log = require('../common/log.js');
const plural = require('../common/plural.js');

config.requireKeys('data.js', {
  ENV: {
    API_KEY_PROD: '',
    API_KEY_SANDBOX: '',
    PUSH_TO_PRODUCTION: true
  }
});

const TOPIC_PINS = 'delays';
const TOPIC_NOTIFS = 'notifs';
const PIN_ID = 'tube-status-delays';  // We only ever need one pin!
const STATE_GOOD_SERVICE = 'Good Service';  // TFL string

var gCacheFirst = true;  // Don't send pins when the server is launched
var gLastStates = [];    // Array of objects describing current line state
var gLastPinBody = '';

// Class
var Line = function(name, state) {
  this.name = name;
  this.state = state;
  this.toString = () => `Line[${this.name}|${this.state}]`;
}

function pushPin(pin, body) {
  log.verbose(`Pushing new pin:\n${JSON.stringify(pin)}\n\n`);

  // Pins only channel
  if(config.ENV.PUSH_TO_PRODUCTION) {
    timeline.insertSharedPin(pin, [TOPIC_PINS], config.ENV.API_KEY_PROD, (responseText) => {
      log.verbose(`Production pin push result: ${responseText}`);
    });
  }
  timeline.insertSharedPin(pin, [TOPIC_PINS], config.ENV.API_KEY_SANDBOX, (responseText) => {
    log.verbose(`Sandbox pin push result: ${responseText}`);
  });

  plural.post('tube_status__latest', `${pin.layout.title} - ${pin.layout.body}`);

  // Notifs channel
  pin.updateNotification = {
    time: new Date().toISOString(),
    layout: {
      type: 'genericNotification',
      title: 'Tube Delay Update',
      tinyIcon: 'system://images/GENERIC_WARNING',
      body: body,
      foregroundColor: '#FFFFFF',
      backgroundColor: '#0000AA'
    }
  };
  log.verbose(`Pushing new notif pin:\n${JSON.stringify(pin)}\n\n`);
  
  if(config.ENV.PUSH_TO_PRODUCTION) {
    timeline.insertSharedPin(pin, [TOPIC_NOTIFS], config.ENV.API_KEY_PROD, (responseText) => {
      log.verbose(`Production pin push result: ${responseText}`);
    });
  }
  timeline.insertSharedPin(pin, [TOPIC_NOTIFS], config.ENV.API_KEY_SANDBOX, (responseText) => {
    log.verbose(`Sandbox pin push result: ${responseText}`);
  });
}

function allClear(newLines) {
  return !newLines.find((line) => {
    return line.state !== STATE_GOOD_SERVICE;
  });
}

function processNewDelays(lines) {
  if(lines.length != gLastStates.length) {
    log.verbose('Error: Cannot compare lines, lengths are unequal.');
    return;
  }

  var body = '';
  for(var i = 0; i < lines.length; i++) {
    if(lines[i].name != gLastStates[i].name) {
      log.verbose('Error: Cannot compare lines, lists are not in sync.');  // Should never happen
      return;
    }

    if(lines[i].state != STATE_GOOD_SERVICE) {
      // The updated state is a delay
      body += `${lines[i].name}: ${lines[i].state}\n`;
    
      if(lines[i].state != gLastStates[i].state) {
        gLastStates[i].state = lines[i].state;
        log.verbose(`Stored new line state: ${lines[i].toString()}`);
      }
    }
  }     

  var now = new Date();
  if(body.length != gLastPinBody.length) {
    // Something changed
    if(allClear(lines)) {
      log.verbose('No delays anymore, pushing all clear.');
      body = 'All delays resolved.';

      // Store all-clear body
      gLastPinBody = '';

      pushPin({
        id: PIN_ID,
        time: now.toISOString(),
        layout: {
          type: 'genericPin',
          tinyIcon: 'system://images/NOTIFICATION_FLAG',
          title: 'No Delays!',
          body: 'Good service on all lines.',
          foregroundColor: '#FFFFFF',
          backgroundColor: '#0000AA'
        }
      }, body);
    } else {
      // New delays
      log.debug(`Delays are: ${body}`);

      // Store new body
      gLastPinBody = body;

      // Post a single pin update for new delays
      pushPin({
        id: PIN_ID,
        time: now.toISOString(),
        layout: {
          type: 'genericPin',
          tinyIcon: 'system://images/GENERIC_WARNING',
          title: 'Some Delays',
          body: body,
          foregroundColor: '#FFFFFF',
          backgroundColor: '#0000AA'
        }
      }, body);
    }
  } else {
    // New delay body is the same as before, nothing changed
    log.verbose('No change in status.');
  }
}

function download() {
  request('https://api.tfl.gov.uk/line/mode/tube/status', (err, response, body) => {
    log.debug('Download from unified API complete!');

    if(body.includes('DOCTYPE')) {
      // HTML bad status page
      log.error('API may be down, ignoring response:');
      log.error(body);
      return;
    }

    const json = JSON.parse(body);
    const lines = [];
    for(var i = 0; i < json.length; i++) {
      lines[i] = new Line(json[i].name, json[i].lineStatuses[0].statusSeverityDescription);
      gLastStates[i] = new Line(lines[i].name, lines[i].state);
    
      if(gCacheFirst) log.verbose(`Initial line state: ${lines[i].toString()}`);
    }

    if(gCacheFirst) {
      gCacheFirst = false;
      log.verbose('Got first line states.');
      return;
    }

    processNewDelays(lines);  // Compare to find new delays
  });
}

module.exports = {
  download: download
};
