// External Modules
const qs = require('querystring');
const program = require('commander');
const properties = require('properties');
const chrono = require('chrono-node');
const logdnaWinston = require('logdna-winston');
const winston = require('winston');

// Internal Modules
let config = require('./lib/config');

const input = require('./lib/input');
const pkg = require('./package.json');
const utils = require('./lib/utils');
const WebSocket = require('./lib/logdna-websocket');

// Regular Expressions
const EMAIL_REGEX = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;


/* Developer Logging */

// Logs for troubleshooting/dev purposes are included via the -d/--dev flag for all options
// In order to pipe the developer logs to LogDNA, you should set the account API Key using
// `LOGDNA_API_KEY` environment variable.

// Note that we have used a standard log primitive via lib/utils.js -> devLogPrim() with
// "what", "why", "where", "who" and "when" to ensure full context is included as well as
// a "message" field for quick scanning in LogDNA.

// Using Winston logger with Console by default
const consoleFormat = winston.format.printf(function(info) {
    let logFrmt = `${info.timestamp} ${info.level}:`;
    if ('message' in info.message) {
        logFrmt = `${logFrmt} ${JSON.stringify(info.message.message)}`;
    } else {
        logFrmt = `${logFrmt} ${JSON.stringify(info.message)}`;
    }
    return logFrmt;
});
const logger = winston.createLogger({
    level: config.LOGDNA_LOGGING.MAX_LEVEL
    , transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                consoleFormat
            )
        })
    ]
});

// Add LogDNA-Winston transport IF 'LOGDNA_API_KEY' env var is set
if (config.LOGDNA_LOGGING.API_KEY !== '' && typeof config.LOGDNA_LOGGING.API_KEY === 'string') {
    let logdnaOptions = {
        key: config.LOGDNA_LOGGING.API_KEY
        , hostname: config.LOGDNA_LOGGING.HOSTNAME
        , app: config.LOGDNA_LOGGING.APP
        , level: config.LOGDNA_LOGGING.MAX_LEVEL
        , tags: config.LOGDNA_LOGGING.TAGS
        , indexMeta: config.LOGDNA_LOGGING.INDEXMETA
        , url: config.LOGDNA_LOGGING.ENDPOINT_URL
    };
    logger.add(new logdnaWinston(logdnaOptions));
}

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, '-v, --version')
    .usage('[commands] [options]\n\nThe LogDNA CLI allows you to sign up for a new account and tail your logs right from the command line.')
    .on('--help', function() {
        utils.uiDisp('  Examples:');
        utils.uiDisp();
        utils.uiDisp('    $ logdna tail \'("timed out" OR "connection refused") -request\'');
        utils.uiDisp('    $ logdna tail -a access.log 500');
        utils.uiDisp('    $ logdna tail -l error,warn');
        utils.uiDisp('    $ logdna search "logdna cli" -a logdna.log -t tag1,tag2 -n 300');
        utils.uiDisp('    $ logdna search "app:someApp response.code:>=400" --timeframe "yesterday at 3PM to 4PM"');
        utils.uiDisp('    $ logdna search "logdna" --from 1541100040931 --to 1541102940000');
        utils.uiDisp('    $ logdna login user@example.com');
        utils.uiDisp('    $ logdna info');
        utils.uiDisp('    $ logdna update');
        utils.uiDisp();
    });

