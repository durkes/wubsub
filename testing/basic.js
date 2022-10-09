// this is the simplest example using nothing optional
const wubsub = require('../index.js'); // const wubsub = require('wubsub');

// server.js
const server = wubsub.server({ port: 3000 });

// client.js
const client = wubsub.client({ url: 'ws://localhost:3000' });

client.subscribe('channel1', (message) => {
    console.log('message received:', message);
});

client.publish('channel1', 'test message 1');
client.publish('channel1', 'test message 2');
client.publish('channel1', 'test message 3');
client.publish('channel1', 'test message 4');

client.unsubscribe('channel1');