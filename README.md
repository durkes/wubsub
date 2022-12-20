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
$ npx wubsub-server --port 3000
```
Use --verbose for console logs
```bash
$ npx wubsub-server --port 3000 --verbose
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

**See [more examples](examples) for additional features and options.**

## FAQ
##### How does wubsub handle connection issues?
By default, the client will try to reconnect to the server 10 times before returning an error. You can modify that limit to any integer or `Infinity`. See a more detailed [client example](examples/client.js) for configuring retries.

##### What happens to messages if the client gets disconnected?
Messages that a client publishes during an intermittent loss of connection will be held and sent once the connection is reestablished. If another client publishes to a topic/channel that a disconnected client is subscribed to, the disconnected client will not receive those messages (fire-and-forget pattern). If you require guaranteed delivery, you can add your own receipt handling/delivery confirmation logic.


### License
[MIT](LICENSE)