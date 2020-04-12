// const debug = require('debug');
const reader = require('./buffer-reader');
const writer = require('./buffer-writer');

// const print = debug('rtmp-server');

function readValue(buffer, offset) {
  let marker = 0;
  [offset, marker] = reader.readNumber(buffer, offset, 1);
  // print(`[AMF0] type=${marker}`);
  switch (marker) {
    case 0x00: // number-marker
      return readNumber(buffer, offset);
    case 0x01: // boolean-marker
      return readBoolean(buffer, offset);
    case 0x02: // string-marker
      return readString(buffer, offset);
    case 0x03: // object-marker
      return readObject(buffer, offset);
    case 0x05: // null-marker
      return readNull(buffer, offset);
    case 0x06: // undefined-marker
      return readUndefined(buffer, offset);
    case 0x08: // ecma-array-marker
      return readEcmaArray(buffer, offset);
    case 0x09: // object-end-marker
      return readObjectEnd(buffer, offset);
    case 0x0C: // long-string-marker
      return readLongString(buffer, offset);
    case 0x04: // movieclip-marker
    case 0x07: // reference-marker
    case 0x0A: // strict-array-marker
    case 0x0B: // date-marker
    case 0x0D: // unsupported-marker
    case 0x0E: // recordset-marker
    case 0x0F: // xml-document-marker
    case 0x10: // typed-object-marker
    default:
      console.error(`[AMF0] Unsupported type: ${marker}`);
  }
  return [offset];
}

function readNumber(buffer, offset) {
  // print(`readNumber(buffer.length=${buffer.length}, offset=${offset})`);
  const value = buffer.readDoubleBE(offset);
  return [offset + 8, value];
}

function readBoolean(buffer, offset) {
  // print(`readBoolean(buffer.length=${buffer.length}, offset=${offset})`);
  let value = 0;
  [offset, value] = reader.readNumber(buffer, offset, 1);
  return [offset, value !== 0];
}

function readString(buffer, offset) {
  // print(`readString(buffer.length=${buffer.length}, offset=${offset})`);
  let length = 0, value = '';
  [offset, length] = reader.readNumber(buffer, offset, 2);
  [offset, value] = reader.readString(buffer, offset, length);
  return [offset, value];
}

function readLongString(buffer, offset) {
  // print(`readLongString(buffer.length=${buffer.length}, offset=${offset})`);
  let length = 0, value = '';
  [offset, length] = reader.readNumber(buffer, offset, 4);
  [offset, value] = reader.readString(buffer, offset, length);
  return [offset, value];
}

function readObject(buffer, offset) {
  // print(`readObject(buffer.length=${buffer.length}, offset=${offset})`);
  const obj = {};
  let property = '', value = null;
  while (true) {
    [offset, property] = readString(buffer, offset);
    if (!property && offset === buffer.length) {
      break;
    }
    if (!property && buffer[offset] !== 0x09) {
      offset--; // Hack for ffmpeg
      continue;
    }
    [offset, value] = readValue(buffer, offset);
    if (!property && !value) {
      break;
    }
    obj[property] = value;
  }
  return [offset, obj];
}

function readNull(buffer, offset) {
  // print(`readNull(buffer.length=${buffer.length}, offset=${offset})`);
  return [offset, null];
}

function readUndefined(buffer, offset) {
  // print(`readUndefined(buffer.length=${buffer.length}, offset=${offset})`);
  return [offset];
}

function readObjectEnd(buffer, offset) {
  // print(`readObjectEnd(buffer.length=${buffer.length}, offset=${offset})`);
  return [offset];
}

function readEcmaArray(buffer, offset) {
  // print(`readEcmaArray(buffer.length=${buffer.length}, offset=${offset})`);
  let obj = null;
  [offset] = reader.readNumber(buffer, offset, 4);
  [offset, obj] = readObject(buffer, offset);
  return [offset, obj];
}

function readAllValues(buffer, offset) {
  const values = [];
  let value;
  while (offset < buffer.length) {
    [offset, value] = readValue(buffer, offset);
    if (value === undefined) {
      continue;
    }
    values.push(value);
  }
  return values;
}

function writeValue(buffer, offset, value) {
  if (value === null) {
    return writeNull(buffer, offset);
  }
  if (value === undefined) {
    return writeUndefined(buffer, offset);
  }
  if (typeof value === 'number') {
    return writeNumber(buffer, offset, value);
  }
  if (typeof value === 'boolean') {
    return writeBoolean(buffer, offset, value);
  }
  if (typeof value === 'string') {
    return writeString(buffer, offset, value);
  }
  if (typeof value === 'object') {
    return writeObject(buffer, offset, value);
  }
  return offset;
}

function writeNumber(buffer, offset, value) {
  // print(`writeNumber(buffer.length=${buffer ? buffer.length : 0}, offset=${offset}, value=${value})`);
  offset = writer.writeNumber(0x00, buffer, offset, 1); // number-marker
  if (buffer) {
    buffer.writeDoubleBE(value, offset);
  }
  return offset + 8;
}

function writeBoolean(buffer, offset, value) {
  // print(`writeBoolean(buffer.length=${buffer ? buffer.length : 0}, offset=${offset}, value=${value})`);
  offset = writer.writeNumber(0x01, buffer, offset, 1); // boolean-marker
  offset = writer.writeNumber(value ? 1 : 0, buffer, offset, 1);
  return offset;
}

function writeString(buffer, offset, str) {
  // print(`writeString(buffer.length=${buffer ? buffer.length : 0}, offset=${offset}, value="${str}")`);
  offset = writer.writeNumber(0x02, buffer, offset, 1); // string-marker
  offset = writer.writeNumber(str.length, buffer, offset, 2);
  offset = writer.writeString(str, buffer, offset, str.length);
  return offset;
}

function writeObject(buffer, offset, obj) {
  // print(`writeObject(buffer.length=${buffer ? buffer.length : 0}, offset=${offset})`);
  offset = writer.writeNumber(0x03, buffer, offset, 1); // object-marker
  for (const [key, value] of Object.entries(obj)) {
    offset = writer.writeNumber(key.length, buffer, offset, 2);
    offset = writer.writeString(key, buffer, offset, key.length);
    offset = writeValue(buffer, offset, value);
  }
  offset = writer.writeNumber(0, buffer, offset, 2);
  offset = writer.writeNumber(0x09, buffer, offset, 1); // object-end-marker
  return offset;
}

function writeNull(buffer, offset) {
  // print(`writeNull(buffer.length=${buffer ? buffer.length : 0}, offset=${offset})`);
  offset = writer.writeNumber(0x05, buffer, offset, 1); // null-marker
  return offset;
}

function writeUndefined(buffer, offset) {
  // print(`writeUndefined(buffer.length=${buffer ? buffer.length : 0}, offset=${offset})`);
  offset = writer.writeNumber(0x06, buffer, offset, 1); // undefined-marker
  return offset;
}

module.exports = {
  readValue,
  readAllValues,
  writeValue
};
