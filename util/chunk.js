const {reader, writer} = require('@mediafish/buffer-operator');

function readMessage(buff, offset, prevMsgHeaders) {
  let messageHeader;
  const chunkType = (buff[offset] >> 6) & 0x03;
  let chunkStreamId = buff[offset] & 0x3F;
  offset += 1;
  // [offset, chunkType] = reader.readBits(buff, offset, 0, 2);
  // [offset, chunkStreamId] = reader.readBits(buff, offset, 2, 6);
  if (chunkStreamId === 0) {
    // Chunk basic header 2: id is encoded in 2 bytes, [64-319]
    [offset, chunkStreamId] = reader.readNumber(buff, offset, 1);
    chunkStreamId += 64;
  } else if (chunkStreamId === 1) {
    // Chunk basic header 3: id is encoded in 3 bytes, [64-65599]
    let second = 0, third = 0;
    [offset, second] = reader.readNumber(buff, offset, 1);
    [offset, third] = reader.readNumber(buff, offset, 1);
    chunkStreamId = third * 256 + second + 64;
  }
  const prevMsgHeader = prevMsgHeaders[chunkStreamId];
  if (chunkType === 0) {
    [offset, messageHeader] = readMsgType0(buff, offset);
  } else if (chunkType === 1) {
    [offset, messageHeader] = readMsgType1(buff, offset, prevMsgHeader);
  } else if (chunkType === 2) {
    [offset, messageHeader] = readMsgType2(buff, offset, prevMsgHeader);
  } else if (chunkType === 3) {
    [offset, messageHeader] = readMsgType3(buff, offset, prevMsgHeader);
  }
  if (!messageHeader) {
    return [offset, null];
  }
  const data = buff.slice(offset, offset + messageHeader.messageLength);
  offset += messageHeader.messageLength;
  return [offset, {basicHeader: {chunkType, chunkStreamId}, messageHeader, data}];
}

function readNumberLSBFirst(buff, offset, length) {
  let value = 0;
  for (let i = 0; i < length; i++) {
    value |= (buff[offset++] << (8 * i));
  }
  return [offset, value];
}

function readMsgType0(buff, offset) {
  let timestamp, messageLength, messageTypeId, messageStreamId;
  [offset, timestamp] = reader.readNumber(buff, offset, 3);
  [offset, messageLength] = reader.readNumber(buff, offset, 3);
  [offset, messageTypeId] = reader.readNumber(buff, offset, 1);
  // [offset, messageStreamId] = reader.readNumber(buff, offset, 4);
  [offset, messageStreamId] = readNumberLSBFirst(buff, offset, 4);
  if (timestamp === 0xFFFFFF) {
    // Read Extended Timestamp
    [offset, timestamp] = reader.readNumber(buff, offset, 4);
  }
  return [offset, {timestamp, delta: 0, messageLength, messageTypeId, messageStreamId}];
}

function readMsgType1(buff, offset, prevMsgHeader) {
  let delta, messageLength, messageTypeId;
  [offset, delta] = reader.readNumber(buff, offset, 3);
  [offset, messageLength] = reader.readNumber(buff, offset, 3);
  [offset, messageTypeId] = reader.readNumber(buff, offset, 1);
  if (delta === 0xFFFFFF) {
    // Read Extended Timestamp
    [offset, delta] = reader.readNumber(buff, offset, 4);
  }
  if (!prevMsgHeader) {
    return [offset, null];
  }
  const timestamp = prevMsgHeader.timestamp + delta;
  const {messageStreamId} = prevMsgHeader;
  return [offset, {timestamp, delta, messageLength, messageTypeId, messageStreamId}];
}

function readMsgType2(buff, offset, prevMsgHeader) {
  let delta;
  [offset, delta] = reader.readNumber(buff, offset, 3);
  if (delta === 0xFFFFFF) {
    // Read Extended Timestamp
    [offset, delta] = reader.readNumber(buff, offset, 4);
  }
  if (!prevMsgHeader) {
    return [offset, null];
  }
  const timestamp = prevMsgHeader.timestamp + delta;
  const {messageLength} = prevMsgHeader;
  const {messageTypeId} = prevMsgHeader;
  const {messageStreamId} = prevMsgHeader;
  return [offset, {timestamp, delta, messageLength, messageTypeId, messageStreamId}];
}

function readMsgType3(buff, offset, prevMsgHeader) {
  if (!prevMsgHeader) {
    return [offset, null];
  }
  const {delta} = prevMsgHeader;
  const timestamp = prevMsgHeader.timestamp + delta;
  const {messageLength} = prevMsgHeader;
  const {messageTypeId} = prevMsgHeader;
  const {messageStreamId} = prevMsgHeader;
  return [offset, {timestamp, delta, messageLength, messageTypeId, messageStreamId}];
}

