const {Duplex} = require('stream');
const {req, res} = require('../fixture/messages');

class MockSocket extends Duplex {
  constructor(t, options) {
    super(options);
    this.t = t;
    this.state = 'uninitialized';
  }

  setTimeout() {
    // Nop.
  }

  _read() {
    // console.log(`MockSocket._read()`);
    if (this.state === 'uninitialized') {
      this.push(req.S0S1S2);
      this.state = 'handshake-sent';
      return;
    }
    if (this.state === 'params-sent') {
      this.push(req.AUDIO);
      this.state = 'audio-sent';
      return;
    }
    if (this.state === 'audio-sent') {
      this.push(req.VIDEO);
      this.state = 'video-sent';
      return;
    }
    if (this.state === 'video-sent') {
      this.push(null);
      this.state = 'finished';
    }
    // console.log(`State: ${this.state}`);
  }

  _write(chunk, encoding, cb) {
    const {t} = this;
    // console.log(`MockSocket._write()`);
    if (this.state === 'handshake-sent') {
      t.true(chunk.equals(res.S0S1S2));
      return setImmediate(() => {
        this.push(req.CHUNKSIZE);
        this.push(req.CONNECT);
        this.state = 'connect-sent';
        cb();
      });
    }
    if (this.state === 'connect-sent') {
      if (chunk.length !== res.CONNECT.length) {
        // console.log(JSON.stringify(chunk, null, 4));
        return setImmediate(cb);
      }
      t.true(chunk.equals(res.CONNECT));
      return setImmediate(() => {
        this.push(req.STREAM);
        this.state = 'create-stream-sent';
        cb();
      });
    }
    if (this.state === 'create-stream-sent') {
      t.true(chunk.equals(res.STREAM));
      return setImmediate(() => {
        this.push(req.PUBLISH);
        this.state = 'publish-sent';
        cb();
      });
    }
    if (this.state === 'publish-sent') {
      t.true(chunk.equals(res.PUBLISH));
      return setImmediate(() => {
        this.push(req.PARAMS);
        this.state = 'params-sent';
        cb();
      });
    }
    // console.log(`State: ${this.state}`);
    return setImmediate(cb);
  }
}

module.exports = MockSocket;
