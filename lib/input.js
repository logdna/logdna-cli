const readline = require('readline');

var rl;

const init = function() {
    rl = readline.createInterface({
        input: process.stdin
        , output: process.stdout
    });
};

const required = exports.required = function(query, callback) {
    if (!rl) {
        init();
    }

    function ask() {
        rl.question(query, function(value) {
            if (!value.trim()) {
                return ask();
            }
            callback(value);
        });
    }
    ask();
};

exports.hidden = function(query, callback) {
    if (!rl) {
        init();
    }
    var stdin = process.openStdin();
    process.stdin.on('data', function(char) {
        char = char + '';
        switch (char) {
            case '\n':
            case '\r':
            case '\u0004':
                if (rl.line.length > 0) {
                    stdin.pause();
                }
                break;
            default:
                process.stdout.write('\x1B\x5B\x32\x4B\x1B\x5B\x32\x30\x30\x44' + query + Array(rl.line.length + 1).join('*')); // eslint-disable-line
                break;
        }
    });

    required(query, function(value) {
        rl.history = rl.history.slice(1);
        callback(value);
    });
};

exports.done = function() {
    rl.close();
};
