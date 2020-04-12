const debug = require('debug');
const reader = require('./buffer-reader');
const writer = require('./buffer-writer');
const chunkUtil = require('./chunk');

const print = debug('rtmp-server');
const MAX_MESSAGE_LENGTH = 0xFFFFFF;
const buff = Buffer.alloc(4);
const buff5 = Buffer.alloc(5);
const buff6 = Buffer.alloc(6);

function processMessage(connMgr, chunk) {
  const {messageHeader, data} = chunk;
  const {messageTypeId} = messageHeader;
  let offset = 0, chunkSize = 0, chunkStreamId = 0, sequenceNumber = 0, windowSize = 0, limitType = 0;
  switch (messageTypeId) {
    case 1:
      // Set Chunk Size
      [offset, chunkSize] = reader.readNumber(data, offset, 4);
      if (chunkSize > MAX_MESSAGE_LENGTH) {
        chunkSize = MAX_MESSAGE_LENGTH;
      }
      connMgr.maxChunkSize = chunkSize;
      print(`[Set Chunk Size] Recieved: ${chunkSize} bytes`);
      break;
    case 2:
      // Abort Message
      [offset, chunkStreamId] = reader.readNumber(data, 0, 4);
      connMgr.abortMessage(chunkStreamId);
      print(`[Abort Message] Recieved: chunkStreamId = ${chunkStreamId}`);
      break;
    case 3:
      // Acknowledgement
      [offset, sequenceNumber] = reader.readNumber(data, 0, 4);
      print(`[Acknowledgement] Recieved: sequenceNumber = ${sequenceNumber}`);
      break;
    case 5:
      // Window Acknowledgement Size
      [offset, windowSize] = reader.readNumber(data, 0, 4);
      connMgr.windowSize = windowSize;
      print(`[Window Acknowledgement Size] Recieved: windowSize = ${windowSize}`);
      break;
    case 6:
      // Set Peer Bandwidth
      [offset, windowSize] = reader.readNumber(data, 0, 4);
      [offset, limitType] = reader.readNumber(data, 0, 1);
      // Ignore this message
      print(`[Set Peer Bandwidth] Recieved: windowSize = ${windowSize}, limitType = ${limitType}`);
      break;
    default:
      return new Error(`Unsupported messageTypeId: ${messageTypeId}`);
  }
  return null;
}

function setChunkSize(socket, chunkSize) {
  writer.writeNumber(chunkSize, buff, 0, 4);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: 4,
    messageTypeId: 1,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buff);
  print(`[Set Chunk Size] Sent: chunkSize = ${chunkSize}`);
}

function sendAck(socket, sequenceNumber) {
  writer.writeNumber(sequenceNumber, buff, 0, 4);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: 4,
    messageTypeId: 3,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buff);
  print(`[Acknowledgement] Sent: sequenceNumber = ${sequenceNumber}`);
}

function sendWindowAckSize(socket, windowSize) {
  writer.writeNumber(windowSize, buff, 0, 4);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: 4,
    messageTypeId: 5,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buff);
  print(`[Window Acknowledgement Size] Sent: windowSize = ${windowSize}`);
}

function setPeerBandWidth(socket, windowSize, limitType) {
  writer.writeNumber(windowSize, buff5, 0, 4);
  writer.writeNumber(limitType, buff5, 4, 1);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: 5,
    messageTypeId: 6,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buff5);
  print(`[Set Peer Bandwidth] Sent: windowSize = ${windowSize}, limitType=${limitType}`);
}

function setUserControlMessage(socket, streamId) {
  writer.writeNumber(0, buff6, 0, 2);
  writer.writeNumber(streamId, buff6, 2, 4);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: 6,
    messageTypeId: 99,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buff6);
  print(`[Set User Control Message] Sent: streamId = ${streamId}`);
}

module.exports = {
  processMessage,
  setChunkSize,
  sendAck,
  sendWindowAckSize,
  setPeerBandWidth,
  setUserControlMessage
};
