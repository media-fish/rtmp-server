function ASSERT(buffer, offset, bytesToRead) {
  if ((buffer.length - offset) < bytesToRead) {
    throw new Error(`Insufficient buffer: buff.length=${buffer.length}, offset=${offset}`);
  }
}

function isNegative(value, bitLength) {
  return Boolean(value & (1 << (bitLength - 1)));
}

function convertToNegative(value, bitLength) {
  const mask = (1 << bitLength) - 1;
  return -((~value & mask) + 1);
}

function readCharacter(buffer, offset) {
  const firstByte = buffer[offset++];

  const decodeMultiBytes = numBytes => {
    const firstByteMask = (1 << (8 - numBytes)) - 1;
    const trailingBytes = numBytes - 1;

    let multiByteChar = firstByte & firstByteMask;

    for (let i = 0; i < trailingBytes; i++) {
      multiByteChar <<= 6;
      multiByteChar |= (buffer[offset++] & 0x3F);
    }
    return multiByteChar;
  };

  let charCode;

  if (!(firstByte & 0x80)) {
    // 1 byte
    charCode = firstByte;
  } else if ((firstByte >>> 5) === 0x06) {
    // 2 byte
    charCode = decodeMultiBytes(2);
  } else if ((firstByte >>> 4) === 0x0E) {
    // 3 byte
    charCode = decodeMultiBytes(3);
  } else if ((firstByte >>> 3) === 0x1E) {
    // 4 byte
    charCode = decodeMultiBytes(4);
  } else if ((firstByte >>> 2) === 0x3E) {
    // 5 byte
    charCode = decodeMultiBytes(5);
  } else if ((firstByte >>> 1) === 0x7E) {
    // 6 byte
    charCode = decodeMultiBytes(6);
  } else {
    console.error('Reader.readCharacter: Invalid char code - ' + firstByte);
    return [offset, null];
  }
  return [offset, charCode ? String.fromCharCode(charCode) : null];
}

function readString(buffer, offset, length = buffer.length - offset, nullTerminated = false) {
  ASSERT(buffer, offset, length);

  const limit = offset + length;
  let ch, str = '';

  while (offset < limit) {
    [offset, ch] = readCharacter(buffer, offset);
    if (!ch && nullTerminated) {
      // Null terminated string.
      break;
    }
    str += ch;
  }
  return [offset, str];
}

function readNumber(buffer, offset, length = 4, signed = false, safeLimit = true) {
  ASSERT(buffer, offset, length);

  let left = 0, right = 0, i, negative, result;

  length = Math.min(length, 8);

  if (length > 4) {
    for (i = length - 4 - 1; i >= 0; i--) {
      left |= (buffer[offset++] << (8 * i));
    }
    left >>>= 0;
    negative = isNegative(left, (length - 4) * 8);
    left *= 4294967296;
    length = 4;
  }

  for (i = length - 1; i >= 0; i--) {
    right |= (buffer[offset++] << (8 * i));
  }
  right >>>= 0;

  result = left + right;

  if (signed) {
    if (negative === undefined) {
      negative = isNegative(result, length * 8);
    }

    if (negative) {
      result = convertToNegative(result, length * 8);
    }
  }

  if (safeLimit) {
    if (result < 0) {
      result = Math.max(result, Number.MIN_SAFE_INTEGER);
    } else {
      result = Math.min(result, Number.MAX_SAFE_INTEGER);
    }
  }

  return [offset, result];
}

function readBits(buffer, byteOffset, bitOffset, bitsToRead) {
  const endOfBuffer = byteOffset + buffer.length;

  let start = bitOffset, num = 0;
  let remainingBits = bitsToRead;
  let len, byte, oddBitsNum = 0;

  while (byteOffset < endOfBuffer && remainingBits) {
    byte = buffer[byteOffset];
    len = Math.min(remainingBits, 8 - start);
    num <<= len;
    oddBitsNum = Math.max(8 - start - len, 0);
    num |= ((byte >>> oddBitsNum) & ((1 << len) - 1));
    remainingBits -= len;
    if (oddBitsNum) {
      break;
    }
    byteOffset++;
    start = 0;
  }
  num >>>= 0;
  return [byteOffset, num, oddBitsNum];
}

module.exports = {
  readString,
  readNumber,
  readBits
};
