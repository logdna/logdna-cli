var readline = require('readline');

var rl;

var init = function() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
};

var required = exports.required = function(query, callback) {
    if (!rl) { init(); }
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
    if (!rl) { init(); }
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
                process.stdout.write('\033[2K\033[200D' + query + Array(rl.line.length + 1).join('*'));
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