function writeProtocolMessage(socket, msgHeader, msgData, chunkStreamId = 2) {
  writeMsgType0(socket, {chunkType: 0, chunkStreamId}, msgHeader, msgData);
}

function writeMessage(socket, msgHeader, msgData, prevMsgHeader) {
  let isDelta = false, chunkType = 0;
  const chunkStreamId = 2; // Only Protocol Control Message is handled
  if (msgHeader.timestamp > 0xFFFFFFFF) {
    // Need to wrap around
    msgHeader.timestamp %= 0x100000000;
  } else if (prevMsgHeader) {
    msgHeader.delta = msgHeader.timestamp - prevMsgHeader.timestamp;
    isDelta = true;
  }

  if (isDelta) {
    if (msgHeader.messageStreamId === prevMsgHeader.messageStreamId) {
      chunkType = 1;
    }
    if (msgHeader.messageLength === prevMsgHeader.messageLength) {
      chunkType = 2;
    }
    if (msgHeader.delta === prevMsgHeader.delta) {
      chunkType = 3;
    }
  }

  switch (chunkType) {
    case 0:
      writeMsgType0(socket, {chunkType, chunkStreamId}, msgHeader, msgData);
      break;
    case 1:
      writeMsgType1(socket, {chunkType, chunkStreamId}, msgHeader, msgData);
      break;
    case 2:
      writeMsgType2(socket, {chunkType, chunkStreamId}, msgHeader, msgData);
      break;
    case 3:
    default:
      writeMsgType3(socket, {chunkType, chunkStreamId}, msgHeader, msgData);
  }
}

function writeMsgType0(socket, {chunkType, chunkStreamId}, msgHeader, msgData) {
  let extended = false, bufferLength = 12 + msgHeader.messageLength;
  if (msgHeader.timestamp >= 0xFFFFFF) {
    extended = true;
    bufferLength = 16 + msgHeader.messageLength;
  }
  const buff = Buffer.alloc(bufferLength);
  buff[0] = (chunkType << 6 | chunkStreamId);
  if (extended) {
    writer.writeNumber(0xFFFFFF, buff, 1, 3);
  } else {
    writer.writeNumber(msgHeader.timestamp, buff, 1, 3);
  }
  writer.writeNumber(msgHeader.messageLength, buff, 4, 3);
  writer.writeNumber(msgHeader.messageTypeId, buff, 7, 1);
  writer.writeNumber(msgHeader.messageStreamId, buff, 8, 4);
  if (extended) {
    writer.writeNumber(msgHeader.timestamp, buff, 12, 4);
  }
  msgData.copy(buff, extended ? 16 : 12);
  socket.write(buff);
}

function writeMsgType1(socket, {chunkType, chunkStreamId}, msgHeader, msgData) {
  let extended = false, bufferLength = 8 + msgHeader.messageLength;
  if (msgHeader.delta >= 0xFFFFFF) {
    extended = true;
    bufferLength = 12 + msgHeader.messageLength;
  }
  const buff = Buffer.alloc(bufferLength);
  buff[0] = (chunkType << 6 | chunkStreamId);
  if (extended) {
    writer.writeNumber(0xFFFFFF, buff, 1, 3);
  } else {
    writer.writeNumber(msgHeader.timestamp, buff, 1, 3);
  }
  writer.writeNumber(msgHeader.messageLength, buff, 4, 3);
  writer.writeNumber(msgHeader.messageTypeId, buff, 7, 1);
  if (extended) {
    writer.writeNumber(msgHeader.timestamp, buff, 8, 4);
  }
  msgData.copy(buff, extended ? 12 : 8);
  socket.write(buff);
}

function writeMsgType2(socket, {chunkType, chunkStreamId}, msgHeader, msgData) {
  let extended = false, bufferLength = 4 + msgHeader.messageLength;
  if (msgHeader.delta >= 0xFFFFFF) {
    extended = true;
    bufferLength = 8 + msgHeader.messageLength;
  }
  const buff = Buffer.alloc(bufferLength);
  buff[0] = (chunkType << 6 | chunkStreamId);
  if (extended) {
    writer.writeNumber(0xFFFFFF, buff, 1, 3);
    writer.writeNumber(msgHeader.timestamp, buff, 4, 4);
  } else {
    writer.writeNumber(msgHeader.timestamp, buff, 1, 3);
  }
  msgData.copy(buff, extended ? 8 : 4);
  socket.write(buff);
}

function writeMsgType3(socket, {chunkType, chunkStreamId}, msgHeader, msgData) {
  const buff = Buffer.alloc(msgHeader.messageLength + 1);
  buff[0] = (chunkType << 6 | chunkStreamId);
  msgData.copy(buff, 1);
  socket.write(buff);
}

module.exports = {
  readMessage,
  writeMessage,
  writeProtocolMessage
};
