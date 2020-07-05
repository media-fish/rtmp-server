const {Writable, Transform} = require('stream');
const test = require('ava');
const rewire = require('rewire');
const {print} = require('@mediafish/flv');
const {createServer: mockCreateServer} = require('../helper/mock-server');
const MockSocket = require('../helper/mock-socket');

// Mock net.createServer
const MockRTMPServer = rewire("../../server.js");
MockRTMPServer.__set__('createServer', mockCreateServer);
const RTMP = rewire('../..');
RTMP.__set__('RTMPServer', MockRTMPServer);
const {createServer, createSimpleServer} = RTMP;

class Terminator extends Writable {
  constructor() {
    super({objectMode: true});
  }

  _write(chunk, encoding, cb) {
    setImmediate(cb);
  }
}

class Logger extends Transform {
  constructor() {
    super({objectMode: true});
    this.index = 0;
  }

  _transform(obj, _, cb) {
    const {type, timestamp, data} = obj;
    if (type === 'video') {
      console.log(`timestamp: ${timestamp}`);
      print(data);
    } else if (type === 'audio') {
      console.log(`timestamp: ${timestamp}`);
      print(data);
    } else if (type === 'data') {
      console.log(`${timestamp} [Data] ${JSON.stringify(data, null, 4)}`);
    }
    cb(null, obj);
  }
}

function handleConnection(t, connection) {
  console.log(`Incoming connection: path="${connection.path}"`);
  return connection
  .once('abc', factory(t, handleStream))
  .on('error', err => {
    console.error(err.stack);
    t.fail();
    t.end();
  });
}

function handleStream(t, stream) {
  console.log(`Published stream: name="${stream.name}"`);
  return stream
  .pipe(new Logger())
  .on('finish', () => {
    console.log('Finish!');
    t.pass();
    t.end();
  })
  .pipe(new Terminator());
}

function factory(t, func) {
  return param => {
    return func(t, param);
  };
}

test.cb('createServer', t => {
  const {server} = createServer()
  .once('/live', factory(t, handleConnection))
  .on('error', err => {
    console.error(err.stack);
    t.fail();
    t.end();
  });
  const socket = new MockSocket(t);
  server.emit('connection', socket);
});

test.cb('createSimpleServer', t => {
  createSimpleServer('/live')
  .on('__fook__', ({server}) => {
    const socket = new MockSocket(t);
    server.emit('connection', socket);
  })
  .pipe(new Logger())
  .on('finish', () => {
    console.log('Finish!');
    t.pass();
    t.end();
  })
  .on('error', err => {
    console.error(err.stack);
    t.fail();
    t.end();
  })
  .pipe(new Terminator());
});

test.cb('Allow extra bytes', t => {
  const {server} = createServer()
  .once('/live', factory(t, handleConnection))
  .on('error', err => {
    console.error(err.stack);
    t.fail();
    t.end();
  });
  const socket = new MockSocket(t, {extraBytes: true});
  server.emit('connection', socket);
});
