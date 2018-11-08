var program = require('commander');
var pkg = require('./package.json');
var properties = require('properties');
var _ = require('lodash');
/* jshint ignore:start */
var WebSocket = require('./lib/logdna-websocket');
/* jshint ignore:end */
var got = require('got');
var input = require('./lib/input');
var semver = require('semver');
var os = require('os');
var qs = require('querystring');
var crypto = require('crypto');
var spawn = require('child_process').spawn;

var UPDATE_CHECK_URL = 'http://repo.logdna.com/PLATFORM/version';
var UPDATE_UPDATE_URL = 'http://repo.logdna.com/PLATFORM/logdna.gz';
var UPDATE_CHECK_INTERVAL = 86400000; // 1 day
var SSO_URL = 'https://logdna.com/sso/';
var SSO_POLL_INTERVAL = 5000; // 5s
var DEFAULT_CONF_FILE = '~/.logdna.conf'.replace('~', process.env.HOME || process.env.USERPROFILE);
var LOGDNA_APIHOST = process.env.LDAPIHOST || 'api.logdna.com';
var LOGDNA_APISSL = isNaN(process.env.USESSL) ? true : +process.env.USESSL;
var SUPPORTS_COLORS = /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM) && (!process.stdout || process.stdout.isTTY); // ensure console supports colors and not being piped

var EMAIL_REGEX = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
var ERROR_LEVEL_TEST = /[Ee]rr(?:or)?|ERR(?:OR)?|[Cc]rit(?:ical)?|CRIT(?:ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?/;
var WARN_LEVEL_TEST = /[Ww]arn(?:ing)?|WARN(?:ING)?/;

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, '-v, --version')
    .usage('[options] [commands]\n\n  This CLI duplicates useful functionality of the LogDNA web app.')
    // .description('This CLI duplicates useful functionality of the LogDNA web app.')
    .on('--help', function() {
        log('  Examples:');
        log();
        log('    $ logdna register user@example.com');
        log('    $ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d    # use this if you were assigned an Ingestion Key');
        log('    $ logdna tail \'("timed out" OR "connection refused") -request\'');
        log('    $ logdna tail -a access.log 500');
        log('    $ logdna tail -l error,warn');
        log();
    });

var ua = program._name + '-cli/' + pkg.version;

