#!/usr/bin/env node

const verbose = (process.argv.indexOf('--verbose') > -1 ? true : false);

let portIndex = process.argv.indexOf('--port');
if (portIndex < 0) portIndex = process.argv.indexOf('-p');

let port;
if (portIndex > -1) {
    port = process.argv[portIndex + 1];
}

const server = require('../lib/server')({ port: port });

if (verbose) {
    server.verbose((output) => {
        console.log('wubsub-server: ' + output);
    });
}