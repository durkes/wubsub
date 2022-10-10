const WebSocketServer = require('ws').WebSocketServer;

module.exports = function ({ port = 3000 }) {
    const wss = new WebSocketServer({ port: port });
    let _log = () => false;
    let connNum = 1;
    const subscriptions = [];

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

            if (data.t && data.m) {
                _log('client ' + ws.id + ' published to ' + data.t);
                publish(data.t, data.m);
            }
            else if (data.t && data.s === true) {
                _log('client ' + ws.id + ' subscribed to ' + data.t);
                subscribe(data.t, ws);
            }
            else if (data.t && data.s === false) {
                _log('client ' + ws.id + ' unsubscribed from ' + data.t);
                unsubscribe(data.t, ws);
            }
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

    function publish(topic, message) {
        let ws;

        for (const subscriber of subscriptions) {
            if (subscriber[0] === topic) {
                ws = subscriber[1];

                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ t: topic, m: message }));
                }
            }
        }
    }

    function subscribe(topic, ws) {
        for (const subscriber of subscriptions) {
            if (subscriber[0] === topic && subscriber[1] === ws) {
                return true;
            }
        }

        subscriptions.push([topic, ws]);
    }

    function unsubscribe(topic, ws) {
        let i = 0;
        while (i < subscriptions.length) {
            if (subscriptions[i][0] === topic && subscriptions[i][1] === ws) {
                subscriptions.splice(i, 1);
            }
            else {
                i++;
            }
        }
    }

    return {
        verbose: (verbose) => { _log = verbose; },
        on: (event, callback) => { wss.on(event, callback); }
    };
};