properties.parse(config.DEFAULT_CONF_FILE, { path: true }, (err, parsedConfig) => {
    if (err && err.code !== 'ENOENT') { return utils.uiDisp('Unable to read the configuration file: ' + err.code); }

    config = Object.assign(config, parsedConfig || {});
    utils.performUpgrade(config, false, (error) => { if (error) { utils.uiDisp(error, null, error); } });

    let devOption = {
        param: '-d, --dev'
        , message: 'Development logging via LogDNA'
    };

    program.command('ssologin')
        .description('Log in to a LogDNA via single sign-on')
        .option(devOption.param, devOption.message)
        .action(function(_, options) {
            let token = Math.floor((Math.random() * 4000000000) + 800000000).toString(16);
            let pollTimeout;

            // Overide SSO URL if using a custom environment
            let sso_url = config.SSO_URL;
            if (config.LOGDNA_APPHOST) sso_url = config.LOGDNA_APPHOST + config.SSO_LONG_PATH;
            utils.uiDisp('To sign in via SSO, use a web browser to open the page ' + sso_url + token);

            let pollToken = function() {
                utils.apiPost(config, 'sso', {
                    auth: false
                    , token: token
                }, function(error, body) {
                    let tmpLogWhat = 'sso login';

                    if (error) {
                        let tmpErrLogWhy = 'signing in via sso';
                        let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy} - ${error.message}`;
                        let tmpErrLogData = {message:error.message, code:error.code, stack:error.stack};
                        let errLog = utils.devLogPrim({
                            message: tmpErrLogMessage
                            , what: tmpLogWhat
                            , why: tmpErrLogWhy
                            , additional: {errData:tmpErrLogData}
                        });

                        logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                        return process.exit(1); // Hard fail
                    }

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

                    utils.saveConfig(config, function(error, success) {
                        if (error) {
                            let tmpErrLogWhy = 'saving configuration';
                            let errLog = utils.devLogPrim({
                                message: `ERROR: saving configuration - ${error.message}`
                                , what: tmpLogWhat
                                , why: tmpErrLogWhy
                                , additional: {errData:{message:error.message, code:error.code, stack:error.stack}}
                            });

                            logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                            return process.exit(1); // Hard fail
                        }
                        utils.uiDisp('Logged in successfully as: ' + body.email + '. Saving credentials to local config.');
                    });
                });
                pollTimeout = setTimeout(pollToken, config.SSO_POLL_INTERVAL);
            };
            pollToken(); // kick off polling
        });

    program.command('login [email]')
        .description('Log in to LogDNA')
        .option(devOption.param, devOption.message)
        .action(function(email, options) {
            let nextstep = function(email) {
                input.hidden('Password: ', function(password) {
                    input.done();

                    email = email.toLowerCase();

                    let tmpDevLogWhat = 'LogDNA login';

                    if (!EMAIL_REGEX.test(email)) {
                        let errLog = utils.devLogPrim({
                            message: `Invalid email address of ${email}`
                            , what: tmpDevLogWhat
                            , why: 'regex failed to validate'
                        });

                        logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                        return process.exit(1); // Hard fail
                    }

                    utils.apiPost(config, 'login', {
                        auth: email + ':' + password
                    }, function(error, body) {
                        let tmpLogWhat = 'login';

                        if (error) {
                            let tmpErrLogWhy = 'signing in';
                            let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy} - ${error.message}`;
                            let tmpErrLogData = {message:error.message, code:error.code, stack:error.stack};
                            let errLog = utils.devLogPrim({
                                message: tmpErrLogMessage
                                , what: tmpLogWhat
                                , why: tmpErrLogWhy
                                , additional: {errData:tmpErrLogData}
                            });

                            logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                            return process.exit(1); // Hard fail
                        }

                        config.email = email;
                        if (body && body.accounts.length && config.account !== body.accounts[0]) {
                            config.account = body.accounts[0];
                            config.key = null;
                        }
                        if (body && body.keys && body.keys.length) config.key = body.keys[0];
                        config.token = body.token;

                        if (body && body.servicekeys && body.servicekeys.length) config.servicekey = body.servicekeys[0];

                        utils.saveConfig(config, function(error, success) {
                            if (error) {
                                let tmpErrLogWhy = 'saving configuration';
                                let errLog = utils.devLogPrim({
                                    message: `ERROR: ${tmpErrLogWhy} - ${error.message}`
                                    , what: tmpLogWhat
                                    , why: tmpErrLogWhy
                                    , additional: {errData:{message:error.message, code:error.code, stack:error.stack}}
                                });

                                logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                                return process.exit(1); // Hard fail
                            }
                            utils.uiDisp('Logged in successfully as: ' + email + '. Saving credentials to local config.');
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
        .description('Live tail with optional filtering. Options include -h, -a, -l, -t to filter by hosts, apps, levels or tags respectively. Run logdna tail --help to learn more.')
        .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
        .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
        .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
        .option('-t, --tags <tags>', 'Filter on tags (separate by comma)')
        .option('-j, --json', 'Output raw JSON', false)
        .option(devOption.param, devOption.message)
        .action(function(query, options) {
            let params = utils.authParams(config);
            params.q = query || '';

            let tmpLogWhat = `tailing logs using query "${params.q}"`;

            if (options.hosts) params.hosts = options.hosts.replace(/, /g, ',');
            if (options.apps) params.apps = options.apps.replace(/, /g, ',');
            if (options.levels) params.levels = options.levels.replace(/, /g, ',');
            if (options.tags) params.tags = options.tags.replace(/, /g, ',');
            if (options.json) params.json = true;

            params.q = params.q.trim();

            let ws = new WebSocket((config.LOGDNA_APISSL ? 'https://' : 'http://') + config.LOGDNA_TAILHOST + '/ws/tail?' + qs.stringify(params));

            ws.on('open', function open() {
                // Informational output for tail written to stderr to not interfere with actual data
                utils.uiDisp('tail started. hosts: ' + (options.hosts || 'all') +
                    '. apps: ' + (options.apps || 'all') +
                    '. tags: ' + (options.tags || 'all') +
                    '. levels: ' + (options.levels || 'all') +
                    '. query: ' + (query || 'none'), null, 'error');
            });

            ws.on('reconnecting', function(num) {
                utils.uiDisp('tail reconnect attmpt #' + num + '...', null, 'error');
            });

            ws.on('message', function(data) {
                try {
                    data = JSON.parse(data);
                } catch (err) {
                    let tmpErrLogWhy = 'malformed line: ' + err.message;
                    let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy}`;
                    let tmpErrLogData = {message:err.message, code:err.code, stack:err.stack};
                    let errLog = utils.devLogPrim({
                        message: tmpErrLogMessage
                        , what: tmpLogWhat
                        , why: tmpErrLogWhy
                        , additional: {errData:tmpErrLogData}
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    return process.exit(1); // Hard fail
                }

                const account = data.e;
                const payload = data.p;

                if (account === 'meta') return; // Ignore meta messages

                const lines = [].concat(payload);
                lines.forEach((line) => {
                    utils.renderLine(config, line, params);
                });
            });

            ws.on('error', function(err) {
                let rawErr = err;
                err = err.toString();
                if (err.indexOf('401') > -1) {
                    let tmpErrLogWhy = 'access token invlaid. If you created or changed your password recently, please \'logdna login\' or \'logdna ssologin\' again. Type \'logdna --help\' for more info.';
                    let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy}`;
                    let tmpErrLogData = {message:rawErr.message, code:rawErr.code, stack:rawErr.stack};
                    let errLog = utils.devLogPrim({
                        message: tmpErrLogMessage
                        , what: tmpLogWhat
                        , why: tmpErrLogWhy
                        , additional: {errData:tmpErrLogData}
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    return process.exit(1); // Hard fail
                } else {
                    let tmpErrLogWhy = err;
                    let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy}`;
                    let tmpErrLogData = {message:rawErr.message, code:rawErr.code, stack:rawErr.stack};
                    let errLog = utils.devLogPrim({
                        message: tmpErrLogMessage
                        , what: tmpLogWhat
                        , why: tmpErrLogWhy
                        , additional: {errData:tmpErrLogData}
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                }
            });

            ws.on('close', function() {
                utils.uiDisp('tail lost connection', null, 'error');
            });
        });

    program.command('switch')
        .description('If your login has access to more than one account, this command allows you to switch between them')
        .option(devOption.param, devOption.message)
        .action(function(options) {
            let tmpLogWhat = 'Switching LogDNA account';
            utils.apiGet(config, 'orgs', {}, function(error, response) {
                if (error) {
                    let tmpErrLogWhy = error.message;
                    let tmpErrLogMessage = `ERROR: ${tmpErrLogWhy}`;
                    let tmpErrLogData = {message:error.message, code:error.code, stack:error.stack};
                    let errLog = utils.devLogPrim({
                        message: tmpErrLogMessage
                        , what: tmpLogWhat
                        , why: tmpErrLogWhy
                        , additional: {errData:tmpErrLogData}
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    return process.exit(1); // Hard fail
                }

                if (!response || response.length <= 1) {
                    return utils.uiDisp(`Your login ${config.email} doesn't belong to other accounts. Ensure the other owner has added your email.`);
                }

                response.forEach((org, i) => {
                    const option = i + 1;
                    const isActive = org.id === config.account;
                    utils.uiDisp(`${option}: ${org.name} ${isActive ? '(active)' : ''}`);
                });

                input.required('Choose account [1-' + response.length + ']: ', function(selection) {
                    input.done();
                    selection = parseInt(selection);
                    selection = selection - 1;

                    if (isNaN(selection) || selection >= response.length || selection < 0) {
                        return utils.uiDisp('Not a valid number.');
                    }

                    config.account = response[selection].id;
                    config.servicekey = response[selection].servicekeys[0];
                    utils.saveConfig(config, function(error, success) {
                        if (error) {
                            let tmpErrLogWhy = 'saving configuration';
                            let errLog = utils.devLogPrim({
                                message: `ERROR: ${tmpErrLogWhy} - ${error.message}`
                                , what: tmpLogWhat
                                , why: tmpErrLogWhy
                                , additional: {errData:{message:error.message, code:error.code, stack:error.stack}}
                            });

                            logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                            return process.exit(1); // Hard fail
                        }
                        utils.uiDisp('Successfully switched account to ' + response[selection].name);
                    });
                });
            });
        });

    program.command('search [query]')
        .description('Basic search with optional filtering. Run logdna search --help for options.')
        .option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')
        .option('-a, --apps <apps>', 'Filter on apps (separate by comma)')
        .option('-l, --levels <levels>', 'Filter on levels (separate by comma)')
        .option('-n, --number <number>', 'Set how many lines to request')
        .option('-t, --tags <tags>', 'Filter on tags (separate by comma)')
        .option('--prefer-head', 'Get lines from the beginning of the interval rather than the end')
        .option('--next', 'Get next chunk of lines (after last search). This is a convenience wrapper around the --from and --to parameters.')
        .option('--timeframe <timeframe>', 'Natural Language Timeframe via Chrono. Wrap in quotes. IE "today 5PM to 7PM" or "yesterday at 3PM to now" or "May 26 at 4PM UTC". If only one time is given, "from" is assumed.')
        .option('--from <from>', 'Unix/Natural Language timestamp of beginning of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.')
        .option('--to <to>', 'Unix/Natural Language timestamp of end of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.')
        .option('-j, --json', 'Output raw JSON', false)
        .option(devOption.param, devOption.message)
        .action(function(query, options) {
            let params = {
                q: query || ''
            };

            if (options.preferHead) params.prefer = 'head';

            if (options.timeframe) {
                let tmpLogWhat = 'search timeframe - chrono nlp';
                let tmpLogWhy = 'search timeframe ' + options.timeframe;
                try {
                    let devLog = utils.devLogPrim({
                        what: tmpLogWhat
                        , why: tmpLogWhy
                    });

                    // Chrono parse
                    let tfObj = chrono.parse(options.timeframe)[0];
                    if (typeof tfObj !== 'undefined') { // Success grabbing something from Chrono
                        // Grab the From
                        let fromDate = tfObj.start.date();
                        params.from = fromDate.getTime();

                        devLog.message = `SUCCESS: ${devLog.who} search --timeframe from "${fromDate}"`;
                        devLog.when = new Date().toISOString();
                        devLog.what = 'search timeframe - from - chrono nlp';
                        devLog.why = 'search timeframe from ' + fromDate;
                        if (options.dev) {
                            logger.log({message:devLog, level:'debug'}); // Send to console and LogDNA if API key is set
                        }

                        // Grab the To (when applicable)
                        if (tfObj.end) {
                            let toDate = tfObj.end.date();
                            params.to = toDate.getTime();
                            devLog.message = `SUCCESS: ${devLog.who} search --timeframe to "${toDate}"`;
                            devLog.when = new Date().toISOString();
                            devLog.what = 'search timeframe - to - chrono nlp';
                            devLog.why = 'search timeframe to ' + toDate;
                            if (options.dev) {
                                logger.log({message:devLog, level:'debug'}); // Send to console and LogDNA
                            }
                        }
                    } else {
                        devLog.message = `FAIL: valid time required - ${devLog.who} search --timeframe "${devLog.what}"`;
                        devLog.when = new Date().toISOString();
                        logger.log({message:devLog, level:'info'}); // Send to console and LogDNA
                    }
                } catch (err) {
                    let tmpErrLogData = {message:err.message, code:err.code, stack:err.stack};

                    let errLog = utils.devLogPrim({
                        message: 'ERROR: ' + tmpLogWhy + ' - ' + err.message
                        , why: tmpLogWhy
                        , what: tmpLogWhat
                        , additional: {errData:tmpErrLogData}
                    });
                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set
                }
            } else { // Skip From and To if Timeframe is used
                if (options.from) {
                    let tmpLogWhat = 'search from - timestamp';
                    let tmpLogWhy = 'search from ' + options.from;
                    try {
                        let devLog = utils.devLogPrim({
                            what: tmpLogWhat
                            , why: tmpLogWhy
                        });
                        params.from = new Date(parseInt(options.from)).getTime();
                        devLog.message = `SUCCESS: ${devLog.who} search --from "${params.from}"`;
                        if (isNaN(params.from)) { // Int parsing failed
                            devLog.what = 'search from - chrono nlp';
                            let tfObj = chrono.parse(options.from)[0];
                            if (typeof tfObj !== 'undefined') { // Success grabbing something from Chrono

                                let fromDate = tfObj.start.date();
                                params.from = fromDate.getTime();

                                devLog.message = `SUCCESS: ${devLog.who} search --from "${fromDate}"`;
                                devLog.when = new Date().toISOString();

                                if (options.dev) {
                                    logger.log({message:devLog, level:'debug'}); // Send to console and LogDNA if API key is set
                                }
                            } else {
                                devLog.message = `FAIL: valid time required -  ${devLog.who} search --from "${options.from}"`;
                                devLog.when = new Date().toISOString();
                                logger.log({message:devLog, level:'info'}); // Send to console and LogDNA
                                params.from = null;
                            }
                        }
                    } catch (err) {
                        let tmpErrLogData = {message:err.message, code:err.code, stack:err.stack};

                        let errLog = utils.devLogPrim({
                            message: 'ERROR: ' + tmpLogWhy + ' - ' + err.message
                            , why: tmpLogWhy
                            , what: tmpLogWhat
                            , additional: {errData:tmpErrLogData}
                        });

                        logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set
                    }
                }

                if (options.to) {
                    let tmpLogWhat = 'search to - timestamp';
                    let tmpLogWhy = 'search to ' + options.to;
                    try {
                        let devLog = utils.devLogPrim({
                            what: tmpLogWhat
                            , why: tmpLogWhy
                        });
                        params.to = new Date(parseInt(options.to)).getTime();
                        devLog.message = `SUCCESS: ${devLog.who} search --to "${params.to}"`;
                        if (isNaN(params.to)) { // Int parsing failed
                            devLog.what = 'search to - chrono nlp';
                            let tfObj = chrono.parse(options.to)[0];
                            if (typeof tfObj !== 'undefined') {
                                let toDate = tfObj.start.date();
                                params.to = toDate.getTime();

                                devLog.message = `SUCCESS: ${devLog.who} search --to "${toDate}"`;
                                devLog.when = new Date().toISOString();

                                if (options.dev) {
                                    logger.log({message:devLog, level:'debug'}); // Send to console and LogDNA if API key is set
                                }
                            } else {
                                devLog.message = `FAIL: valid time required - ${devLog.who} search --to "${options.to}"`;
                                devLog.when = new Date().toISOString();
                                logger.log({message:devLog, level:'info'}); // Send to console and LogDNA
                                params.to = null;
                            }
                        }
                    } catch (err) {
                        let errLog = utils.devLogPrim({
                            message: 'ERROR: ' + tmpLogWhy + ' - ' + err.message
                            , why: tmpLogWhy
                            , what: tmpLogWhat
                            , additional: {errData:{message:err.message, code:err.code, stack:err.stack}}
                        });

                        logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    }
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
                } catch (err) {} // ignore if it fails
            }

            if (options.json) params.json = true;
            if (options.hosts) params.hosts = options.hosts.replace(/, /g, ',');
            if (options.apps) params.apps = options.apps.replace(/, /g, ',');
            if (options.levels) params.levels = options.levels.replace(/, /g, ',');
            if (options.tags) params.tags = options.tags.replace(/, /g, ',');
            if (config.servicekey) params.servicekey = config.servicekey;

            let modifiedconfig = JSON.parse(JSON.stringify(config));

            // this prevents export API from emailing the results
            delete modifiedconfig.email;

            let t, t2, range;

            utils.apiGet(modifiedconfig, 'v1/export', params, function(error, body) {
                if (error) {
                    let errLog = utils.devLogPrim({
                        message: 'ERROR: ' + error.message
                        , what: 'search: v1/export API call'
                        , why: error.message
                        , additional: {
                            errData: {message:error.message, code:error.code, stack:error.stack}
                        }
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    return process.exit(1);
                }
                if (body && body.range && body.range.from && body.range.to) {
                    t = new Date(body.range.from);
                    t2 = new Date(body.range.to);
                    range = ' between ' + t.toString().substring(4, 11) + t.toString().substring(16, 24) +
                        '-' + t2.toString().substring(4, 11) + t2.toString().substring(16, 24);
                }
                if (typeof body === 'string') {
                    body = body.split('\n');
                    body = body.map((x) => {
                        try {
                            return JSON.parse(x);
                        } catch (err) {
                            return 0;
                        }
                    }).filter(element => element);
                }
                // Informational output for search written to stderr to not interfere with actual data
                utils.uiDisp('search finished: ' + (body ? body.length : 0) + ' line(s)' + (range || '') +
                    '. hosts: ' + (options.hosts || 'all') +
                    '. apps: ' + (options.apps || 'all') +
                    '. levels: ' + (options.levels || 'all') +
                    '. tags: ' + (options.tags || 'all') +
                    '. query: ' + (query || 'none'), null, 'error');


                const lines = [].concat(body);
                if (!lines.length) {
                    return utils.uiDisp('Query returned no lines.', null, 'error');
                }

                let last_timestamp = new Date(lines[0]._ts);

                lines.forEach((line) => {
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
                        let tmpErrLogWhy = 'saving configuration';
                        let errLog = utils.devLogPrim({
                            message: `ERROR: ${tmpErrLogWhy} - ${error.message}`
                            , what: 'search'
                            , why: tmpErrLogWhy
                            , additional: {errData:{message:error.message, code:error.code, stack:error.stack}}
                        });

                        logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                        return process.exit(1); // Hard fail
                    }
                });
            });
        });

    program.command('info')
        .alias('whoami')
        .description('Show current logged in user info')
        .option(devOption.param, devOption.message)
        .action(function(_, options) {
            utils.apiGet(config, 'info', function(error, body) {
                if (error) {
                    let errLog = utils.devLogPrim({
                        message: 'ERROR: info - ' + error.message
                        , what: 'showing user info / whoami'
                        , why: error.message
                        , additional: {
                            errData: {message:error.message, code:error.code, stack:error.stack}
                        }
                    });

                    logger.log({message:errLog, level:'error'}); // Send to console and LogDNA if API key is set

                    return process.exit(1);
                }
                utils.uiDisp(body);
            });
        });

    program.command('update')
        .description('Update the CLI to the latest version')
        .action(function() {
            utils.performUpgrade(config, true, function() {
                utils.uiDisp('No update available. You have the latest version: ' + pkg.version);
            });
        });

    // helper for tail/search -h due to -h conflict for --hosts
    if (process.argv && process.argv.length === 4 && ['tail', 'search'].indexOf(process.argv[2]) >= 0 && process.argv[3] === '-h') process.argv[3] = '--help';

    program.parse(process.argv);
    if (!process.argv.slice(2).length) return program.outputHelp(); // show help if no commands given
});

process.on('uncaughtException', function(err) {
    if (typeof err === 'string') err = {message:err};
    let tmpWhat = 'uncaught exception';
    let tmpWhy = tmpWhat + ' - ' + err.message;
    let errLog = utils.devLogPrim({
        message:'ERROR: ' + tmpWhy
        , why: tmpWhy
        , what: tmpWhat
        , additional: {
            errData: {message:err.message, code:err.code, stack:err.stack}
        }
    });

    logger.log({message:errLog, level:'error'});
});
