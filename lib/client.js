const WebSocket = require('ws');
const EventEmitter = require('events');

module.exports = function ({ url = 'ws://localhost:3000/', retries = 10 } = {}, onError) {
    const emitter = new EventEmitter();

    // onError is just a pre-attached error listener
    if (typeof onError === 'function') {
        emitter.on('error', onError);
    }

    let _ws;
    let _log = () => false;
    let connTries = 1;
    let exit = false;
    let dead = false;
    const subscriptions = [];
    let reconnectTimer;
    let pingTimeout;

    // [frame, callback] pairs waiting on an open socket
    const queue = [];

    function connect() {
        // close() is final
        if (exit) {
            return false;
        }

        const ws = new WebSocket(url);
        _ws = ws;

        function heartbeat() {
            clearTimeout(pingTimeout);
            pingTimeout = setTimeout(() => {
                _log('terminating broken connection');

                // use terminate instead of close to avoid close timer delay
                // timeout should equal server heartbeat interval plus buffer for latency
                ws.terminate();
            }, 30000 + 1000);
        }

        ws.on('open', () => {
            _log('connected to ' + url);
            heartbeat();
            connTries = 1;

            // resubscribe in case of reconnect
            for (const subscriber of subscriptions) {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ t: subscriber[0], s: true }));
                }
            }

            flush();
        });

        ws.on('ping', () => {
            heartbeat();
        });

        ws.on('close', () => {
            clearTimeout(pingTimeout);

            if (exit) {
                _log('shutting down');
                return true;
            }

            if (connTries > retries) {
                _log('unable to connect to ' + url);
                const error = new Error('Unable to connect to ' + url + ' after ' + retries + ' retries');
                dead = true;
                failQueued(error);

                return report(error);
            }

            reconnectTimer = setTimeout(() => {
                _log('attempting to reconnect ' + connTries++);
                connect();
            }, 500);
        });

        ws.on('error', (error) => {
            _log(error.message);
        });

        ws.on('message', (data) => {
            try {
                data = JSON.parse(data);
            }
            catch (error) {
                _log('malformed JSON from server, ignoring frame');
                return;
            }

            if (typeof data !== 'object' || data === null) {
                _log('non-object frame from server, ignoring');
                return;
            }

            for (const subscriber of subscriptions) {
                if (subscriber[0] === data.t) {
                    subscriber[1](data.m);
                }
            }
        });
    }
    connect();

    function publish(topic, message, callback) {
        callback = callback || function () { };

        // JSON.stringify drops undefined, which would send a frame with no m key
        if (message === undefined) {
            message = null;
        }

        if (exit || dead) {
            const error = new Error(exit ? 'Client is closed' : 'Client is unable to connect to ' + url);
            callback(error, { error: true });

            return false;
        }

        // serialize now so a later mutation cannot change what was published
        let frame;
        try {
            frame = JSON.stringify({ t: topic, m: message });
        }
        catch (error) {
            callback(error, { error: true });

            return false;
        }

        queue.push([frame, callback]);
        flush();
    }

    function flush() {
        while (queue.length && _ws && _ws.readyState === 1) {
            const [frame, callback] = queue.shift();
            const receipt = { error: false };

            try {
                _ws.send(frame, (error) => {
                    if (error) {
                        receipt.error = true;
                    }
                    callback(error, receipt);
                });
            }
            catch (error) {
                receipt.error = true;
                callback(error, receipt);
            }
        }

        if (queue.length) {
            _log('holding ' + queue.length + ' message(s) until reconnected');
        }
    }

    function report(error) {
        // with no listener attached this throws, per Node convention
        emitter.emit('error', error);
    }

    function failQueued(error) {
        while (queue.length) {
            queue.shift()[1](error, { error: true });
        }
    }

    function subscribe(topic, callback) {
        if (typeof callback !== 'function') {
            throw new Error('A callback is required when subscribing to a topic');
        }

        if (exit || dead) {
            throw new Error(exit ? 'Client is closed' : 'Client is unable to connect to ' + url);
        }

        if (_ws.readyState === 1) {
            _ws.send(JSON.stringify({ t: topic, s: true }));
        }

        subscriptions.push([topic, callback]);
    }

    function unsubscribe(topic) {
        if (_ws.readyState === 1) {
            _ws.send(JSON.stringify({ t: topic, s: false }));
        }

        let i = 0;
        while (i < subscriptions.length) {
            if (subscriptions[i][0] === topic) {
                subscriptions.splice(i, 1);
            }
            else {
                i++;
            }
        }
    }

    function close(code, reason) {
        // set exit first so the close handler does not reconnect
        exit = true;
        clearTimeout(reconnectTimer);
        clearTimeout(pingTimeout);
        failQueued(new Error('Client is closed'));

        if (_ws.readyState === 0 || _ws.readyState === 1) {
            _ws.close(code, reason);
        }
    }

    return Object.assign(emitter, {
        verbose: (verbose) => { _log = verbose; },
        publish: publish,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        close: close,
        isClosed: () => exit,
        isDead: () => dead
    });
};
