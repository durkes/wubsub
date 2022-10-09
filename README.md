# wubsub - A simple and fast pub/sub server and client using WebSockets and Node.js

wubsub uses the efficient [ws](https://www.npmjs.com/package/ws) module to broker messages between clients. Clients can publish and subscribe to send and receive messages by topic/channel.

## How to use wubsub

#### Installation
```bash
$ npm install wubsub
```

#### Setting up your server (server.js)
```js
const pubsub = require('wubsub');
```

#### Or launch a server from the CLI
Install the module globally
```bash
$ npm install -g wubsub
```
Start the server (Ctrl+C to stop)
```bash
$ wubsub-server --port 3000
```
Use --verbose for console logs
```bash
$ wubsub-server --port 3000 --verbose
```

#### Setting up your client (client.js)
Messages are published and received by clients.
```js
const pubsub = require('wubsub');
```

[More examples](examples)

### License
[MIT](LICENSE)