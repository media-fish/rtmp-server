const debug = require('debug');
const {readAllValues} = require('@mediafish/amf0');
const {readAudio, readVideo} = require('@mediafish/flv');
const {Video, Audio, Data} = require('./types');
const handshakeUtil = require('./util/handshake');
const chunkUtil = require('./util/chunk');
const protoCtrlUtil = require('./util/protocol-control');
const commandUtil = require('./util/command');

const print = debug('rtmp-server');

class ConnectionManager {
  constructor(server, socket, maxStreamNum = 1) {
    this.server = server;
    this.socket = socket;
    this.connection = null;
    this.streams = new Map();
    this.path = '';
    this.handshakeState = 'uninitialized';
    this.state = 'unconnected';

    this.timeout = 15; // in seconds
    this.epocTime = new Date().getTime();
    this.prevRecievedMsgHeaders = [];
    this.maxChunkSize = 4096;
    this.windowSize = 5000000;
    this.lastAckSize = 0;
    this.maxStreamNum = maxStreamNum;

    let noMoreProcess = false;

    socket.on('end', () => {
      print('Client disconnected');
      this.close();
      noMoreProcess = true;
    });

    socket.setTimeout(this.timeout * 1000);
    socket.on('timeout', () => {
      print(`Client has been inactive for ${this.timeout} seconds`);
      socket.end();
      this.close();
      noMoreProcess = true;
    });

    socket.on('data', buff => {
      // print(`[ConnectionManager] Enter. buff.length=${buff.length}`);
      let offset = 0, err = null;
      if (this.handshakeState !== 'handshake-done') {
        offset = this.doHandshake(buff, offset);
      }
      if (this.handshakeState === 'handshake-done') {
        // while (offset < buff.length) {
        while (buff.length - offset > 2) {
          // print(`\tbuff.length=${buff.length}, offset=${offset}`);
          [err, offset] = this.processMessage(buff, offset);
          if (noMoreProcess) {
            break;
          }
          if (err) {
            console.error(err.stack);
            break;
          }
          this.sendAckIfNeeded();
        }
      }
      // print(`[ConnectionManager] Exit. Consumed ${offset} bytes in buff.length=${buff.length}`);
    });
  }

  doHandshake(buff, offset) {
    if (this.handshakeState === 'uninitialized') {
      let version;
      if ((buff.length - offset) < 1) {
        return offset;
      }
      [offset, version] = handshakeUtil.readC0(buff, offset);
      if (version < 3) {
        return offset;
      }
      // handshakeUtil.writeS0S1(this.socket, this.epocTime);
      this.handshakeState = 'version-sent';
      return this.doHandshake(buff, offset);
    }
    if (this.handshakeState === 'version-sent') {
      if ((buff.length - offset) < 1536) {
        return offset;
      }
      let params;
      [offset, params] = handshakeUtil.readC1(buff, offset);
      // handshakeUtil.writeS2(this.socket, params);
      handshakeUtil.writeS0S1S2(this.socket, params);
      this.handshakeState = 'ack-sent';
      return this.doHandshake(buff, offset);
    }
    if (this.handshakeState === 'ack-sent') {
      if ((buff.length - offset) < 1536) {
        return offset;
      }
      [offset] = handshakeUtil.readC2(buff, offset);
      this.handshakeState = 'handshake-done';
      print('Handshake done.');
    }
    return offset;
  }

  processMessage(buff, offset) {
    let chunk, err = null, readable = null;
    [offset, chunk] = chunkUtil.readMessage(buff, offset, this.prevRecievedMsgHeaders);
    if (!chunk) {
      return [err, offset];
    }
    const {messageTypeId, timestamp, messageStreamId} = chunk.messageHeader;
    switch (messageTypeId) {
      case 1:
      case 2:
      case 3:
      case 5:
      case 6:
        // Protocol Control Message
        print(`Protocol Control Message: messageTypeId=${messageTypeId}`);
        err = protoCtrlUtil.processMessage(this, chunk);
        break;
      case 4:
        // User Control Message
        print(`User Control Message: messageTypeId=${messageTypeId}`);
        break;
      case 20:
      case 17:
        // Command Message
        print(`Command Message: messageTypeId=${messageTypeId}`);
        err = commandUtil.processMessage(this, chunk);
        break;
      case 18:
      case 15:
        // Data Message
        print(`Data Message: messageTypeId=${messageTypeId}, messageStreamId=${messageStreamId}`);
        readable = this.streams.get(messageStreamId);
        if (readable) {
          readable.push(new Data(timestamp, readAllValues(chunk.data, 0)));
        } else {
          print(`Unknown stream ID: ${messageStreamId}`);
        }

        break;
      case 19:
      case 16:
        // Shared Object Message
        print(`Shared Object Message: messageTypeId=${messageTypeId}, messageStreamId=${messageStreamId}`);
        break;
      case 8:
        // Audio Message
        print(`Audio Message: messageTypeId=${messageTypeId}, messageStreamId=${messageStreamId}`);
        readable = this.streams.get(messageStreamId);
        if (readable) {
          const audioData = chunk.data;
          const [len, aac] = readAudio(audioData, 0, audioData.length);
          print(`\tAAC data (len=${len})`);
          readable.push(new Audio(timestamp, aac));
        } else {
          print(`Unknown stream ID: ${messageStreamId}`);
        }
        break;
      case 9:
        // Video Message
        print(`Video Message: messageTypeId=${messageTypeId}, messageStreamId=${messageStreamId}`);
        readable = this.streams.get(messageStreamId);
        if (readable) {
          const videoData = chunk.data;
          const [len, avc] = readVideo(videoData, 0, videoData.length);
          print(`\tAVC data (len=${len})`);
          readable.push(new Video(timestamp, avc));
        } else {
          print(`Unknown stream ID: ${messageStreamId}`);
        }
        break;
      case 22:
        // Aggregate Message
        print(`Aggregate Message: messageTypeId=${messageTypeId}, messageStreamId=${messageStreamId}`);
        break;
      default:
        print(`Unknown message type ID: ${messageTypeId}`);
    }
    this.prevRecievedMsgHeaders[chunk.basicHeader.chunkStreamId] = chunk.messageHeader;
    return [err, offset];
  }

  get recievedBytes() {
    return this.socket.bytesRead;
  }

  sendAckIfNeeded() {
    if (this.lastAckSize === 0 || this.recievedBytes - this.lastAckSize >= this.windowSize) {
      protoCtrlUtil.sendAck(this.socket, this.recievedBytes);
      this.lastAckSize = this.recievedBytes;
    }
  }

  abortMessage(chunkStreamId) {
    print(`abortMessage: chunkStreamId=${chunkStreamId}`);
  }

  close() {
    this.server = null;
    this.socket.destroy();
    this.socket = null;
    this.connection = null;
    for (const [key, stream] of this.streams) {
      stream.push(null);
      this.streams.delete(key);
    }
    this.streams = new Map();
    this.path = '';
    this.handshakeState = 'uninitialized';
    this.state = 'unconnected';
    this.prevRecievedMsgHeaders = [];
  }
}

module.exports = ConnectionManager;
