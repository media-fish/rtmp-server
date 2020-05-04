[![Build Status](https://travis-ci.org/media-fish/rtmp-server.svg?branch=master)](https://travis-ci.org/media-fish/rtmp-server)
[![Coverage Status](https://coveralls.io/repos/github/media-fish/rtmp-server/badge.svg?branch=master)](https://coveralls.io/github/media-fish/rtmp-server?branch=master)
[![Dependency Status](https://david-dm.org/media-fish/rtmp-server.svg)](https://david-dm.org/media-fish/rtmp-server)
[![Development Dependency Status](https://david-dm.org/media-fish/rtmp-server/dev-status.svg)](https://david-dm.org/media-fish/rtmp-server#info=devDependencies)
[![Known Vulnerabilities](https://snyk.io/test/github/media-fish/rtmp-server/badge.svg)](https://snyk.io/test/github/media-fish/rtmp-server)
[![npm Downloads](https://img.shields.io/npm/dw/@mediafish/rtmp-server.svg?style=flat-square)](https://npmjs.com/@mediafish/rtmp-server)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)


# rtmp-server

A Node.js server that receives an RTMP live stream and populates a readable object stream of the published audio, video, and data messages

Only the publish command is supported. This server is only intended for live video/audio publishing and does not provide any playback functionalities.

## Install
[![NPM](https://nodei.co/npm/@mediafish/rtmp-server.png?mini=true)](https://nodei.co/npm/@mediafish/rtmp-server/)

## Usage

#### Example-1: A simple server with a single connection, single stream
```js
const {createSimpleServer} = require('@mediafish/rtmp-server');
const {print} = require('@mediafish/flv');
// Start an RTMP server at rtmp://localhost/live
createSimpleServer('/live')
.on('data', ({timestamp, type, data}) => {
  console.log(`RTMP message: type=${type}, timestamp=${timestamp}`);
  switch (type) {
    case 'video':
      // data is FLV video tag (AVC)
      print(data);
      break;
    case 'audio':
      // data is FLV audio tag (AAC)
      print(data);
      break;
    case 'data':
      // data is an array of JS object
      for (const item of data) {
        console.log(`${JSON.stringify(item, null, 4)}`);
      }
      break;
  }
})
.on('error', err => {
  console.error(err.stack);
});

// Or you can simply pipe the stream into a writable stream
createSimpleServer('/live')
.pipe(new Transcoder('hls'))
.pipe(new FileWriter('./dist/'));

```

#### Example-2: An advanced server with multiple connections, multiple streams

```js
const {createServer} = require('@mediafish/rtmp-server');
// Start an RTMP server at rtmp://localhost:19350/live/{main|sub}-camera
createServer({port: 19350, maxConnectionNum: 2, maxStreamNum: 2})
.once('/live/main-camera', handleConnection)
.once('/live/sub-camera', handleConnection)
.on('error', err => {
  console.error(err.stack);
});

function handleConnection(connection) {
  console.log(`Incoming connection: path="${connection.path}"`);
  return connection
  .once('stream-1', handleStream)
  .once('stream-2', handleStream)
  .on('error', err => {
    console.error(err.stack);
  });
}

function handleStream(stream) {
  console.log(`Published stream: name="${stream.name}"`);
  return stream
  .on('data', handleMessage)
  .on('error', err => {
    console.error(err.stack);
  });
}

function handleMessage({timestamp, type, data}) {
  console.log(`RTMP message: type=${type}, timestamp=${timestamp}`);
  switch (type) {
    case 'video':
      // data is FLV video tag (AVC)
      print(data);
      break;
    case 'audio':
      // data is FLV audio tag (AAC)
      print(data);
      break;
    case 'data':
      // data is an array
      for (const item of data) {
        console.log(`${JSON.stringify(item, null, 4)}`);
      }
      break;
  }
}

```

## API

### `createSimpleServer(path[, options])`
Creates an RTMP server with a single connection, single stream

#### params
| Name    | Type   | Required | Default | Description   |
| ------- | ------ | -------- | ------- | ------------- |
| `path`   | string | Yes      | N/A    | A specific path that a client can connect |
| `options`     | object | No      | {}    | An object holding option values that are used to override the internal option values |

##### supported options
| Name       | Type    | Default | Description   |
| ---------- | ------- | ------- | ------------- |
| `port` | number | 1935   | The port number this server listens for|

#### return value
An instance of `RTMPStream` (See `class RTMPStream`)

### `createServer([options])`
Creates an RTMP server

#### params
| Name    | Type   | Required | Default | Description   |
| ------- | ------ | -------- | ------- | ------------- |
| options     | object | No      | {}    | An object holding option values that are used to override the internal option values |

##### supported options
| Name       | Type    | Default | Description   |
| ---------- | ------- | ------- | ------------- |
| `port` | number | 1935   | The port number this server listens for|
| `maxConnectionNum` | number | 1   | The number of connections that can be established concurrently|
| `maxStreamNum` | number | 1   | The number of streams the client can publish concurrently for each connection |


#### return value
An instance of `RTMPServer` (See `class RTMPServer`)

### `class RTMPServer extends EventEmitter`
Represents an RTMP server

#### methods
All methods are inherited from `EventEmitter`

##### `on(event, listener)`
A method used to listen for a specific event

| Name    | Type   | Required | Default | Description   |
| ------- | ------ | -------- | ------- | ------------- |
| `event`   | string | Yes      | N/A    | `event` should be 'error' or a specific path within the RTMP server |
| `listener` | function | Yes      | N/A    | If `event` equals to 'error', `listener` should be a function that takes an `Error` object. Otherwise, `listener` should be a function that takes an `RTMPConnection` object. |

##### return value
A reference to the `RTMPServer`, so that calls can be chained.

### `class RTMPConnection extends EventEmitter`
Represents a connection from an RTMP client

#### properties

| Name    | Type   | Description   |
| ------- | ------ | ------------- |
| `path`   | string | The path string the client specified on connection as a part of URL. (e.g. rtmp://example.com/{path}) |

#### methods
All methods are inherited from `EventEmitter`

##### `on(event, listener)`
A method used to listen for a specific event

| Name    | Type   | Required | Default | Description   |
| ------- | ------ | -------- | ------- | ------------- |
| `event`   | string | Yes      | N/A    | `event` should be 'error' or a stream name with which the stream is published by the client. The stream name can be '*' which matches any names. |
| `listener` | function | Yes      | N/A    | If `event` equals to 'error', `listener` should be a function that takes an `Error` object. Otherwise, `listener` should be a function that takes an `RTMPStream` object. |

##### return value
A reference to the `RTMPConnection`, so that calls can be chained.


### `class RTMPStream extends stream.Readable`
Represents a stream of messages published by the RTMP client. The published audio, video, and data messages can be read from the stream. See `Data format`

#### properties

| Name    | Type   | Description   |
| ------- | ------ | ------------- |
| `name`   | string | The stream name with which the stream is published by the client. |

#### methods
All methods are inherited from `stream.Readable`

## Data format
This section describes the structure of the messages that can be read from `RTMPStream`

### `Message`
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `type` | string     | Yes      | N/A     | Either of {'video'/'audio'/'data'}  |
| `timestamp` | number     | Yes      | N/A     | An integer value that represents an absolute timestamp in millisecond that wraps around every 32 bit  |


### `Video` (extends `Message`)
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `data` | `AVC`    | Yes      | N/A     | An isntance of `AVC` (See [@mediafish/flv](https://github.com/media-fish/flv#readme)) |

### `Audio` (extends `Message`)
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `data` | `AAC`     | Yes      | N/A     | An isntance of `AAC` (See [@mediafish/flv](https://github.com/media-fish/flv#readme))  |

### `Data` (extends `Message`)
| Property         | Type          | Required | Default | Description   |
| ---------------- | ------------- | -------- | ------- | ------------- |
| `data` | `Array`     | Yes      | N/A     | An array that contains objects, string, or number  |
