const EventEmitter = require('events');
// const debug = require('debug');

// const print = debug('rtmp-server');

class RTMPConnection extends EventEmitter {
  constructor(path) {
    super();
    this.path = path;
  }
}

module.exports = RTMPConnection;
