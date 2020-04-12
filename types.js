class RTMPMessage {
  constructor(type, timestamp) {
    this.type = type;
    this.timestamp = timestamp;
  }
}

class Video extends RTMPMessage {
  constructor(timestamp, data) {
    super('video', timestamp);
    this.data = data;
  }
}

class Audio extends RTMPMessage {
  constructor(timestamp, data) {
    super('audio', timestamp);
    this.data = data;
  }
}

class Data extends RTMPMessage {
  constructor(timestamp, data) {
    super('data', timestamp);
    this.data = data;
  }
}

module.exports = {
  Video,
  Audio,
  Data
};
