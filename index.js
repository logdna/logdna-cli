#!/usr/bin/env node
const _ = require('lodash');
const program = require('commander');
const properties = require('properties');
const got = require('got');
const semver = require('semver');
const os = require('os');
const qs = require('querystring');
const crypto = require('crypto');
const spawn = require('child_process').spawn;

const pkg = require('./package.json');
/* jshint ignore:start */
const WebSocket = require('./lib/logdna-websocket');
/* jshint ignore:end */
const input = require('./lib/input');
const utils = require('./lib/utils');

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, '-v, --version')
    .usage('[options] [commands]\n\n  This CLI duplicates useful functionality of the LogDNA web app.')
    // .description('This CLI duplicates useful functionality of the LogDNA web app.')
    .on('--help', function() {
        utils.log('  Examples:');
        utils.log();
        utils.log('    $ logdna register user@example.com');
        utils.log('    $ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d    # use this if you were assigned an Ingestion Key');
        utils.log('    $ logdna tail \'("timed out" OR "connection refused") -request\'');
        utils.log('    $ logdna tail -a access.log 500');
        utils.log('    $ logdna tail -l error,warn');
        utils.log('    $ logdna search "logdna" -a logdna.log 300');
        utils.log('    $ logdna search "logdna" -f 1541100040931 -t 1541102940000');
        utils.log('    $ logdna login user@example.com');
        utils.log('    $ logdna install syslog');
        utils.log('    $ logdna install k8s');
        utils.log('    $ logdna info');
        utils.log('    $ logdna update');
        utils.log();
    });

