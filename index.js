import {Transform} from 'node:stream';
import RTMPServer from './server.js';

export function createServer(options = {}) {
  return new RTMPServer(options);
}

export function createSimpleServer(path, options = {}) {
  const transform = new Transform({objectMode: true});
  transform._transform = function (chunk, enc, cb) {
    this.push(chunk);
    cb();
  };
  const server = createServer(options)
    .once(path, connection => {
      connection.once('*', stream => {
        stream.pipe(transform);
      })
        .on('error', err => {
          transform.emit('error', err);
        });
    })
    .on('error', err => {
      transform.emit('error', err);
    });
  setImmediate(() => {
    transform.emit('__fook__', server);
  });
  return transform;
}
