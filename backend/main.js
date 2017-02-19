var express = require('express');
var request = require('request');
var timeline = require('pebble-timeline-js-node');
var config = require('./config.json');

/*********************************** Config ***********************************/

var DEBUG = false;  // More logging
var PUSH_TO_PRODUCTION = true;
var INTERVAL_MINS = 5;  // Update interval
var INTERVAL = INTERVAL_MINS * 1000 /* seconds */ * 60 /* minutes */;
var CACHE_FIRST = true;  // Don't send pins when the server is launched
var TOPIC_PINS = 'delays';
var TOPIC_NOTIFS = 'notifs';
var PIN_ID = 'tube-status-delays';  // We only ever need one pin!
var STATE_GOOD_SERVICE = 'Good Service';  // TFL string

/************************************* Data ***********************************/

var gCurrentState = [];  // Array of objects describing current line state
var lastBody = '';

var Line = function(name, state) {
  this.name = name;
  this.state = state;
  this.toString = function() {
    return 'Line[' + this.name + '|' + this.state + ']';
  }
}

/************************************ Util ************************************/

function always(message) {
  var dateString = new Date().toString();
  dateString = dateString.substring(0, dateString.indexOf('GMT') - 1);
  console.log('[' + dateString + ']: ' + message);
}

function debug(message) {
  if(DEBUG) always(message);
}

/******************************** Feed parsing ********************************/

function pushPin(pin, body) {
  always('Pushing new pin:\n' + JSON.stringify(pin) + '\n\n');

  // Pins only channel
  if(PUSH_TO_PRODUCTION) {
    timeline.insertSharedPin(pin, [TOPIC_PINS], config.API_KEY_PROD, function(responseText) {
      always('Production pin push result: ' + responseText);
    });
  }
  timeline.insertSharedPin(pin, [TOPIC_PINS], config.API_KEY_SANDBOX, function(responseText) {
    always('Sandbox pin push result: ' + responseText);
  });

  // Notifs channel
  pin['updateNotification'] = {
    'time': new Date().toISOString(),
    'layout': {
      'type': 'genericNotification',
      'title': 'Tube Delay Update',
      'tinyIcon': 'system://images/GENERIC_WARNING',
      'body': body,
      'foregroundColor': '#FFFFFF',
      'backgroundColor': '#0000AA'
    }
  }
  always('Pushing new notif pin:\n' + JSON.stringify(pin) + '\n\n');
  
  if(PUSH_TO_PRODUCTION) {
    timeline.insertSharedPin(pin, [TOPIC_NOTIFS], config.API_KEY_PROD, function(responseText) {
      always('Production pin push result: ' + responseText);
    });
  }
  timeline.insertSharedPin(pin, [TOPIC_NOTIFS], config.API_KEY_SANDBOX, function(responseText) {
    always('Sandbox pin push result: ' + responseText);
  });
}

var allClear = function(newLines) {
  for(var i = 0; i < newLines.length; i++) {
    if(newLines[i].state !== STATE_GOOD_SERVICE) {
      return false;
    }
  }
  return true;
}

function processNewDelays(lines) {
  if(lines.length != gCurrentState.length) {
    always('Error: Cannot compare lines, lengths are unequal.');
    return;
  }

  var body = '';
  for(var i = 0; i < lines.length; i++) {
    if(lines[i].name != gCurrentState[i].name) {
      always('Error: ' + 'Cannot compare lines, lists are not in sync.');  // Should never happen
      return;
    }

    if(lines[i].state != STATE_GOOD_SERVICE) {
      // The updated state is a delay
      body += '' + lines[i].name + ': ' + lines[i].state + '\n';
    
      if(lines[i].state != gCurrentState[i].state) {
        // Store updated state
        gCurrentState[i].state = lines[i].state;
        always('Stored new line state: ' + lines[i].toString());
      }
    }
  }     

  var now = new Date();
  if(body.length != lastBody.length) {
    // Something changed
    if(allClear(lines)) {
      always('No delays anymore, pushing all clear.');
      body = 'All delays resolved.';

      // Store all-clear body
      lastBody = '';

      pushPin({
        'id': PIN_ID,
        'time': now.toISOString(),
        'layout': {
          'type': 'genericPin',
          'tinyIcon': 'system://images/NOTIFICATION_FLAG',
          'title': 'No Delays!',
          'body': 'Good service on all lines.',
          'foregroundColor': '#FFFFFF',
          'backgroundColor': '#0000AA'
        }
      }, body);
    } else {
      // New delays
      debug('Delays are: ' + body);

      // Store new body
      lastBody = body;

      // Post a single pin update for new delays
      pushPin({
        'id': PIN_ID,
        'time': now.toISOString(),
        'layout': {
          'type': 'genericPin',
          'tinyIcon': 'system://images/GENERIC_WARNING',
          'title': 'Some Delays',
          'body': body,
          'foregroundColor': '#FFFFFF',
          'backgroundColor': '#0000AA'
        }
      }, body);
    }
  } else {
    // New delay body is the same as before, nothing changed
    always('No change in status.');
  }
}

function download() {
  request('https://api.tfl.gov.uk/line/mode/tube/status', function(err, response, body) {
    debug('Download from unified API complete!');
    debug(body);

    if(body.indexOf('DOCTYPE') >= 0) {
      // HTML bad status page
      console.log('API may be down, ignoring response:');
      console.log(body);
      return;
    }

    var json = JSON.parse(body);
    var lines = [];
    for(var i = 0; i < json.length; i++) {
      lines[i] = new Line(
        json[i].name,
        json[i].lineStatuses[0].statusSeverityDescription
      );
      gCurrentState[i] = new Line(lines[i].name, lines[i].state);
    
      if(CACHE_FIRST) {
        always('Initial line state: ' + lines[i].toString());
      }
    }

    if(CACHE_FIRST) {
      CACHE_FIRST = false;
      always('Got first line states.');
      return;
    }

    processNewDelays(lines);  // Compare to find new delays
  });
}

/******************************** Express *************************************/

var app = express();

app.set('port', config.PORT);
app.use(express.static(__dirname + '/public'));

app.get('/status', function(req, res) {
  // Status query
  always('Status requested.');

  res.setHeader('Content-Type', 'text/html');
  res.write('OK\n');
  res.end();
});

app.listen(app.get('port'), function() {
  always('Node app is running at localhost:' + app.get('port'));

  setInterval(function() {
    download();
  }, INTERVAL);
  download();
});
