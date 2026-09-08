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
By default, the client will try to reconnect to the server 10 times before giving up. You can modify that limit to any integer or `Infinity`. See a more detailed [client example](examples/client.js) for configuring retries.

When the retries run out the client reports the failure rather than throwing: the client is an `EventEmitter` and emits an `error` event, which the optional `onError` callback passed as the second argument to `wubsub.client()` is attached to. Attach one or the other: as with any `EventEmitter`, an `error` with no listener is thrown. A client that has given up stays dead — `isDead()` returns `true`, `publish()` fails its callback and `subscribe()` throws. `isClosed()` reports the same for a client you closed yourself.

##### What kinds of messages can I publish?
Any value that survives `JSON.stringify`, including falsy ones like `0`, `''`, `false` and `null`. Publishing with no message delivers `null`.

##### What happens to messages if the client gets disconnected?
Messages that a client publishes during an intermittent loss of connection will be held and sent once the connection is reestablished, in the order they were published. If the client gives up (retries exhausted) or you call `close()` first, any held messages fail their publish callback with an error rather than being delivered. If another client publishes to a topic/channel that a disconnected client is subscribed to, the disconnected client will not receive those messages (fire-and-forget pattern). If you require guaranteed delivery, you can add your own receipt handling/delivery confirmation logic.

##### How do I change the heartbeat interval?
The server pings every 30 seconds and drops clients that do not answer; the client terminates and reconnects if it has heard nothing for that long. Both take a `heartbeat` option in milliseconds, and **the two values must match** — a client expecting a shorter interval than the server sends will reconnect on a loop. Pass `0` on both to disable the heartbeat.

```js
const server = wubsub.server({ port: 3000, heartbeat: 60000 });
const client = wubsub.client({ url: 'ws://localhost:3000', heartbeat: 60000 });
```


### License
[MIT](LICENSE)