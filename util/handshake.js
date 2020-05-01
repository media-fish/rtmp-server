// const debug = require('debug');
const {reader, writer} = require('@mediafish/buffer-operator');
// const print = debug('rtmp-server');

const S0 = Buffer.from([0x03]);
const S1 = Buffer.alloc(1536);
const S2 = Buffer.alloc(1536);
const S0S1S2 = Buffer.alloc(1 + (8 + 1528) * 2);

function writeS0S1(conn, epocTime) {
  // Write S0, S1
  conn.write(S0);
  // print(`[S0] Sent: version="${S0[0]}"`);
  writer.writeNumber(epocTime, S1, 0);
  const url = `smtp://${conn.localAddress}:${conn.localPort}`;
  writer.writeString(url, S1, 8, url.length);
  conn.write(S1);
  // print(`[S1] Sent: url="${url}"`);
}

function writeS2(conn, {epocTime, epocTimeReadAt, randomValue}) {
  writer.writeNumber(epocTime, S2, 0);
  writer.writeNumber(epocTimeReadAt, S2, 4);
  randomValue.copy(S2, 8);
  conn.write(S2);
  // print(`[S2] Sent: epocTime="${epocTime}, epocTimeReadAt=${epocTimeReadAt}, randomValue.length=${randomValue.length}"`);
}

function writeS0S1S2(conn, {epocTime, randomValue}) {
  writer.writeNumber(3, S0S1S2, 0, 1);
  writer.writeNumber(epocTime, S0S1S2, 1, 4);
  writer.writeNumber(0, S0S1S2, 5, 4);
  randomValue.copy(S0S1S2, 9, 0, 1528);
  writer.writeNumber(epocTime, S0S1S2, 9 + 1528, 4);
  writer.writeNumber(0, S0S1S2, 9 + 1528 + 4, 4);
  randomValue.copy(S0S1S2, 9 + 1528 + 8, 0, 1528);
  conn.write(S0S1S2);
  // print(`[S0,S1,S2] Sent: epocTime="${epocTime}, randomValue.length=${randomValue.length}"`);
}

function readC0(buff, offset) {
  let version;
  [offset, version] = reader.readNumber(buff, offset, 1);
  // print(`[C0] Received: Supported version: ${version}`);
  return [offset, version];
}

function readC1(buff, offset) {
  let epocTime;
  [offset, epocTime] = reader.readNumber(buff, offset, 4);
  const epocTimeReadAt = new Date().getTime();
  offset += 4;
  const randomValue = buff.slice(offset, offset + 1528);
  offset += 1528;
  // print(`[C1] Received: epocTime=${epocTime}, epocTimeReadAt=${epocTimeReadAt}, randomValue.length=${randomValue.length}`);
  return [offset, {epocTime, epocTimeReadAt, randomValue}];
}

function readC2(buff, offset) {
  let epocTime, epocTimeReadAt;
  [offset, epocTime] = reader.readNumber(buff, offset, 4);
  [offset, epocTimeReadAt] = reader.readNumber(buff, offset, 4);
  const randomValue = buff.slice(offset, offset + 1528);
  offset += 1528;
  // print(`[C2] Received: epocTime=${epocTime}, epocTimeReadAt=${epocTimeReadAt}, randomValue.length=${randomValue.length}`);
  return [offset, {epocTime, epocTimeReadAt, randomValue}];
}

module.exports = {
  writeS0S1,
  writeS2,
  writeS0S1S2,
  readC0,
  readC1,
  readC2
};
