const server = require('./lib/server');
const client = require('./lib/client');

module.exports = server;
module.exports.server = server;
module.exports.client = client;