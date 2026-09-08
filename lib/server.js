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

            // drop this socket's subscriptions so they do not pin a dead client
            unsubscribeAll(ws);
        });

        ws.on('error', (error) => {
            _log('client ' + ws.id + ' error: ' + error.message);
        });

        ws.on('message', (data) => {
            try {
                data = JSON.parse(data);
            }
            catch (error) {
                _log('client ' + ws.id + ' sent malformed JSON, ignoring frame');
                return;
            }

            if (typeof data !== 'object' || data === null) {
                _log('client ' + ws.id + ' sent a non-object frame, ignoring');
                return;
            }

            // dispatch on the control field, not truthiness, so falsy values route
            if (data.t === undefined || data.t === null) {
                _log('client ' + ws.id + ' sent a frame with no topic, ignoring');
                return;
            }

            if (data.s === true) {
                _log('client ' + ws.id + ' subscribed to ' + data.t);
                subscribe(data.t, ws);
            }
            else if (data.s === false) {
                _log('client ' + ws.id + ' unsubscribed from ' + data.t);
                unsubscribe(data.t, ws);
            }
            else if ('m' in data) {
                _log('client ' + ws.id + ' published to ' + data.t);
                publish(data.t, data.m);
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

    function unsubscribeAll(ws) {
        let i = 0;
        while (i < subscriptions.length) {
            if (subscriptions[i][1] === ws) {
                subscriptions.splice(i, 1);
            }
            else {
                i++;
            }
        }
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
        on: (event, callback) => { wss.on(event, callback); },
        close: (callback) => { wss.close(callback); }
    };
};