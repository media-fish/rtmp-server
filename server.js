const EventEmitter = require('events');
const {createServer} = require('net');
const debug = require('debug');
const ConnectionManager = require('./connMgr');

const print = debug('rtmp-server');

class RTMPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.server = null;
    this.connections = new Set();
    this.once('newListener', () => {
      if (this.server) {
        return;
      }
      this.server = createServer(socket => {
        print(`[RTMPServer] Incomming connection: ${socket.remoteAddress}:${socket.remotePort}`);
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
        for (const connection of this.connections) {
          connection.close();
        }
        this.connection.clear();
        console.error(err.stack);
      });
      this.server.listen(this.options.port || 1935, () => {
        const addr = this.server.address();
        print(`Listening on port: ${addr.port}`);
      });
    });
  }
}

module.exports = RTMPServer;
