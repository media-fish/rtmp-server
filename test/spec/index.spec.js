import {Writable, Transform} from 'node:stream';
import test from 'ava';
import esmock from 'esmock';
import {print} from '@mediafish/flv';
import {createServer as mockCreateServer} from '../helper/mock-server.js';
import MockSocket from '../helper/mock-socket.js';

// let createServer = null;
let createSimpleServer = null;

test.before(async () => {
  // Mock net.createServer
  const MockRTMPServer = await esmock.strict('../../server.js', {}, {
    net: {createServer: mockCreateServer},
  });
  // const {createServer: c, createSimpleServer: s} = await esmock('../../index.js', {
  const {createSimpleServer: s} = await esmock('../../index.js', {
    '../../index.js': MockRTMPServer,
  });
  // createServer = c;
  createSimpleServer = s;
});

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

/*
function handleConnection(t, connection) {
  console.log(`Incoming connection: path="${connection.path}"`);
  return connection
    .once('abc', factory(t, handleStream))
    .on('error', err => {
      console.error(err.stack);
      t.fail();
    });
}

function handleStream(t, stream) {
  console.log(`Published stream: name="${stream.name}"`);
  return stream
    .pipe(new Logger())
    .on('finish', () => {
      console.log('Finish!');
      t.pass();
    })
    .pipe(new Terminator());
}

function factory(t, func) {
  return param => func(t, param);
}

test('createServer', async t => {
  await new Promise((_, reject) => {
    const {server} = createServer()
      .once('/live', factory(t, handleConnection))
      .on('error', err => {
        console.error(err.stack);
        t.fail();
        reject();
      });
    const socket = new MockSocket(t);
    server.emit('connection', socket);
  });
});
*/

test('createSimpleServer', async t => {
  await new Promise((resolve, reject) => {
    createSimpleServer('/live')
      .on('__fook__', ({server}) => {
        const socket = new MockSocket(t);
        server.emit('connection', socket);
      })
      .pipe(new Logger())
      .on('finish', () => {
        console.log('Finish!');
        t.pass();
        resolve();
      })
      .on('error', err => {
        console.error(err.stack);
        t.fail();
        reject();
      })
      .pipe(new Terminator());
  });
});

/*
test('Allow extra bytes', async t => {
  await new Promise((_, reject) => {
    const {server} = createServer()
      .once('/live', factory(t, handleConnection))
      .on('error', err => {
        console.error(err.stack);
        t.fail();
        reject();
      });
    const socket = new MockSocket(t, {extraBytes: true});
    server.emit('connection', socket);
  });
});
*/
