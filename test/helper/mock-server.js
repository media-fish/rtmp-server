import {EventEmitter} from 'node:events';
import process from 'node:process';

class MockServer extends EventEmitter {
  constructor(...params) {
    super();
    let connectionListener = null;
    this.options = {};
    this.port = 1935;
    if (params.length === 1 && typeof params[0] === 'function') {
      connectionListener = params[0];
    } else if (params.length === 2 && typeof params[1] === 'function') {
      this.options = params[0];
      connectionListener = params[1];
    }
    if (connectionListener) {
      this.on('connection', connectionListener);
    }
  }

  listen(port, listener) {
    this.port = port;
    process.nextTick(listener);
  }

  address() {
    return {port: this.port, family: 'IPv4', address: '127.0.0.1'};
  }
}

export function createServer(...params) {
  return new MockServer(...params);
}

