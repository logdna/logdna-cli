#!/usr/bin/env node
/* globals process */
// override es6 promise with bluebird
const program = require('commander');
const properties = require('properties');
const qs = require('querystring');

const pkg = require('./package.json');
const WebSocket = require('./lib/logdna-websocket');
const input = require('./lib/input');
const utils = require('./lib/utils');
const EMAIL_REGEX = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

var config = require('./lib/config');

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, '-v, --version')
    .usage('[commands] [options]\n\n  This CLI duplicates useful functionality of the LogDNA web app.')
    // .description('This CLI duplicates useful functionality of the LogDNA web app.')
    .on('--help', function() {
        utils.log('  Examples:');
        utils.log();
        utils.log('    $ logdna register user@example.com');
        utils.log('    $ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d    # use this if you were assigned an Ingestion Key');
        utils.log('    $ logdna tail \'("timed out" OR "connection refused") -request\'');
        utils.log('    $ logdna tail -a access.log 500');
        utils.log('    $ logdna tail -l error,warn');
        utils.log('    $ logdna search "logdna cli" -a logdna.log -t tag1,tag2 -n 300');
        utils.log('    $ logdna search "logdna" --from 1541100040931 --to 1541102940000');
        utils.log('    $ logdna login user@example.com');
        utils.log('    $ logdna info');
        utils.log('    $ logdna update');
        utils.log();
    });

