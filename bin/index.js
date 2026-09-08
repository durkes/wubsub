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
        console.log('wubsub-server:', output);
    });
}

server.on('error', (error) => {
    const boundPort = (port === undefined ? 3000 : port);

    if (error.code === 'EADDRINUSE') {
        console.error('wubsub-server: port ' + boundPort + ' is already in use');
    }
    else if (error.code === 'EACCES') {
        console.error('wubsub-server: permission denied binding to port ' + boundPort);
    }
    else {
        console.error('wubsub-server: ' + error.message);
    }

    process.exit(1);
});

// close client sockets before exiting so peers see a close frame
let shuttingDown = false;
function shutdown(signal) {
    // a second signal means stop waiting
    if (shuttingDown) {
        process.exit(1);
    }
    shuttingDown = true;

    if (verbose) {
        console.log('wubsub-server:', signal + ' received, shutting down');
    }

    server.close(() => {
        process.exit(0);
    });

    const timeout = setTimeout(() => {
        console.error('wubsub-server: shutdown timed out, exiting');
        process.exit(1);
    }, 5000);
    timeout.unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
