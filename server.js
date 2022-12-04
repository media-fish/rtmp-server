import {EventEmitter} from 'node:events';
import {createServer} from 'node:net';
import debug from 'debug';
import ConnectionManager from './connMgr.js';

const print = debug('rtmp-server');

export default class RTMPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.server = null;
    this.connections = new Set();
    this.once('newListener', pathName => {
      if (this.server) {
        const addr = this.server.address();
        return print(`Listening on rtmp://localhost:${addr.port}${pathName}`);
      }
      this.server = createServer(socket => {
        print(`[RTMPServer] Incoming connection: ${socket.remoteAddress}:${socket.remotePort}`);
        const {maxConnectionNum = 1, maxStreamNum} = this.options;
        if (this.connections.size === maxConnectionNum) {
          print(`Max connection count exceeded: ${maxConnectionNum}`);
          return socket.end();
        }
        const connection = new ConnectionManager(this, socket, maxStreamNum);
        this.connections.add(connection);
        socket.on('end', () => {
          this.connections.delete(connection);
        });
      })
        .on('error', err => {
          console.error(err.stack);
          for (const connection of this.connections) {
            connection.close();
          }
          if (this.connection) {
            this.connection.clear();
          }
        });
      this.server.listen(this.options.port || 1935, () => {
        const addr = this.server.address();
        print(`Listening on rtmp://localhost:${addr.port}${pathName}`);
      });
    });
  }
}