properties.parse(config.DEFAULT_CONF_FILE, {
    path: true
}, function(error, parsedConfig) {

    config = Object.assign(config, parsedConfig || {});

    utils.performUpgrade(config, function(error) {
        if (error) {
            return utils.log(error);
        }
    });

    program.command('register [email] [key]')
        .description('Register a new LogDNA account. [key] is optional and will autogenerate')
        .action(function(email, key) {
            const nextstep = function(email) {
                email = email.toLowerCase();

                if (!EMAIL_REGEX.test(email)) {
                    return utils.log(`Invalid Email Address: ${email}`);
                }

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
                            }, function(error, body) {
                                if (error) {
                                    return utils.log(error);
                                }

                                config.email = email;

                                if (config.account !== body.account) {
                                    config.account = body.account;
                                    config.token = null;
                                    config.servicekey = null;
                                }

                                config.key = body.key;

                                if (body.token) {
                                    config.token = body.token; // save token if available
                                }

                                if (body.servicekeys && body.servicekeys.length) {
                                    config.servicekey = body.servicekeys[0];
                                }

                                utils.saveConfig(config, function(error, success) {
                                    if (error) {
                                        return utils.log(error);
                                    }

                                    utils.log('Thank you for signing up! Your Ingestion Key is: ' + body.key + '. Saving credentials to local config.');
                                    utils.log();
                                    utils.log('Next steps:');
                                    utils.log('===========');
                                    utils.log('1) We\'ve sent you a welcome email to create your password. Once set, come back here and use \'logdna login\'');
                                    utils.log('2) Type \'logdna install\' for more info on collecting your logs via our agent, syslog, Heroku, API, etc.');
                                    return utils.log();
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
            const token = Math.floor((Math.random() * 4000000000) + 800000000).toString(16);
            var pollTimeout;

            // Overide SSO URL if using a custom environment
            const sso_url = (config.LOGDNA_APPHOST ? config.LOGDNA_APPHOST + config.SSO_LONG_PATH : config.SSO_URL);

            utils.log(`To sign in via SSO, use a web browser to open the page ${sso_url}${token}`);

            const pollToken = function() {
                utils.apiPost(config, 'sso', {
                    auth: false
                    , token: token
                }, function(error, body) {
                    if (error) {
                        return utils.log(error);
                    }

                    if (!body || !body.email) {
                        return;
                    }

                    clearTimeout(pollTimeout);

                    config.email = body.email;

                    if (body.accounts.length && config.account !== body.accounts[0]) {
                        config.account = body.accounts[0];
                        config.key = null;
                    }
                    if (body.keys && body.keys.length) {
                        config.key = body.keys[0];
                    }

                    config.token = body.token;

                    if (body.servicekeys && body.servicekeys.length) {
                        config.servicekey = body.servicekeys[0];
                    }

                    utils.saveConfig(config, function(error, success) {
                        if (error) {
                            return utils.log(error);
                        }

                        utils.log(`Logged in successfully as: ${body.email}. Saving credentials to local config.`);
                    });
                });
                pollTimeout = setTimeout(function() {
                    return pollToken();
                }, config.SSO_POLL_INTERVAL);
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
                        return utils.log('Invalid Email Address');
                    }

                    utils.apiPost(config, 'login', {
                        auth: email + ':' + password
                    }, function(error, body) {
                        if (error) {
                            return utils.log(error);
                        }

                        config.email = email;

                        if (body && body.accounts.length && config.account !== body.accounts[0]) {
                            config.account = body.accounts[0];
                            config.key = null;
                        }

                        if (body && body.keys && body.keys.length) {
                            config.key = body.keys[0];
                        }

                        config.token = body.token;

                        if (body && body.servicekeys && body.servicekeys.length) {
                            config.servicekey = body.servicekeys[0];
                        }

                        utils.saveConfig(config, function(error, success) {
                            if (error) {
                                return utils.log(error);
                            }

                            utils.log(`Logged in successfully as: ${email}. Saving credentials to local config.`);
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
        .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
        .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
        .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
        .option('-t, --tags <tags>', 'Filter on tags (separate by comma)')
        .option('-j, --json', 'if true, output raw json', false)
        .action(function(query, options) {
            var params = utils.authParams(config);
            params.q = query || '';

            if (options.hosts) {
                params.hosts = options.hosts.replace(/, /g, ',');
            }

            if (options.apps) {
                params.apps = options.apps.replace(/, /g, ',');
            }

            if (options.levels) {
                params.levels = options.levels.replace(/, /g, ',');
            }

            if (options.tags) {
                params.tags = options.tags.replace(/, /g, ',');
            }

            if (options.json) {
                params.json = true;
            }

            params.q = params.q.trim();

            var ws = new WebSocket((config.LOGDNA_APISSL ? 'https://' : 'http://') + config.LOGDNA_TAILHOST + '/ws/tail?' + qs.stringify(params));

            ws.on('open', function open() {
                utils.log('tail started. hosts: ' + (options.hosts || 'all') +
                    '. apps: ' + (options.apps || 'all') +
                    '. tags: ' + (options.tags || 'all') +
                    '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                    '. query: ' + (query || 'none'));
            });

            ws.on('reconnecting', function(num) {
                utils.log('tail reconnect attmpt #' + num + '...');
            });

            ws.on('message', function(data) {
                if (data.substring(0, 1) === '{') {
                    data = JSON.parse(data);
                } else {
                    return utils.log('Malformed Line: ' + data);
                }

                if (Array.isArray(data.p)) {
                    data.p.forEach(function(line) {
                        return utils.renderLine(config, line, params);
                    });
                } else {
                    return utils.renderLine(config, data.p, params);
                };
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
            utils.apiGet(config, 'orgs', {}, function(error, body) {
                if (error) {
                    return utils.log(error);
                }

                body = JSON.parse(body);

                if (!body || (body.length && body.length < 2)) {
                    return utils.log(`Your login ${config.email} doesn't belong to other accounts. Ensure the other owner has added your email.`);
                }

                for (var i = 0; i < body.length; i++) {
                    utils.log((i + 1) + ': ' + body[i].name + (body[i].id === config.account ? ' (active)' : ''));
                }

                input.required('Choose account [1-' + body.length + ']: ', function(selection) {
                    input.done();
                    selection = parseInt(selection);
                    selection = selection - 1;

                    if (selection >= body.length || selection < 0) {
                        return utils.log('Not a Valid Number.');
                    }

                    config.account = body[selection].id;
                    config.servicekey = body[selection].servicekeys[0];
                    utils.saveConfig(config, function(error, success) {
                        if (error) {
                            return utils.log(error);
                        }

                        utils.log(`Successfully switched account to ${body[selection].name}!`);
                    });
                });
            });
        });

    program.command('search [query]')
        .description('Limited search functionality with optional filtering (beta). See \'logdna search --help\'')
        .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
        .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
        .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
        .option('-n, --number <number>', 'Set how many lines to request')
        .option('-t, --tags <tags>', 'Filter on tags (separate by comma)')
        .option('--prefer-head', 'Get lines from the beginning of the interval rather than the end')
        .option('--next', 'Get next chunk of lines (after last search). This is a convenience wrapper around the --from and --to parameters.')
        .option('--from <from>', 'Unix timestamp of beginning of search timeframe.')
        .option('--to <to>', 'Unix timestamp of end of search timeframe.')
        .option('-j, --json', 'if true, output raw json', false)
        .action(function(query, options) {
            var params = {
                q: query || ''
            };

            if (options.preferHead) {
                params.prefer = 'head';
            }

            if (options.from) {
                try {
                    params.from = new Date(parseInt(options.from)).getTime();
                } catch (err) {
                    utils.log(`Invalid Unix Timestamp: ${options.from}`);
                }
            }
            if (options.to) {
                try {
                    params.to = new Date(parseInt(options.to)).getTime();
                } catch (err) {
                    utils.log(`Invalid Unix Timestamp: ${options.to}`);
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
                    utils.log(`Invalid Number: ${options.number}`);
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

            if (options.tags) {
                params.tags = options.tags.replace(/, /g, ',');
            }

            if (config.servicekey) {
                params.servicekey = config.servicekey;
            }

            var modifiedconfig = JSON.parse(JSON.stringify(config));

            // this prevents export API from emailing the results
            delete modifiedconfig.email;

            var t, t2, range;

            utils.apiGet(modifiedconfig, 'v1/export', params, function(error, body) {
                if (error) {
                    return utils.log(error);
                }

                if (body && body.range && body.range.from && body.range.to) {
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
                    }).filter(function(element) {
                        return element;
                    });
                }

                utils.log('search finished: ' + (body ? body.length : 0) + ' line(s)' + (range || '') +
                    '. hosts: ' + (options.hosts || 'all') +
                    '. apps: ' + (options.apps || 'all') +
                    '. levels: ' + (options.levels || (options.debug ? 'all' : '-debug')) +
                    '. tags: ' + (options.tags || 'all') +
                    '. query: ' + (query || 'none'));

                if (!(body && body.length)) {
                    return utils.log('Returned No Lines.');
                }

                var last_timestamp = new Date(body[0]._ts);

                body.forEach(function(line) {
                    t = new Date(line._ts);
                    if (options.preferHead && last_timestamp < t) {
                        last_timestamp = t;
                    } else if (last_timestamp > t) {
                        last_timestamp = t;
                    }

                    utils.renderLine(config, line, params);
                });

                config.last_timestamp = last_timestamp.toJSON();
                utils.saveConfig(config, function(error, success) {
                    if (error) {
                        return utils.log(error);
                    }
                });
            });
        });

    program.command('info')
        .alias('whoami')
        .description('Show current logged in user info')
        .action(function() {
            utils.apiGet(config, 'info', function(error, body) {
                if (error) {
                    return utils.log(error);
                }
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
    if (process.argv && process.argv.length === 4 && ['tail', 'search'].indexOf(process.argv[2]) >= 0 && process.argv[3] === '-h') {
        process.argv[3] = '--help';
    }

    program.parse(process.argv);

    if (!process.argv.slice(2).length) {
        return program.outputHelp(); // show help if no commands given
    }
});

process.on('uncaughtException', function(err) {
    utils.log('------------------------------------------------------------------');
    utils.log('Uncaught Error: ' + (err.stack || '').split('\r\n'));
    utils.log('------------------------------------------------------------------');
});

process.once('SIGTERM', function() {
    utils.log('\nGot SIGTERM signal, shutting down...');
    process.exit();
}); // kill

process.once('SIGINT', function() {
    utils.log('\nGot SIGINT signal, shutting down...');
    process.exit();
}); // ctrl+c