properties.parse(DEFAULT_CONF_FILE, { path: true }, function(error, config) {
    config = config || {};

    performUpgrade(config, function() {
        program.command('register [email] [key]')
            .description('Register a new LogDNA account. [key] is optional and will autogenerate')
            .action(function(email, key) {
                var nextstep = function(email) {
                    email = email.toLowerCase();
                    if (!EMAIL_REGEX.test(email)) {
                        return log('Invalid email address');
                    }

                    input.required('First name: ', function(firstname) {
                        input.required('Last name: ', function(lastname) {
                            input.required('Company/Organization: ', function(company) {
                                input.done();

                                key = (key || '').toLowerCase();
                                apiPost(config, 'register', {
                                    auth: false
                                    , email: email
                                    , key: key
                                    , firstname: firstname
                                    , lastname: lastname
                                    , company: company
                                }, function(body) {
                                    config.email = email;
                                    if (config.account !== body.account) {
                                        config.account = body.account;
                                        config.token = null;
                                        config.servicekey = null;
                                    }
                                    config.key = body.key;
                                    if (body.token) { config.token = body.token; } // save token if available

                                    if (body.servicekeys && body.servicekeys.length) {
                                        config.servicekey = body.servicekeys[0];
                                    }

                                    saveConfig(config, function() {
                                        log('Thank you for signing up! Your Ingestion Key is: ' + body.key + '. Saving credentials to local config.');
                                        log();
                                        log('Next steps:');
                                        log('===========');
                                        log('1) We\'ve sent you a welcome email to create your password. Once set, come back here and use \'logdna login\'');
                                        log('2) Type \'logdna install\' for more info on collecting your logs via our agent, syslog, Heroku, API, etc.');
                                        log();
                                        return;
                                    });
                                });
                            });
                        });
                    });
                };

                if (email) {
                    nextstep(email);
                } else {
                    input.required('Email: ', function(email) {
                        nextstep(email);
                    });
                }
            });

        program.command('ssologin')
            .description('Login to a LogDNA user account via Single Signon')
            .action(function() {
                var token = _.random(800000000, 4000000000).toString(16);
                var pollTimeout;

                log('To sign in via SSO, use a web browser to open the page ' + SSO_URL + token);

                var pollToken = function() {
                    apiPost(config, 'sso', { auth: false, token: token }, function(body) {
                        if (!body || !body.email) return;
                        clearTimeout(pollTimeout);

                        config.email = body.email;
                        if (body.accounts.length && config.account !== body.accounts[0]) {
                            config.account = body.accounts[0];
                            config.key = null;
                        }
                        if (body.keys && body.keys.length) { config.key = body.keys[0]; }
                        config.token = body.token;

                        if (body.servicekeys && body.servicekeys.length) {
                            config.servicekey = body.servicekeys[0];
                        }

                        saveConfig(config, function() {
                            log('Logged in successfully as: ' + body.email + '. Saving credentials to local config.');
                        });
                    });
                    pollTimeout = setTimeout(pollToken, SSO_POLL_INTERVAL);
                };
                pollToken(); // kick off polling
            });

        program.command('login [email]')
            .description('Login to a LogDNA user account')
            .action(function(email) {
                var nextstep = function(email) {
                    input.hidden('Password: ', function(password) {
                        input.done();

                        email = email.toLowerCase();
                        if (!EMAIL_REGEX.test(email)) {
                            return log('Invalid email address');
                        }

                        apiPost(config, 'login', { auth: email + ':' + password }, function(body) {
                            config.email = email;
                            if (body.accounts.length && config.account !== body.accounts[0]) {
                                config.account = body.accounts[0];
                                config.key = null;
                            }
                            if (body.keys && body.keys.length) { config.key = body.keys[0]; }
                            config.token = body.token;

                            if (body.servicekeys && body.servicekeys.length) {
                                config.servicekey = body.servicekeys[0];
                            }

                            saveConfig(config, function() {
                                log('Logged in successfully as: ' + email + '. Saving credentials to local config.');
                            });
                        });
                    });
                };

                if (email) {
                    nextstep(email);
                } else {
                    input.required('Email: ', function(email) {
                        nextstep(email);
                    });
                }
            });

        program.command('tail [query]')
            .description('Live tail with optional filtering. See \'logdna tail --help\'')
            .option('-d, --debug', 'Show debug level messages. Filtered by default')
            .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
            .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
            .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
            .option('-j, --json', 'if true, output raw json', false)
            .action(function(query, options) {
                var params = authParams(config);
                params.q = query || '';

                if (!options.debug) {
                    params.q += ' level:-debug';
                }

                if (options.hosts) {
                    params.hosts = options.hosts.replace(/, /g, ',');
                }

                if (options.apps) {
                    params.apps = options.apps.replace(/, /g, ',');
                }

                if (options.levels) {
                    params.levels = options.levels.replace(/, /g, ',');
                }

                if (options.json) {
                    params.json = true;
                }

                params.q = params.q.trim();

                var ws = new WebSocket((LOGDNA_APISSL ? 'https://' : 'http://') + LOGDNA_APIHOST + '/ws/tail?' + qs.stringify(params));

                ws.on('open', function open() {
                    log('tail started. hosts: ' + (options.hosts || 'all') +
                        '. apps: ' + (options.apps || 'all') +
                        '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                        '. query: ' + (query || 'none'));
                });

                ws.on('reconnecting', function(num) {
                    log('tail reconnect attmpt #' + num + '...');
                });

                ws.on('message', function(data) {
                    if (data.substring(0, 1) === '{') {
                        data = JSON.parse(data);
                    } else {
                        log('Malformed line: ' + data);
                        return;
                    }

                    if (Array.isArray(data.p)) {
                        _.each(data.p, function(line) {
                            renderLine(line, params);
                        });

                    } else {
                        renderLine(data.p, params);
                    }
                });

                ws.on('error', function(err) {
                    err = err.toString();
                    if (err.indexOf('401') > -1) {
                        // invalid token
                        log('Access token invalid. If you created or changed your password recently, please \'logdna login\' again. Type \'logdna --help\' for more info.');
                        return process.exit();
                    }

                    log('Error: ' + err);
                });

                ws.on('close', function() {
                    log('tail lost connection');
                });
            });

        program.command('switch')
            .description('Switch between multiple accounts if your login has access to more than one')
            .action(function(options) {
                apiGet(config, 'orgs', {}, function(body) {
                    body = JSON.parse(body);
                    if (!body || (body.length && body.length < 2)) {
                        log('Your login ' + config.email + ' doesn\'t belong to other accounts. Ensure the other owner has added your email.');
                        return;
                    }
                    for (var i = 0; i < body.length; i++) {
                        log((i + 1) + ': ' + body[i].name + (body[i].id === config.account ? ' (active)' : ''));
                    }
                    input.required('Choose account [1-' + body.length + ']: ', function(selection) {
                        input.done();
                        selection = parseInt(selection);
                        selection = selection - 1;
                        if (selection >= body.length || selection < 0) {
                            log('Not a valid number.');
                            return;
                        }
                        config.account = body[selection].id;
                        config.servicekey = body[selection].servicekeys[0];
                        saveConfig(config, function() {
                            log('Successfully switched account to ' + body[selection].name);
                        });
                    });
                });
            });

        program.command('search [query]')
            .description('Limited search functionality with optional filtering (beta). See \'logdna search --help\'')
            .option('-d, --debug', 'Show debug level messages. Filtered by default')
            .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
            .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
            .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
            .option('-n, --number <number>', 'Set how many lines to request')
            .option('--prefer-head', 'Get lines from the beginning of the interval rather than the end')
            .option('--next', 'Get next chunk of lines (after last search). This is a convenience wrapper around the --from and --to parameters.')
            .option('-f, --from <from>', 'Unix timestamp of beginning of search timeframe.')
            .option('-t, --to <to>', 'Unix timestamp of end of search timeframe.')
            .option('-j, --json', 'if true, output raw json', false)
            .action(function(query, options) {
                var params = {
                    query: query || ''
                };

                if (!options.debug) {
                    params.query += ' level:-debug';
                }

                if (options.preferHead) {
                    params.prefer = 'head';
                }

                if (options.from) {
                    try {
                        params.from = new Date(options.from).getTime();
                    } catch (err) {
                    }
                }

                if (options.to) {
                    try {
                        params.to = new Date(options.to).getTime();
                    } catch (err) {
                    }
                }

                if (options.next) {
                    // use last search timestamps to get next block of results
                    if (config.last_timestamp) {
                        if (options.preferHead) {
                            params.from = new Date(config.last_timestamp).getTime();
                        } else {
                            params.to = new Date(config.last_timestamp).getTime();
                        }
                    }
                }

                if (options.number) {
                    try {
                        params.size = parseInt(options.number);
                    } catch (err) {
                    }
                }

                if (options.json) {
                    params.json = true;
                }

                if (options.hosts) {
                    params.hosts = options.hosts.replace(/, /g, ',');
                }

                if (options.apps) {
                    params.apps = options.apps.replace(/, /g, ',');
                }

                if (options.levels) {
                    params.levels = options.levels.replace(/, /g, ',');
                }

                if (config.servicekey) {
                    params.servicekey = config.servicekey;
                }

                var modifiedconfig = JSON.parse(JSON.stringify(config));

                // this prevents export API from emailing the results
                delete modifiedconfig.email;

                var t, t2, range;

                apiGet(modifiedconfig, 'v1/export', params, function(body) {
                    if (body.range && body.range.from && body.range.to) {
                        t = new Date(body.range.from);
                        t2 = new Date(body.range.to);
                        range = ' between ' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
                            '-' + t2.toString().substring(4, 11) + t2.toString().substring(16, 24);
                    }
                    if (typeof body === 'string') {
                        body = body.split('\n');
                        body = body.map(x => {
                            try { return JSON.parse(x); } catch (err) { return 0; }
                        });
                        body = _.compact(body);
                    }


                    log('search finished: ' + body.length + ' line(s)' + (range || '') +
                        '. hosts: ' + (options.hosts || 'all') +
                        '. apps: ' + (options.apps || 'all') +
                        '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                        '. query: ' + (query || 'none'));

                    if (!(body && body.length)) {
                        log('Query returned no lines.');
                        return;
                    }
                    var last_timestamp = new Date(body[0]._ts);

                    _.each(body, function(line) {
                        t = new Date(line._ts);
                        if (options.preferHead) {
                            if (last_timestamp < t) {
                                last_timestamp = t;
                            }
                        } else {
                            if (last_timestamp > t) {
                                last_timestamp = t;
                            }
                        }

                        renderLine(line, params);
                    });

                    config.last_timestamp = last_timestamp.toJSON();
                    saveConfig(config);
                });
            });

        program.command('heroku <heroku-app-name>')
            .description('Generates a Heroku Drain URL for log shipping to LogDNA')
            .action(function(app) {
                if (!config.token) {
                    return log('Please login first. Type \'logdna login\' or \'logdna --help\' for more info.');
                }

                log('Use the following Heroku CLI command to start log shipping:');
                log('heroku drains:add https://' + config.account + ':' + (config.key || 'YOUR_INGESTION_KEY_HERE') + '@heroku.logdna.com/heroku/logplex?app=' + app + ' --app ' + app);
                log();
                log('Once shipping begins, you can tail using \'logdna tail -h ' + app + '\'');

            });

        program.command('install [os]')
            .description('Instructions for collecting logs from staging/production hosts and systems')
            .action(function(os) {
                try {
                    log(require('./install')[os].replace(/ZZZZZZZZ/g, (config.key || 'YOUR_INGESTION_KEY_HERE')));
                } catch (e) {
                    log('Try one of the following:');
                    log('logdna install deb            # Debian/Ubuntu/Linux Mint');
                    log('logdna install rpm            # CentOS/Amazon Linux/Red Hat/Enterprise Linux');
                    log('logdna install windows        # Windows Server');
                    log('logdna install mac            # macOS Server');
                    log('logdna install heroku         # Heroku Elements marketplace add-on');
                    log('logdna install heroku-drains  # Heroku drains');
                    log('logdna install syslog         # rsyslog/syslog-ng/syslog');
                    log('logdna install k8s            # Kubernetes Cluster');
                    log('logdna install docker         # Docker');
                    log('logdna install api            # REST-based ingestion API');
                    log('logdna install nodejs         # Node.js library');
                    log();
                }
            });

        program.command('info')
            .alias('whoami')
            .description('Show current logged in user info')
            .action(function() {
                apiGet(config, 'info', function(body) {
                    log(body);
                });
            });

        program.command('update')
            .description('Update CLI to latest version')
            .action(function() {
                performUpgrade(config, true, function() {
                    log('No update available. You have the latest version: ' + pkg.version);
                });
            });

        // helper for tail/search -h due to -h conflict for --hosts
        if (process.argv && process.argv.length === 4 && ['tail', 'search'].indexOf(process.argv[2]) >= 0 && process.argv[3] === '-h') {
            process.argv[3] = '--help';
        }

        program.parse(process.argv);
        if (!process.argv.slice(2).length) return program.outputHelp(); // show help if no commands given
    });
});

function apiGet(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'get', params, callback);
}

function apiPost(config, endpoint, params, callback) {
    apiCall(config, endpoint, 'post', params, callback);
}

function apiCall(config, endpoint, method, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    var opts = { headers: { 'user-agent': ua }};
    if (params && params.auth !== undefined) {
        if (params.auth) { opts.auth = params.auth; }
        delete params.auth;
        opts.query = params;

    } else {
        var hmacParams = authParams(config);
        params = _.extend(params || {}, hmacParams);
        opts.query = params;
    }

    if (method === 'post') { opts.method = 'post'; }

    got((LOGDNA_APISSL ? 'https://' : 'http://') + LOGDNA_APIHOST + '/' + endpoint, opts)
        .then(res => {
            if (res.body && res.body.substring(0, 1) === '{') {
                try {
                    var result = JSON.parse(res.body);
                    return callback(result);
                } catch (err) {
                    // procedure for jsonl format
                    return callback(res.body);
                }
            }
            callback(res.body);
        })
        .catch(err => {
            if (err.statusCode === '403') {
                return log('Access token invalid. If you created or changed your password recently, please \'logdna login\' again. Type \'logdna --help\' for more info.');
            } else {
                return log('Error ' + err.statusCode + ': ' + err.response.body);
            }
        });
}

function renderLine(line, params) {
    var t = new Date(line._ts);
    params = params || {};

    if (params.json) {
        var buf = JSON.stringify(line);
        console.log(buf);
        return;
    }

    if (SUPPORTS_COLORS) {
        log('\x1b[38;5;240m' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
            ' \x1b[38;5;166m' + line._host +
            ' \x1b[38;5;74m' + line._app +
            ' ' + (line.level ? levelColor(line.level) + ' ' + line.level + ' \x1b[0m ' : '') +
            '\x1b[38;5;246m' + line._line +
            '\x1b[0m');

    } else {
        log(t.toString().substring(4, 11) + t.toString().substring(16, 24) +
            ' ' + line._host +
            ' ' + line._app +
            ' ' + (line.level ? '[' + line.level + '] ' : '') +
            line._line);
    }
}

function levelColor(level) {
    if (ERROR_LEVEL_TEST.test(level)) {
        return '\x1b[38;5;255;48;5;203m';
    } else if (WARN_LEVEL_TEST.test(level)) {
        return '\x1b[38;5;255;48;5;208m';
    } else {
        return '\x1b[38;5;247;48;5;239m';
    }
}

function authParams(config) {
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
}

function performUpgrade(config, force, callback) {
    if (typeof force === 'function') {
        callback = force;
        force = null;
    }
    if (force || Date.now() - (config.updatecheck || 0) > UPDATE_CHECK_INTERVAL) {
        if (os.platform() === 'darwin') {
            UPDATE_CHECK_URL = UPDATE_CHECK_URL.replace('PLATFORM', 'mac');
            UPDATE_UPDATE_URL = UPDATE_UPDATE_URL.replace('PLATFORM', 'mac');

        } else if (os.platform() === 'linux') {
            UPDATE_CHECK_URL = UPDATE_CHECK_URL.replace('PLATFORM', 'linux');
            UPDATE_UPDATE_URL = UPDATE_UPDATE_URL.replace('PLATFORM', 'linux');

        } else if (os.platform() === 'win32') {
            // UPDATE_CHECK_URL = UPDATE_CHECK_URL.replace("PLATFORM", "windows");
            // UPDATE_UPDATE_URL = UPDATE_UPDATE_URL.replace("PLATFORM", "windows");
            return callback && callback(); // ignore for now until this works
        }

        if (force) { log('Checking for updates...'); }
        var force_timeout_ms = 30000;
        var default_timeout_ms = 2500;
        got(UPDATE_CHECK_URL, { timeout: (force ? force_timeout_ms : default_timeout_ms) })
            .then(res => {
                if (res.body) { res.body = res.body.replace(/\r/g, '').replace(/\n/g, ''); }
                if (!semver.valid(res.body)) {
                    // error during update check, set to check again in a day
                    config.updatecheck = Date.now() - UPDATE_CHECK_INTERVAL + 86400000;
                    saveConfig(config);
                    return callback && callback();
                }

                config.updatecheck = Date.now();
                saveConfig(config);

                if (semver.gt(res.body, pkg.version)) {
                    // update needed
                    log('Performing upgrade from ' + pkg.version + ' to ' + res.body + '...');
                    var shell = spawn('/bin/bash', ['-c'
                        , 'if [[ ! -z $(which curl) ]]; then curl -so /tmp/logdna.gz ' + UPDATE_UPDATE_URL + '; elif [[ ! -z $(which wget) ]]; then wget -qO /tmp/logdna.gz ' + UPDATE_UPDATE_URL + '; fi; gunzip -f /tmp/logdna.gz; cp -f /tmp/logdna /usr/local/logdna/bin/logdna; chmod 777 /usr/local/logdna/bin/logdna 2> /dev/null; echo -n "Successfully upgraded logdna-cli to "; /usr/local/bin/logdna -v'
                    ], { stdio: 'inherit' });
                    shell.on('close', function() {
                        if (!force && process.argv[process.argv.length - 1].toLowerCase() !== 'update') {
                            log('Please run your command again');
                        }
                    });
                    return;

                } else {
                    // no update necessary, run rest of program
                    return callback && callback();
                }
            })
            .catch(err => {
                return log('Error ' + err.statusCode + ': ' + err.response.body);
            });

    } else {
        // no check necessary, run rest of program
        return callback && callback();
    }
}

function saveConfig(config, callback) {
    properties.stringify(config, {
        path: DEFAULT_CONF_FILE
    }, function(err) {
        if (err) {
            console.error('Error while saving to: ' + (DEFAULT_CONF_FILE) + ': ' + err);
        } else {
            return callback && callback();
        }
    });
}

function generateHmac(payload, secret) {
    var msg = qs.stringify(payload);
    return crypto.createHmac('sha256', secret.toString()).update(msg).digest('hex');
}

function log(msg) {
    console.log(msg || '');
}
