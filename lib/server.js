const WebSocketServer = require('ws').WebSocketServer;

module.exports = function ({ port = 3000 }) {
    const wss = new WebSocketServer({ port: port });
    let _log = () => false;
    let connNum = 1;

    wss.on('connection', (ws) => {
        ws.id = connNum++;
        _log('client ' + ws.id + ' connected');

        // confirm heartbeat
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('close', () => {
            _log('client ' + ws.id + ' disconnected');
        });

        ws.on('message', (data) => {
            data = JSON.parse(data);
            _log('client ' + ws.id + ' message for ' + data.t);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                _log('terminating unresponsive client ' + ws.id);
                return ws.terminate();
            }

            // reset heartbeat
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        _log('shutting down');
        clearInterval(interval);
    });

    wss.on('listening', () => {
        _log('listening on port ' + port);
    });

    return {
        verbose: (verbose) => { _log = verbose; },
        on: (event, callback) => { wss.on(event, callback); }
    };
};