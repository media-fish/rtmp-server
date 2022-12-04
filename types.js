class RTMPMessage {
  constructor(type, timestamp) {
    this.type = type;
    this.timestamp = timestamp;
  }
}

export class Video extends RTMPMessage {
  constructor(timestamp, data) {
    super('video', timestamp);
    this.data = data;
  }
}

export class Audio extends RTMPMessage {
  constructor(timestamp, data) {
    super('audio', timestamp);
    this.data = data;
  }
}

export class Data extends RTMPMessage {
  constructor(timestamp, data) {
    super('data', timestamp);
    this.data = data;
  }
}
