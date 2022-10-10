const WebSocket = require('ws');

module.exports = function ({ url = 'ws://localhost:3000/', retries = 10 }, onError) {
    let _ws;
    let _log = () => false;
    let connTries = 1;
    const subscriptions = [];

    function connect() {
        const ws = new WebSocket(url);
        _ws = ws;
        let pingTimeout;

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
                if (_ws.readyState === 1) {
                    _ws.send(JSON.stringify({ t: subscriber[0], s: true }));
                }
            }
        });

        ws.on('ping', () => {
            heartbeat();
        });

        ws.on('close', () => {
            clearTimeout(pingTimeout);

            if (connTries > retries) {
                _log('unable to connect to ' + url);
                const error = new Error('Unable to connect to ' + url + ' after ' + retries + ' retries');

                if (typeof onError !== 'function') {
                    throw error;
                }

                return onError(error);
            }

            setTimeout(() => {
                _log('attempting to reconnect ' + connTries++);
                connect();
            }, 500);
        });

        ws.on('error', (error) => {
            _log(error.message);
        });

        ws.on('message', (data) => {
            data = JSON.parse(data);
            _log('message for ' + data.t);

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
        const receipt = { error: false };

        if (_ws.readyState === 0) {
            // hold messages while connecting
            setTimeout(() => {
                publish(topic, message, callback);
            }, 500);

            return false;
        }

        try {
            _ws.send(JSON.stringify({ t: topic, m: message }), (error) => {
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

    function subscribe(topic, callback) {
        if (typeof callback !== 'function') {
            throw new Error('A callback is required when subscribing to a topic');
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

    return {
        verbose: (verbose) => { _log = verbose; },
        publish: publish,
        subscribe: subscribe,
        unsubscribe: unsubscribe
    };
};
