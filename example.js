// const fs = require('fs');
// const path = require('path');
const {Writable, Transform} = require('stream');
const {print} = require('@mediafish/flv');
const {createSimpleServer} = require('.');

class Terminator extends Writable {
  constructor() {
    super({objectMode: true});
  }

  _write(chunk, encoding, cb) {
    setImmediate(cb);
  }
}

class Logger extends Transform {
  constructor() {
    super({objectMode: true});
    this.index = 0;
  }

  _transform(obj, _, cb) {
    const {type, timestamp, data} = obj;
    if (type === 'video') {
      console.log(`timestamp: ${timestamp}`);
      print(data);
/*
      if (this.index < 20) {
        const filePath = path.join(__dirname, `video-${this.index++}.dat`);
        fs.writeFile(filePath, data, err => {
          if (err) {
            return console.error(err.stack);
          }
          console.log(`Video writen to ${filePath}`);
        });
      }
*/
    } else if (type === 'audio') {
      console.log(`timestamp: ${timestamp}`);
      print(data);
/*
      if (this.index < 20) {
        const filePath = path.join(__dirname, `audio-${this.index++}.dat`);
        fs.writeFile(filePath, data, err => {
          if (err) {
            return console.error(err.stack);
          }
          console.log(`Video writen to ${filePath}`);
        });
      }
*/
    } else if (type === 'data') {
      console.log(`${timestamp} [Data] ${JSON.stringify(data, null, 4)}`);
    }
    cb(null, obj);
  }
}

createSimpleServer('/live')
.pipe(new Logger())
.on('finish', () => {
  console.log('Finish!');
})
.on('error', err => {
  console.error(err.stack);
})
.pipe(new Terminator());
