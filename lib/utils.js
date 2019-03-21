// External Libraries:
const qs = require('querystring');
const crypto = require('crypto');
const os = require('os');
const properties = require('properties');
const request = require('request');
const semver = require('semver');
const spawn = require('child_process').spawn;

// Constants:
const pkg = require('../package.json');
const ua = 'logdna-cli/' + pkg.version;
const ERROR_LEVEL_TEST = /[Ee]rr(?:or)?|ERR(?:OR)?|[Cc]rit(?:ical)?|CRIT(?:ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?/;
const WARN_LEVEL_TEST = /[Ww]arn(?:ing)?|WARN(?:ING)?/;

const saveConfig = function(config, callback) {
    properties.stringify(config, {
        path: config.DEFAULT_CONF_FILE
    }, function(err) {
        if (err) {
            return callback(`Error in Saving ${JSON.stringify(config)} into: ${config.DEFAULT_CONF_FILE}: ${err}`);
        }
        return callback(null, true);
    });
};

const log = function(msg, config) {
    try {
        console.log(msg || '');
    } catch (e) {
        if (config) {
            saveConfig(config, function(error, result) {
                if (error) {
                    console.error(error);
                }
                return process.exit(0);
            });
        }
    }
};

function generateHmac(payload, secret) {
    var msg = qs.stringify(payload);
    return crypto.createHmac('sha256', secret.toString()).update(msg).digest('hex');
};

const authParams = function(config) {
    if (!config.token) {
        log('Please login first. Type \'logdna login\' or \'logdna --help\' for more info.');
        return process.exit();
    }

    var hmacParams = {
        email: config.email
        , id: config.account
        , ts: Date.now()
    };

    hmacParams.hmac = generateHmac(hmacParams, config.token);
    return hmacParams;
};

function apiCall(config, endpoint, method, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    var opts = {
        headers: {
            'user-agent': ua
        }
    };

    if (params && params.auth !== undefined) {
        if (params.auth) {
            opts.auth = {
                user: params.auth.substring(0, params.auth.indexOf(':'))
                , pass: params.auth.substring(params.auth.indexOf(':') + 1)
            };
        }
        delete params.auth;
    } else {
        var hmacParams = authParams(config);
        params = Object.assign(params || {}, hmacParams);
    }

    opts.qs = params;

    if (method === 'post') {
        opts.method = 'post';
    }

    opts.url = (config.LOGDNA_APISSL ? 'https://' : 'http://') + config.LOGDNA_APIHOST + '/' + endpoint;

    request(opts, (error, response, body) => {
        if (error) {
            if (response && response.statusCode.toString() === '403') {
                return callback('Access token invalid. If you created or changed your password recently, please \'logdna login\' again. Type \'logdna --help\' for more info.');
            }
            return callback('ERROR: ' + error);
        }

        if (body && body.substring(0, 1) === '{') {
            try {
                return callback(null, JSON.parse(body));
            } catch (err) {
                // procedure for jsonl format
                return callback(null, body);
            }
        }

        return callback(null, body);
    });
};

function levelColor(config, level) {
    if (ERROR_LEVEL_TEST.test(level)) {
        return '\x1b[38;5;255;48;5;203m';
    }

    if (WARN_LEVEL_TEST.test(level)) {
        return '\x1b[38;5;255;48;5;208m';
    }

    return '\x1b[38;5;247;48;5;239m';
};

const apiGet = function(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'get', params, callback);
};

const apiPost = function(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'post', params, callback);
};

const renderLine = function(config, line, params) {

    var t = new Date(line._ts);
    params = params || {};

    if (params.json) {
        return log(JSON.stringify(line));
    }

    if (config.SUPPORTS_COLORS) {
        log('\x1b[38;5;240m' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
            ' \x1b[38;5;166m' + line._host +
            ' \x1b[38;5;74m' + line._app +
            ' ' + (line.level ? levelColor(config, line.level) + ' ' + line.level + ' \x1b[0m ' : '') +
            '\x1b[38;5;246m' + (line.message || line._line) +
            '\x1b[0m', config);
    } else {
        log(t.toString().substring(4, 11) + t.toString().substring(16, 24) +
            ' ' + line._host +
            ' ' + line._app +
            ' ' + (line.level ? '[' + line.level + '] ' : '') +
            (line.message || line._line), config);
    };
};

const performUpgrade = function(config, force, callback) {
    if (typeof force === 'function') {
        callback = force;
        force = false;
    }

    console.log(config);

    if (force || Date.now() - (config.updatecheck || 0) > config.UPDATE_CHECK_INTERVAL) {
        if (os.platform() === 'darwin') {
            config.VERSION_CHECK_URL = config.VERSION_CHECK_URL.replace('PLATFORM', 'mac');
            config.UPDATE_CHECK_URL = config.UPDATE_CHECK_URL.replace('PLATFORM', 'mac');

        } else if (os.platform() === 'linux') {
            config.VERSION_CHECK_URL = config.VERSION_CHECK_URL.replace('PLATFORM', 'linux');
            config.UPDATE_CHECK_URL = config.UPDATE_CHECK_URL.replace('PLATFORM', 'linux');

        } else if (os.platform() === 'win32') {
            // config.VERSION_CHECK_URL = config.VERSION_CHECK_URL.replace("PLATFORM", "windows");
            // config.UPDATE_CHECK_URL = config.UPDATE_CHECK_URL.replace("PLATFORM", "windows");
            return callback(); // ignore for now until this works
        }

        if (force) {
            log('Checking for updates...');
        }

        request.get(config.VERSION_CHECK_URL, {
            timeout: (force ? config.FORCE_TIMEOUT : config.DEFAULT_TIMEOUT)
        }, (error, response, body) => {

            if (error) {
                return log('Error ' + response.statusCode + ': ' + error);
            }

            if (body) {
                body = body.replace(/\r/g, '').replace(/\n/g, '');
            }

            if (!semver.valid(body)) {
                config.updatecheck = Date.now() - config.UPDATE_CHECK_INTERVAL + 86400000;
                return saveConfig(config, function(error, success) {
                    if (error) {
                        return log(error) && callback(error);
                    }
                    return callback();
                });
            };

            config.updatecheck = Date.now();

            saveConfig(config, function(error, success) {
                if (error) {
                    return log(error);
                }
            });

            if (semver.gt(body, pkg.version)) {
                // update needed
                log(`Performing upgrade from ${pkg.version} to ${body}...`);

                var shell = spawn('/bin/bash', ['-c'
                    , 'if [[ ! -z $(which curl) ]]; then curl -so /tmp/logdna.gz ' + config.UPDATE_CHECK_URL + '; elif [[ ! -z $(which wget) ]]; then wget -qO /tmp/logdna.gz ' + config.UPDATE_CHECK_URL + '; fi; gunzip -f /tmp/logdna.gz; cp -f /tmp/logdna /usr/local/logdna/bin/logdna; chmod 777 /usr/local/logdna/bin/logdna 2> /dev/null; echo -n "Successfully upgraded logdna-cli to "; /usr/local/bin/logdna -v'
                ], {
                    stdio: 'inherit'
                });

                shell.on('close', function() {
                    if (!force && process.argv[process.argv.length - 1].toLowerCase() !== 'update') {
                        log('Please run your command again');
                    }
                });

                return;
            }
        });
    }

    return callback(); // no check necessary, run rest of program
};

exports.saveConfig = saveConfig;
exports.log = log;
exports.apiGet = apiGet;
exports.apiPost = apiPost;
exports.renderLine = renderLine;
exports.authParams = authParams;
exports.performUpgrade = performUpgrade;
