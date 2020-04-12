function writeByte(byte, buffer, offset, mask = 0xFF, or = false) {
  if (buffer) {
    if (or) {
      buffer[offset] |= (byte & mask);
    } else {
      buffer[offset] = byte & mask;
    }
  }
}

function writeCharacter(charCode, buffer, offset) {
  let base = offset;

  if (charCode < 0x80) {
    // 1 byte
    writeByte(charCode, buffer, base++);
  } else if (charCode >= 0x80 && charCode < 0x800) {
    // 2 bytes
    writeByte(0xC0 | ((charCode >> 6) & 0x1F), buffer, base++);
    writeByte(0x80 | ((charCode >> 0) & 0x3F), buffer, base++);
  } else if (charCode >= 0x800 && charCode < 0x10000) {
    // 3 bytes
    writeByte(0xE0 | ((charCode >> 12) & 0x0F), buffer, base++);
    writeByte(0x80 | ((charCode >> 6) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 0) & 0x3F), buffer, base++);
  } else if (charCode >= 0x10000 && charCode < 0x200000) {
    // 4 bytes
    writeByte(0xF0 | ((charCode >> 18) & 0x07), buffer, base++);
    writeByte(0x80 | ((charCode >> 12) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 6) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 0) & 0x3F), buffer, base++);
  } else if (charCode >= 0x200000 && charCode < 0x4000000) {
    // 5 bytes
    writeByte(0xF8 | ((charCode >> 24) & 0x03), buffer, base++);
    writeByte(0x80 | ((charCode >> 18) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 12) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 6) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 0) & 0x3F), buffer, base++);
  } else if (charCode >= 0x4000000 && charCode < 0x80000000) {
    // 6 bytes
    writeByte(0xFC | ((charCode >> 30) & 0x01), buffer, base++);
    writeByte(0x80 | ((charCode >> 24) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 18) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 12) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 6) & 0x3F), buffer, base++);
    writeByte(0x80 | ((charCode >> 0) & 0x3F), buffer, base++);
  } else {
    console.error('Writer.writeCharacter: Invalid char code - ' + charCode);
  }
  return base;
}

function writeString(str, buffer, offset, length) {
  const lowerLimit = offset + (length || 0);
  const upperLimit = offset + (length || Infinity);
  const nullTerminationNeeded = (length === undefined);

  let base = offset;

  for (let i = 0, il = str.length; i < il; i++) {
    base = writeCharacter(str.charCodeAt(i), buffer, base);
    if (base > upperLimit) {
      base = upperLimit;
      break;
    }
  }

  // padding
  while (base < lowerLimit) {
    writeByte(0, buffer, base++);
  }

  if (nullTerminationNeeded) {
    writeByte(0, buffer, base++);
  }
  return base;
}

function writeNumber(num, buffer, offset, length = 4) {
  const left = num / 4294967296;
  const right = num % 4294967296;

  let base = offset, byte, i;

  if (num >= 0 && length > 4) {
    for (i = length - 4 - 1; i >= 0; i--) {
      byte = (left >> (8 * i)) & 0xFF;
      writeByte(byte, buffer, base++);
    }
    length = 4;
  }

  for (i = length - 1; i >= 0; i--) {
    byte = (right >> (8 * i)) & 0xFF;
    writeByte(byte, buffer, base++);
  }

  return base;
}

function makeBitMask(start, len) {
  let mask = 0;

  for (let i = start + len - 1; i >= start; i--) {
    mask |= (1 << i);
  }
  return mask;
}

function writeBits(num, buffer, byteOffset, bitOffset, totalBitsToWrite) {
  let base = byteOffset;
  let start = bitOffset;
  let remainingBits = totalBitsToWrite;
  let len, mask, byte, oddBitsNum = 0;

  while (remainingBits > 0) {
    len = Math.min(remainingBits, 8 - start);
    byte = (num >>> Math.max(remainingBits - 8, 0)) & 0xFF;
    mask = makeBitMask(start, len);
    writeByte((byte << start) & 0xFF, buffer, base, mask, Boolean(start));
    remainingBits -= len;
    oddBitsNum = Math.max(8 - start - len, 0);
    if (oddBitsNum) {
      break;
    }
    base++;
    start = 0;
  }
  return [base, oddBitsNum];
}

module.exports = {
  writeString,
  writeNumber,
  writeBits
};
