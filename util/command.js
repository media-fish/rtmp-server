const debug = require('debug');
const amf0Util = require('./amf0');
const protoCtrlUtil = require('./protocol-control');
const chunkUtil = require('./chunk');
const RTMPConnection = require('../connection');
const RTMPStream = require('../stream');

const print = debug('rtmp-server');

function removeSlash(path) {
  return path.replace(/^\/+/, '').replace(/\/+$/, '');
}

function samePath(a = '', b = '') {
  if (removeSlash(a) === removeSlash(b)) {
    return true;
  }
  return false;
}

function sameStreamName(a = '', b = '') {
  if (a === b || a === '*' || b === '*') {
    return true;
  }
  return false;
}

function getEventName(event, emitter, sameFunc) {
  for (const name of emitter.eventNames()) {
    if (name === 'error') {
      continue;
    }
    if (sameFunc(name, event)) {
      return name;
    }
  }
  return '';
}

function processMessage(connMgr, {data, messageHeader}) {
  // print(`[Command] processMessage(data.length=${data.length}) --- Enter`);
  // print(JSON.stringify(data, null, 4));
  const command = readCommand(data);
  print(`[Command] Received: ${JSON.stringify(command, null, 4)}`);

  if (command.name === 'connect') {
    return processConnect(connMgr, command);
  }
  if (command.name === 'createStream') {
    return processCreateStream(connMgr, command);
  }
  if (command.name === 'publish') {
    return processPublish(connMgr, command, messageHeader);
  }
  return null;
}

function processConnect(connMgr, {data, transactionId}) {
  const {server, socket, windowSize, maxChunkSize} = connMgr;
  // print(`\tconnect`);
  const event = getEventName(data.app, server, samePath);
  if (!event) {
    sendResponse(socket, '_error', transactionId, [
      null,
      {
        level: 'error',
        code: 'NetConnection.Connect.Failed',
        description: 'Connection failed.'
      }
    ]);
    return new Error(`Unsupported path: "${data.app}"`);
  }

  protoCtrlUtil.sendWindowAckSize(socket, windowSize);
  protoCtrlUtil.setPeerBandWidth(socket, windowSize, 2);
  protoCtrlUtil.setChunkSize(socket, maxChunkSize);
  /*
  protoCtrlUtil.setUserControlMessage(socket, 9999, 1);
  */
  sendResponse(socket, '_result', transactionId, [
    {
      fmsVer: 'FMS/3,0,1,123',
      capabilities: 31
    },
    {
      level: 'status',
      code: 'NetConnection.Connect.Success',
      description: 'Connection succeeded.',
      objectEncoding: 0 // AMF0
    }
  ]);
  connMgr.connection = new RTMPConnection(event);
  connMgr.state = 'connected';
  server.emit(event, connMgr.connection);
  print(`RTMPConnection object is created. path=${event}`);
  return null;
}

function processCreateStream(connMgr, {transactionId}) {
  const {socket, streams, maxStreamNum} = connMgr;
  if (streams.size === maxStreamNum) {
    sendResponse(socket, '_error', transactionId);
    return new Error(`Max stream count exceeded: ${maxStreamNum}`);
  }
  // print(`\tcreateStream`);
  sendResponse(socket, '_result', transactionId, [null, streams.size + 1]);
  return null;
}

function processPublish(connMgr, {data}, {messageStreamId}) {
  const {connection, streams, socket} = connMgr;
  const {publishingName, publishingType} = data;
  let err = null;
  // print(`\tconnect`);
  if (publishingType !== 'live') {
    err = new Error(`Unsupported stream type: "${publishingType}"`);
    sendResponse(socket, 'onStatus', 0, createOnStatusResponse(err));
    return err;
  }
  const event = getEventName(publishingName, connection, sameStreamName);
  if (!event) {
    err = new Error(`Unsupported stream name: "${publishingName}"`);
    sendResponse(socket, 'onStatus', 0, createOnStatusResponse(err));
    return err;
  }

  sendResponse(socket, 'onStatus', 0, createOnStatusResponse(err));
  const stream = new RTMPStream(event, messageStreamId);
  streams.set(messageStreamId, stream);
  connMgr.state = 'publishing';
  connection.emit(event, stream);
  print(`RTMPStream object is created. name=${event}, id=${messageStreamId}`);
  return err;
}

function createOnStatusResponse(err) {
  const infoObj = err ? {
    level: 'error',
    code: 'NetStream.Publish.Failed',
    description: 'Unable to start publishing'
  } : {
    level: 'status',
    code: 'NetStream.Publish.Start',
    description: 'Start publishing',
    audioCodecs: 0x0400, // SUPPORT_SND_AAC
    videoCodecs: 0x0080 // SUPPORT_VID_H264
  };
  return [null, infoObj];
}

function readCommand(data) {
  // print(`[Command] readCommand(data.length=${data.length}) --- Enter`);
  let offset = 0, name = '', transactionId = 0, command = null, publishingName = '', publishingType = '';
  [offset, name] = amf0Util.readValue(data, offset);
  [offset, transactionId] = amf0Util.readValue(data, offset);
  // print(`[Command] readCommand: name="${name}", transaction ID=${transactionId}`);
  switch (name) {
    case 'connect':
    case 'createStream':
      [offset, command] = amf0Util.readValue(data, offset);
      break;
    case 'releaseStream':
    case 'FCPublish':
      [offset] = amf0Util.readValue(data, offset);
      [offset, command] = amf0Util.readValue(data, offset);
      break;
    case 'publish':
      [offset] = amf0Util.readValue(data, offset); // Null Object
      [offset, publishingName] = amf0Util.readValue(data, offset);
      [offset, publishingType] = amf0Util.readValue(data, offset);
      command = {publishingName, publishingType};
      break;
    default:
      command = null;
  }
  // Skip to the end
  while (offset < data.length) {
    [offset] = amf0Util.readValue(data, offset);
  }
  // print(`[Command] readCommand() --- Exit`);
  return {name, transactionId, data: command};
}

function sendResponse(socket, name, transactionId, params) {
  const response = {
    name,
    transactionId,
    params
  };
  const len = writeResponse(null, 0, response);
  const buff = Buffer.alloc(len);
  writeResponse(buff, 0, response);
  writeMessage(buff, socket);
  print(`[Command] Response: ${JSON.stringify(response, null, 4)}`);
}

function writeResponse(buffer, offset, {name, transactionId, params}) {
  offset = amf0Util.writeValue(buffer, offset, name);
  offset = amf0Util.writeValue(buffer, offset, transactionId);
  if (params) {
    for (const param of params) {
      offset = amf0Util.writeValue(buffer, offset, param);
    }
  } else {
    offset = amf0Util.writeValue(buffer, offset, null);
  }
  return offset;
}

function writeMessage(buffer, socket) {
  // print(`[Command] writeMessage(buffer.length=${buffer.length})`);
  const msgHeader = {
    timestamp: 0,
    delta: 0,
    messageLength: buffer.length,
    messageTypeId: 20,
    messageStreamId: 0
  };
  chunkUtil.writeProtocolMessage(socket, msgHeader, buffer, 3);
}

module.exports = {
  processMessage
};
