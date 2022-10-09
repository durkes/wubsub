const wubsub = require('../index.js'); // const wubsub = require('wubsub');
const client = wubsub.client({ url: 'ws://localhost:3000', retries: 10 }, (error) => {
    // this callback will fire if the client is unable to connect after X retries
    if (error) {
        console.error(error.message);
    }

    // you should throw errors unless you implement custom error handling logic
    throw error;
});

// channels are created and destroyed automatically based on client subscriptions
client.subscribe('channel1', (message) => {
    console.log('message received:', message);
});

// messages can be objects or strings
const message_object = {
    id: 1,
    value: 'test'
};

client.publish('channel1', message_object);

// optional status callback
client.publish('channel1', 'test message', (error) => {
    if (error) {
        console.error('publish error:', error.message);
    }
});

// optionally unsubscribe as needed or it will happen automatically on disconnect
client.unsubscribe('channel2');

// optional for logging or debugging
client.verbose((output) => {
    console.log('wubsub-client:', output);
});

// the rest of your app
let count = 1;
setInterval(() => {
    client.publish('channel1', { hello: 'world', count: count++ }, (error) => {
        if (error) {
            console.error('publish error:', error.message);
        }
    });
}, 1000);