properties.parse(require('./lib/config').DEFAULT_CONF_FILE, {
    path: true
}, function(error, parsedConfig) {
    const config = _.merge(require('./lib/config'), parsedConfig || {});

    utils.performUpgrade(config, function() {
        program.command('register [email] [key]')
            .description('Register a new LogDNA account. [key] is optional and will autogenerate')
            .action(function(email, key) {
                var nextstep = function(email) {
                    email = email.toLowerCase();

                    if (!(new RegExp(config.EMAIL_REGEX)).test(email)) return utils.log('Invalid email address');

                    input.required('First name: ', function(firstname) {
                        input.required('Last name: ', function(lastname) {
                            input.required('Company/Organization: ', function(company) {
                                input.done();

                                key = (key || '').toLowerCase();
                                utils.apiPost(config, 'register', {
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

                                    if (body.token) config.token = body.token; // save token if available

                                    if (body.servicekeys && body.servicekeys.length) config.servicekey = body.servicekeys[0];

                                    utils.saveConfig(config, function() {
                                        utils.log('Thank you for signing up! Your Ingestion Key is: ' + body.key + '. Saving credentials to local config.');
                                        utils.log();
                                        utils.log('Next steps:');
                                        utils.log('===========');
                                        utils.log('1) We\'ve sent you a welcome email to create your password. Once set, come back here and use \'logdna login\'');
                                        utils.log('2) Type \'logdna install\' for more info on collecting your logs via our agent, syslog, Heroku, API, etc.');
                                        utils.log();
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

                var pollToken = function() {
                    utils.apiPost(config, 'sso', {
                        auth: false
                        , token: token
                    }, function(body) {
                        if (!body || !body.email) return;
                        clearTimeout(pollTimeout);

                        config.email = body.email;
                        if (body.accounts.length && config.account !== body.accounts[0]) {
                            config.account = body.accounts[0];
                            config.key = null;
                        }
                        if (body.keys && body.keys.length) config.key = body.keys[0];
                        config.token = body.token;

                        if (body.servicekeys && body.servicekeys.length) config.servicekey = body.servicekeys[0];

                        utils.saveConfig(config, function() {
                            utils.log('Logged in successfully as: ' + body.email + '. Saving credentials to local config.');
                        });
                    });
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

                        if (!(new RegExp(config.EMAIL_REGEX)).test(email)) return utils.log('Invalid email address');

                        utils.apiPost(config, 'login', {
                            auth: email + ':' + password
                        }, function(body) {
                            config.email = email;
                            if (body.accounts.length && config.account !== body.accounts[0]) {
                                config.account = body.accounts[0];
                                config.key = null;
                            }
                            if (body.keys && body.keys.length) config.key = body.keys[0];
                            config.token = body.token;

                            if (body.servicekeys && body.servicekeys.length) config.servicekey = body.servicekeys[0];

                            utils.saveConfig(config, function() {
                                utils.log('Logged in successfully as: ' + email + '. Saving credentials to local config.');
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
                var params = utils.authParams(config);
                params.q = query || '';

                if (!options.debug) params.q += ' level:-debug';
                if (options.hosts) params.hosts = options.hosts.replace(/, /g, ',');
                if (options.apps) params.apps = options.apps.replace(/, /g, ',');
                if (options.levels) params.levels = options.levels.replace(/, /g, ',');
                if (options.json) params.json = true;

                params.q = params.q.trim();

                var ws = new WebSocket((config.LOGDNA_APISSL ? 'https://' : 'http://') + config.LOGDNA_TAILHOST + '/ws/tail?' + qs.stringify(params));

                ws.on('open', function open() {
                    utils.log('tail started. hosts: ' + (options.hosts || 'all') +
                        '. apps: ' + (options.apps || 'all') +
                        '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                        '. query: ' + (query || 'none'));
                });

                ws.on('reconnecting', function(num) {
                    utils.log('tail reconnect attmpt #' + num + '...');
                });

                ws.on('message', function(data) {
                    if (data.substring(0, 1) === '{') {
                        data = JSON.parse(data);
                    } else return utils.log('Malformed line: ' + data);


                    if (Array.isArray(data.p)) {
                        _.each(data.p, function(line) {
                            utils.renderLine(config, line, params);
                        });

                    } else utils.renderLine(config, data.p, params);
                });

                ws.on('error', function(err) {
                    err = err.toString();
                    if (err.indexOf('401') > -1) {
                        // invalid token
                        utils.log('Access token invalid. If you created or changed your password recently, please \'logdna login\' again. Type \'logdna --help\' for more info.');
                        return process.exit();
                    }

                    utils.log('Error: ' + err);
                });

                ws.on('close', function() {
                    utils.log('tail lost connection');
                });
            });

        program.command('switch')
            .description('Switch between multiple accounts if your login has access to more than one')
            .action(function(options) {
                utils.apiGet(config, 'orgs', {}, function(body) {
                    body = JSON.parse(body);
                    if (!body || (body.length && body.length < 2)) return utils.log('Your login ' + config.email + ' doesn\'t belong to other accounts. Ensure the other owner has added your email.');

                    for (var i = 0; i < body.length; i++) utils.log((i + 1) + ': ' + body[i].name + (body[i].id === config.account ? ' (active)' : ''));

                    input.required('Choose account [1-' + body.length + ']: ', function(selection) {
                        input.done();
                        selection = parseInt(selection);
                        selection = selection - 1;

                        if (selection >= body.length || selection < 0) return utils.log('Not a valid number.');

                        config.account = body[selection].id;
                        config.servicekey = body[selection].servicekeys[0];
                        utils.saveConfig(config, function() {
                            utils.log('Successfully switched account to ' + body[selection].name);
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
                    q: query || ''
                };

                if (!options.debug) params.query += ' level:-debug';
                if (options.preferHead) params.prefer = 'head';
                if (options.from) {
                    try {
                        params.from = new Date(parseInt(options.from)).getTime();
                    } catch (err) {
                    }
                }
                if (options.to) {
                    try {
                        params.to = new Date(parseInt(options.to)).getTime();
                    } catch (err) {
                    }
                }
                if (options.next) {
                    // use last search timestamps to get next block of results
                    if (config.last_timestamp) {
                        if (options.preferHead) {
                            params.from = new Date(config.last_timestamp).getTime();
                        } else params.to = new Date(config.last_timestamp).getTime();
                    }
                }

                if (options.number) {
                    try {
                        params.size = parseInt(options.number);
                    } catch (err) {
                    }
                }

                if (options.json) params.json = true;
                if (options.hosts) params.hosts = options.hosts.replace(/, /g, ',');
                if (options.apps) params.apps = options.apps.replace(/, /g, ',');

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

                utils.apiGet(modifiedconfig, 'v1/export', params, function(body) {
                    if (body.range && body.range.from && body.range.to) {
                        t = new Date(body.range.from);
                        t2 = new Date(body.range.to);
                        range = ' between ' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
                            '-' + t2.toString().substring(4, 11) + t2.toString().substring(16, 24);
                    }
                    if (typeof body === 'string') {
                        body = body.split('\n');
                        body = body.map(function(x) {
                            try {
                                return JSON.parse(x);
                            } catch (err) {
                                return 0;
                            }
                        });
                        body = _.compact(body);
                    }


                    utils.log('search finished: ' + body.length + ' line(s)' + (range || '') +
                        '. hosts: ' + (options.hosts || 'all') +
                        '. apps: ' + (options.apps || 'all') +
                        '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                        '. query: ' + (query || 'none'));

                    if (!(body && body.length)) return utils.log('Query returned no lines.');

                    var last_timestamp = new Date(body[0]._ts);

                    _.each(body, function(line) {
                        t = new Date(line._ts);
                        if (options.preferHead && last_timestamp < t) {
                            last_timestamp = t;
                        } else if (last_timestamp > t) last_timestamp = t;

                        utils.renderLine(config, line, params);
                    });

                    config.last_timestamp = last_timestamp.toJSON();
                    utils.saveConfig(config);
                });
            });

        program.command('heroku <heroku-app-name>')
            .description('Generates a Heroku Drain URL for log shipping to LogDNA')
            .action(function(app) {
                if (!config.token) return utils.log('Please login first. Type \'logdna login\' or \'logdna --help\' for more info.');

                utils.log('Use the following Heroku CLI command to start log shipping:');
                utils.log('heroku drains:add https://' + config.account + ':' + (config.key || 'YOUR_INGESTION_KEY_HERE') + '@heroku.logdna.com/heroku/logplex?app=' + app + ' --app ' + app);
                utils.log();
                utils.log('Once shipping begins, you can tail using \'logdna tail -h ' + app + '\'');

            });

        program.command('install [os]')
            .description('Instructions for collecting logs from staging/production hosts and systems')
            .action(function(os) {
                try {
                    utils.log(require('./lib/install')[os].replace(/ZZZZZZZZ/g, (config.key || 'YOUR_INGESTION_KEY_HERE')));
                } catch (e) {
                    utils.log('Try one of the following:');
                    utils.log('logdna install deb            # Debian/Ubuntu/Linux Mint');
                    utils.log('logdna install rpm            # CentOS/Amazon Linux/Red Hat/Enterprise Linux');
                    utils.log('logdna install windows        # Windows Server');
                    utils.log('logdna install mac            # macOS Server');
                    utils.log('logdna install heroku         # Heroku Elements marketplace add-on');
                    utils.log('logdna install heroku-drains  # Heroku drains');
                    utils.log('logdna install syslog         # rsyslog/syslog-ng/syslog');
                    utils.log('logdna install k8s            # Kubernetes Cluster');
                    utils.log('logdna install docker         # Docker');
                    utils.log('logdna install api            # REST-based ingestion API');
                    utils.log('logdna install nodejs         # Node.js library');
                    utils.log();
                }
            });

        program.command('info')
            .alias('whoami')
            .description('Show current logged in user info')
            .action(function() {
                utils.apiGet(config, 'info', function(body) {
                    utils.log(body);
                });
            });

        program.command('update')
            .description('Update CLI to latest version')
            .action(function() {
                utils.performUpgrade(config, true, function() {
                    utils.log('No update available. You have the latest version: ' + pkg.version);
                });
            });

        // helper for tail/search -h due to -h conflict for --hosts
        if (process.argv && process.argv.length === 4 && ['tail', 'search'].indexOf(process.argv[2]) >= 0 && process.argv[3] === '-h') process.argv[3] = '--help';

        program.parse(process.argv);
        if (!process.argv.slice(2).length) return program.outputHelp(); // show help if no commands given
    });
});
