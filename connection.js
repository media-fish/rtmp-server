import {EventEmitter} from 'node:events';
// import debug from 'debug';

// const print = debug('rtmp-server');

export default class RTMPConnection extends EventEmitter {
  constructor(path) {
    super();
    this.path = path;
  }
}
