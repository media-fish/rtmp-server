// const fs = require('fs');
// const path = require('path');
const {Writable, Transform} = require('stream');
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
      console.log(`${timestamp} [Video] length=${data.length}`);
      /*
      if (this.index < 20) {
        const filePath = path.join(__dirname, `video-${this.index++}.dat`);
        fs.writeFile(filePath, data, err => {
          if (err) {
            return console.error(err.stack);
          }
          console.log(`Video writen to ${filePath}`);
        });
        this.videoSaved = true;
      }
      */
    } else if (type === 'audio') {
      console.log(`${timestamp} [Audio] length=${data.length}`);
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
