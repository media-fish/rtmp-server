import {Readable} from 'node:stream';
// import debug from 'debug';

// const print = debug('rtmp-server');

export default class RTMPStream extends Readable {
  constructor(name, streamId) {
    super({objectMode: true});
    this.name = name;
    this.streamId = streamId;
  }

  _read() {
    // Data will be pushed by ConnectionManager
  }
}
