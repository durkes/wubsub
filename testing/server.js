const wubsub = require('../index.js'); // const wubsub = require('wubsub');
const server = wubsub.server({ port: 3000 });

// optional for logging or debugging
server.verbose((output) => {
    console.log('wubsub-server:', output);
});