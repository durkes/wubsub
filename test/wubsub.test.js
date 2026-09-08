const { test } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');
const WebSocketServer = require('ws').WebSocketServer;
const wubsub = require('..');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// each test gets its own port so they can run in any order
let nextPort = 34100;
const takePort = () => nextPort++;

// resolves with the first message on a topic
function received(client, topic) {
    return new Promise((resolve) => client.subscribe(topic, resolve));
}

test('publishes and receives, including falsy and omitted messages', async () => {
    const port = takePort();
    const server = wubsub.server({ port: port });
    const client = wubsub.client({ url: 'ws://localhost:' + port });

    const values = ['text', 0, '', false, null, { a: 1 }];
    const seen = [];

    client.subscribe('ch', (message) => seen.push(message));
    for (const value of values) {
        client.publish('ch', value);
    }

    // no message argument becomes null rather than a frame with no m key
    client.publish('ch');

    await wait(300);
    assert.deepStrictEqual(seen, values.concat([null]));

    client.close();
    await new Promise((resolve) => server.close(resolve));
});

test('only subscribers of a topic receive it, and unsubscribe stops delivery', async () => {
    const port = takePort();
    const server = wubsub.server({ port: port });
    const a = wubsub.client({ url: 'ws://localhost:' + port });
    const b = wubsub.client({ url: 'ws://localhost:' + port });

    const other = [];
    a.subscribe('mine', () => {});
    b.subscribe('theirs', (message) => other.push(message));

    const mine = received(a, 'mine');
    b.publish('mine', 'hello');
    assert.strictEqual(await mine, 'hello');

    a.unsubscribe('mine');
    b.publish('mine', 'ignored');
    await wait(200);
    assert.deepStrictEqual(other, []);

    a.close();
    b.close();
    await new Promise((resolve) => server.close(resolve));
});

test('a disconnected subscriber does not affect the ones still connected', async () => {
    const port = takePort();
    const server = wubsub.server({ port: port });
    const gone = wubsub.client({ url: 'ws://localhost:' + port });
    const stays = wubsub.client({ url: 'ws://localhost:' + port });

    gone.subscribe('ch', () => {});
    stays.subscribe('ch', () => {});
    await wait(200);

    gone.close();
    await wait(200);

    const message = received(stays, 'ch');
    stays.publish('ch', 'still here');
    assert.strictEqual(await message, 'still here');

    stays.close();
    await new Promise((resolve) => server.close(resolve));
});

test('a malformed frame does not crash the server', async () => {
    const port = takePort();
    const server = wubsub.server({ port: port });
    const client = wubsub.client({ url: 'ws://localhost:' + port });

    const raw = new (require('ws'))('ws://localhost:' + port);
    await new Promise((resolve) => raw.on('open', resolve));
    raw.send('not json');
    raw.send('"a string, not an object"');
    await wait(200);

    const message = received(client, 'ch');
    client.publish('ch', 'survived');
    assert.strictEqual(await message, 'survived');

    raw.close();
    client.close();
    await new Promise((resolve) => server.close(resolve));
});

test('a malformed frame does not crash the client', async () => {
    const port = takePort();
    const wss = new WebSocketServer({ port: port });

    wss.on('connection', (ws) => {
        ws.on('message', () => {
            ws.send('<html>not json</html>');
            ws.send(JSON.stringify({ t: 'ch', m: 'survived' }));
        });
    });

    const client = wubsub.client({ url: 'ws://localhost:' + port });
    const message = received(client, 'ch');
    client.publish('ch', 'trigger');
    assert.strictEqual(await message, 'survived');

    client.close();
    wss.close();
});

test('messages published while disconnected are held and sent on connect', async () => {
    const port = takePort();

    // the client starts before anything is listening
    const client = wubsub.client({ url: 'ws://localhost:' + port });
    const seen = [];
    client.subscribe('ch', (message) => seen.push(message));
    client.publish('ch', 'first');
    client.publish('ch', 'second');

    await wait(300);
    assert.deepStrictEqual(seen, []);

    const server = wubsub.server({ port: port });
    await wait(1000);

    // held in order, and the subscription was replayed on connect
    assert.deepStrictEqual(seen, ['first', 'second']);

    client.close();
    await new Promise((resolve) => server.close(resolve));
});

test('close() is final and does not reconnect', async () => {
    const port = takePort();
    const wss = new WebSocketServer({ port: port });

    let connections = 0;
    wss.on('connection', () => connections++);

    const client = wubsub.client({ url: 'ws://localhost:' + port });
    await wait(300);
    client.close();
    await wait(800);

    assert.strictEqual(connections, 1);
    assert.strictEqual(client.isClosed(), true);

    // publishing after close fails its callback instead of queueing
    const error = await new Promise((resolve) => client.publish('ch', 'late', resolve));
    assert.match(error.message, /closed/i);

    wss.close();
});

test('server.close() disconnects clients and fires its callback', async () => {
    const port = takePort();
    const server = wubsub.server({ port: port });
    const client = wubsub.client({ url: 'ws://localhost:' + port });
    await wait(300);

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('close callback never fired')), 2000);
        server.close(() => {
            clearTimeout(timer);
            resolve();
        });
    });

    client.close();
});

test('options are optional', async () => {
    const server = wubsub.server();
    const client = wubsub.client();

    const message = received(client, 'ch');
    client.publish('ch', 'defaults');
    assert.strictEqual(await message, 'defaults');

    client.close();
    await new Promise((resolve) => server.close(resolve));
});

test('a port conflict is reported as an error event', async () => {
    const port = takePort();
    const first = wubsub.server({ port: port });
    const second = wubsub.server({ port: port });

    const error = await new Promise((resolve) => second.on('error', resolve));
    assert.strictEqual(error.code, 'EADDRINUSE');

    await new Promise((resolve) => first.close(resolve));
});

test('exhausting retries reports an error and leaves the client dead', async () => {
    const errors = [];
    const client = wubsub.client({ url: 'ws://localhost:' + takePort(), retries: 0 }, (error) => errors.push(error));

    const error = await new Promise((resolve) => client.on('error', resolve));
    assert.match(error.message, /unable to connect/i);

    // the onError argument is just a pre-attached listener
    assert.deepStrictEqual(errors, [error]);
    assert.strictEqual(client.isDead(), true);

    const publishError = await new Promise((resolve) => client.publish('ch', 'late', resolve));
    assert.match(publishError.message, /unable to connect/i);
    assert.throws(() => client.subscribe('ch', () => {}), /unable to connect/i);
});

test('the CLI rejects an invalid --port', async () => {
    const bin = path.join(__dirname, '..', 'bin', 'index.js');

    for (const args of [['--port', 'abc'], ['--port', '--verbose'], ['--port']]) {
        const result = await new Promise((resolve) => {
            execFile(process.execPath, [bin].concat(args), (error, stdout, stderr) => {
                resolve({ code: error ? error.code : 0, stderr: stderr });
            });
        });

        assert.strictEqual(result.code, 1, args.join(' ') + ' should exit 1');
        assert.match(result.stderr, /invalid --port value/);
    }
});
