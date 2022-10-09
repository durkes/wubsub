const WebSocket = require('ws');

module.exports = function ({ url = 'ws://localhost:3000/', retries = 10 }, onError) {
    let _log = () => false;
    let _ws = { readyState: 0 };
    let connTries = 1;

    function connect() {
        const ws = new WebSocket(url);
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
            _ws = ws;
            connTries = 1;

            _log('connected to ' + url);
            heartbeat();
        });

        ws.on('ping', () => {
            heartbeat();
        });

        ws.on('close', () => {
            clearTimeout(pingTimeout);

            if (connTries > retries) {
                _log('unable to connect to ' + url);
                return onError(new Error('Unable to connect to ' + url + ' after ' + retries + ' retries'));
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
        });
    }
    connect();

    function publish(topic, message, callback) {
        callback = callback || function () { };
        let receipt = { error: false };

        if (_ws.readyState === 0) {
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

    return {
        verbose: (verbose) => { _log = verbose; },
        publish: publish,
        subscribe: () => { },
        unsubscribe: () => { }
    };
};
