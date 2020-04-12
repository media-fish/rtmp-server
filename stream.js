const {Readable} = require('stream');
// const debug = require('debug');

// const print = debug('rtmp-server');

class RTMPStream extends Readable {
  constructor(name, streamId) {
    super({objectMode: true});
    this.name = name;
    this.streamId = streamId;
  }

  _read() {
    // Data will be pushed by ConnectionManager
  }
}

module.exports = RTMPStream;
