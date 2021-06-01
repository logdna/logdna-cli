// External Modules
const crypto = require('crypto');
const os = require('os');
const properties = require('properties');
const qs = require('querystring');
const request = require('request');
const semver = require('semver');
const spawn = require('child_process').spawn;

// Internal Modules
const pkg = require('../package.json');

// Configuration
const sys_config = require('./config');
const dev_config = (sys_config.DEV) ? require('./dev_config') : null; // Use config.js to turn developer logging on and off

// Constants
const CLI_USER_AGENT = 'logdna-cli/' + pkg.version;
const ERROR_LEVEL_TEST = /[Ee]rr(?:or)?|ERR(?:OR)?|[Cc]rit(?:ical)?|CRIT(?:ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?/;
const WARN_LEVEL_TEST = /[Ww]arn(?:ing)?|WARN(?:ING)?/;
const FORCE_UPDATE_TIMEOUT = 30000;
const DEFAULT_UPDATE_TIMEOUT = 2500;

const saveConfig = function(config, callback) {
    properties.stringify(config, {
        path: config.DEFAULT_CONF_FILE
    }, function(err) {
        if (err) return callback('Error while saving to: ' + (config.DEFAULT_CONF_FILE) + ': ' + err);
        return callback(null, true);
    });
};

const uiDisp = function(msg, config, level) {
    try {
        if (level === 'error') {
            console.error(msg || '');
        } else {
            console.log(msg || '');
        }
    } catch (e) {
        if (config) {
            saveConfig(config, (error, result) => {
                if (error) console.error(error);
                return process.exit(0);
            });
        }
    }
};

function generateHmac(payload, secret) {
    let msg = qs.stringify(payload);
    return crypto.createHmac('sha256', secret.toString()).update(msg).digest('hex');
};

const authParams = function(config) {
    if (!config.token) {
        uiDisp('Please login first. Type \'logdna login\' or \'logdna --help\' for more info.');
        return process.exit();
    }

    let hmacParams = {
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

    let opts = {
        method: method
        , headers: {
            'content-type': 'application/json'
            , 'user-agent': CLI_USER_AGENT
        }
    };

    params = params || {};
    if (params.auth === false) { // Don't use auth (i.e. for login, register)
        delete params.auth;
    } else if (typeof params.auth === 'string') { // Use HTTP auth
        if (params.auth) {
            const [user, pass] = params.auth.split(':');
            opts.auth = { user, pass };
        }
        delete params.auth;
    } else { // Use HMAC token stored in config
        const hmacParams = authParams(config);
        opts.qs = hmacParams;
    }

    opts.url = (config.LOGDNA_APISSL ? 'https://' : 'http://') + config.LOGDNA_APIHOST + '/' + endpoint;
    if (method === 'get') {
        opts.qs = Object.assign(opts.qs || {}, params);
    } else {
        opts.body = JSON.stringify(params);
    }

    request(opts, (error, response, body) => {
        try {
            body = JSON.parse(body);
        } catch (err) {
            // Keep the body as is
        }

        if (error || body.error) {
            if (response && response.statusCode === 403) {
                return callback('Access token invalid. If you created or changed your password recently, ' +
                                'please run \'logdna login\' again. Type \'logdna --help\' for more info.');
            }

            return callback(`Error: ${error || body.error}`);
        }

        callback(null, body);
    });
};

function levelColor(config, level) {
    if (ERROR_LEVEL_TEST.test(level)) return '\x1b[38;5;255;48;5;203m';
    if (WARN_LEVEL_TEST.test(level)) return '\x1b[38;5;255;48;5;208m';
    return '\x1b[38;5;247;48;5;239m';
};

const apiGet = function(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'get', params, callback);
};

const apiPost = function(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'post', params, callback);
};

const renderLine = function(config, line, params) {
    // ignore bad payloads
    if (!line._host) return;

    let t = new Date(line._ts);
    params = params || {};

    if (params.json) return uiDisp(JSON.stringify(line));

    if (config.SUPPORTS_COLORS) {
        uiDisp('\x1b[38;5;240m' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
            ' \x1b[38;5;166m' + line._host +
            ' \x1b[38;5;74m' + line._app +
            ' ' + (line.level ? levelColor(config, line.level) + ' ' + line.level + ' \x1b[0m ' : '') +
            '\x1b[38;5;246m' + (line.message || line._line) +
            '\x1b[0m', config);
    } else {
        uiDisp(t.toString().substring(4, 11) + t.toString().substring(16, 24) +
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

    const updateCheckIntervalPassed = Date.now() - (config.updatecheck || 0) > config.UPDATE_CHECK_INTERVAL;
    const shouldUpdate = force || updateCheckIntervalPassed;
    if (!shouldUpdate) {
        return callback(); // no check necessary, run rest of program
    } else {
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

        if (force) { uiDisp('Checking for updates...'); }
        const timeout = force ? FORCE_UPDATE_TIMEOUT : DEFAULT_UPDATE_TIMEOUT;
        request.get(config.VERSION_CHECK_URL, { timeout }, (error, response, body) => {
            if (error) {
                return uiDisp(`Error${response ? ' [' + response.statusCode + ']' : ''}: ${error}`);
            }

            if (body) { body = body.replace(/\r/g, '').replace(/\n/g, ''); }

            if (!semver.valid(body)) {
                config.updatecheck = Date.now() - config.UPDATE_CHECK_INTERVAL + 86400000;
                return saveConfig(config, function(error, success) {
                    if (error) return uiDisp(error) && callback(error);
                    return callback();
                });
            };

            config.updatecheck = Date.now();
            saveConfig(config, function(error, success) {
                if (error) return uiDisp(error);
            });

            if (semver.gt(body, pkg.version)) {
                // update needed
                uiDisp('Performing upgrade from ' + pkg.version + ' to ' + body + '...');
                let shell = spawn('/bin/bash', ['-c'
                    , 'if [[ ! -z $(which curl) ]]; then curl -so /tmp/logdna.gz ' + config.UPDATE_CHECK_URL + '; elif [[ ! -z $(which wget) ]]; then wget -qO /tmp/logdna.gz ' + config.UPDATE_CHECK_URL + '; fi; gunzip -f /tmp/logdna.gz; cp -f /tmp/logdna /usr/local/logdna/bin/logdna; chmod 777 /usr/local/logdna/bin/logdna 2> /dev/null; echo -n "Successfully upgraded logdna-cli to "; /usr/local/bin/logdna -v'
                ], {
                    stdio: 'inherit'
                });

                shell.on('close', function() {
                    if (!force && process.argv[process.argv.length - 1].toLowerCase() !== 'update') uiDisp('Please run your command again');
                });

                return;
            } else {
                return callback(); // no update necessary, run rest of program
            }
        });
    }
};

let module_exports = {
    apiGet
    , apiPost
    , authParams
    , uiDisp
    , performUpgrade
    , renderLine
    , saveConfig
};

module.exports = module_exports;
