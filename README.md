# wubsub - A fast and simple pub/sub server and client using WebSockets and Node.js

wubsub is built on top of the popular [ws module](https://www.npmjs.com/package/ws) to broker messages between clients. Clients can send and receive messages by topic or channel.

## How to use wubsub

#### Installation
```bash
$ npm install wubsub
```

#### Setting up your server (server.js)
```js
const wubsub = require('wubsub');
const server = wubsub.server({ port: 3000 });
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
const wubsub = require('wubsub');
const client = wubsub.client({ url: 'ws://localhost:3000' });

client.subscribe('channel1', (message) => {
    console.log('message received:', message);
});

client.publish('channel1', 'test message 1');
client.publish('channel1', 'test message 2');

// optionally unsubscribe as needed or it will happen automatically on disconnect
client.unsubscribe('channel2');
```

## Missing something?
See [more examples](examples) for additional features and options.

### License
[MIT](LICENSE)