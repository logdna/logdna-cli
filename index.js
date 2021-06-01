// External Modules
const qs = require('querystring');
const program = require('commander');
const properties = require('properties');
const chrono = require('chrono-node');

const logdna = require('@logdna/logger');

// Internal Modules
let config = require('./lib/config');
let dev_config = (config.DEV) ? require('./lib/dev_config') : false;

const input = require('./lib/input');
const pkg = require('./package.json');
const utils = require('./lib/utils');
const WebSocket = require('./lib/logdna-websocket');
const stringifier = require('properties/lib/stringifier');

// Regular Expressions
const EMAIL_REGEX = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;


/* Developer Logging Setup */

// Logs for troubleshooting, developmental purposes are included via @logdna/logger npm
// and have a "hard switch" in logs/config.js with DEV
// Be sure to set environment var LOGDNA_API_KEY prior to running

// Instantiation of the @logdna/logger object IF config.DEV == true.   Otherwise nothing is logged
let logger = {log: ()=>{}};
if (config.DEV) {
    logger = logdna.createLogger(
        key = dev_config.LOGDNA_LOGGING.API_KEY
        , options = {
            level: dev_config.LOGDNA_LOGGING.DEFAULT_LEVEL
            , app: dev_config.LOGDNA_LOGGING.APP
            , hostname: dev_config.LOGDNA_LOGGING.HOSTNAME
            , tags: dev_config.LOGDNA_LOGGING.TAGS
            , indexMeta: dev_config.LOGDNA_LOGGING.INDEXMETA
            , url: dev_config.LOGDNA_LOGGING.ENDPOINT_URL
        }
    )
}

// Standardized developer log object to be sent to logdna.  Message is what will
// be displayed in LiveTail while the additional fields/objects will be stored, searchable
// and viewable via log line expansion
let devLog = {
    message: ""
    , who: "dev" // Who is sending this log.  Often user but here it's dev
    , what: "" // High level "what" is happening
    , why: "" // Why the log is occuring
    , where: "local" // Where in your system this is happening
    , when: new Date().toISOString()
}

/* End Developer Logging Setup */

process.on('uncaughtException', function(err) {
    if (typeof err == 'string') err = {message:err};
    devLog.why = 'uncaught exception - '+err.message;
    devLog.message = 'ERROR: '+devLog.why;
    devLog.when = new Date().toISOString();
    devLog.error_data = {'message':err.message,'code':err.code,'stack':err.stack};
    if (config.DEV){
        logger.log(devLog,'ERROR'); // Send to LogDNA
    }
    console.log(devLog); // Send to terminal too
    delete devLog.error_data;
});

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, '-v, --version')
    .usage('[commands] [options]\n\nThe LogDNA CLI allows you to sign up for a new account and tail your logs right from the command line.')
    .on('--help', function() {
        utils.uiDisp('  Examples:');
        utils.uiDisp();
        utils.uiDisp('    $ logdna register user@example.com');
        utils.uiDisp('    $ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d # use this if you were assigned an Ingestion Key');
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

    parsedConfig.DEV = config.DEV;
    config = Object.assign(config, parsedConfig || {});
    utils.performUpgrade(config, false, (error) => { if (error) { utils.uiDisp(error,null,error,dev_log); } });
    program.command('register [email]')
        .description('Register a new LogDNA account')
        .action(function(email) {
            let nextstep = function(email) {
                email = email.toLowerCase();

                devLog.what = 'LogDNA account registration'

                if (!EMAIL_REGEX.test(email)) {
                    devLog.why = 'regex failed to validate'
                    devLog.when = new Date().toISOString();
                    devLog.message = `Invalid email address of ${email}`;
                 
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    
                    console.log(devLog); // Display in console too
                    return process.exit(0); // Hard fail
                }

                input.required('First name: ', function(firstname) {
                    input.required('Last name: ', function(lastname) {
                        input.required('Company/Organization: ', function(company) {
                            input.done();
                            utils.apiPost(config, 'register', {
                                auth: false
                                , email: email
                                , firstname: firstname
                                , lastname: lastname
                                , company: company
                            }, function(error, body) {
                                devLog.what = 'Account and Organization details';
                                if (error) {
                                    devLog.why = 'registration via API'
                                    devLog.when = new Date().toISOString();
                                    devLog.message = `ERROR: register new - account and organization details`;
                                    devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                                    
                                    if (config.DEV){
                                        logger.log(devLog,'ERROR'); // Send to LogDNA
                                    }
                                    
                                    console.log(devLog); // Send to terminal too
                                    delete devLog.error_data;
                                    return process.exit(0); // Hard fail
                                }
                                config.email = email;

                                if (config.account !== body.account) {
                                    config.account = body.account;
                                    config.token = null;
                                    config.servicekey = null;
                                }

                                config.key = body.key;

                                if (body.token) config.token = body.token; // save token if available

                                if (body.servicekeys && body.servicekeys.length) config.servicekey = body.servicekeys[0];

                                utils.saveConfig(config, function(error, success) {
                                    devLog.what = 'saving configuration'
                                    if (error) {
                                        devLog.why = 'registration via API'
                                        devLog.when = new Date().toISOString();
                                        devLog.message = `ERROR: saving configuration - ${error.message}`;
                                        devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                                        if (config.DEV){
                                            logger.log(devLog,'ERROR'); // Send to LogDNA
                                        }
                                        console.log(devLog); // Send to terminal too
                                        delete devLog.error_data;
                                        return process.exit(0); // Hard fail
                                    }
                                    utils.uiDisp();
                                    utils.uiDisp('Thank you for signing up! Saving credentials to local config...');
                                    utils.uiDisp('Your Ingestion Key is: ' + body.key + '. ');
                                    utils.uiDisp();
                                    utils.uiDisp('Next steps:');
                                    utils.uiDisp('===========');
                                    utils.uiDisp('1. We\'ve sent you a welcome email to create your password. Once set, come back here and use \'logdna login\'');
                                    utils.uiDisp('2. Visit https://docs.logdna.com/docs/ingestion-methods for more info on collecting your logs via our Agent, Syslog, Heroku, API, or code libraries.');
                                    return utils.uiDisp();
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
        .description('Log in to a LogDNA via single sign-on')
        .action(function() {
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
                    devLog.what = 'sso login'
                    
                    if (error) {
                        devLog.why = 'signing in via sso'
                        devLog.when = new Date().toISOString();
                        devLog.message = `ERROR: ${devLog.why} - ${error.message}`;
                        devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                        if (config.DEV){
                            logger.log(devLog,'ERROR'); // Send to LogDNA
                        }
                        console.log(devLog); // Send to terminal too
                        delete devLog.error_data;
                        return process.exit(0); // Hard fail
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
                        devLog.what = 'saving configuration'
                        if (error) {
                            devLog.why = 'registration via API'
                            devLog.when = new Date().toISOString();
                            devLog.message = `ERROR: saving configuration - ${error.message}`;
                            devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                            if (config.DEV){
                                logger.log(devLog,'ERROR'); // Send to LogDNA
                            }
                            console.log(devLog); // Send to terminal too
                            delete devLog.error_data;
                            return process.exit(0); // Hard fail
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
        .action(function(email) {
            let nextstep = function(email) {
                input.hidden('Password: ', function(password) {
                    input.done();

                    email = email.toLowerCase();
                    
                    devLog.what = 'LogDNA login';

                    if (!EMAIL_REGEX.test(email)) {
                        devLog.why = 'regex failed to validate'
                        devLog.when = new Date().toISOString();
                        devLog.message = `Invalid email address of ${email}`;
                     
                        if (config.DEV){
                            logger.log(devLog,'ERROR'); // Send to LogDNA
                        }
                        
                        console.log(devLog); // Display in console too
                        return process.exit(0); // Hard fail
                    }

                    utils.apiPost(config, 'login', {
                        auth: email + ':' + password
                    }, function(error, body) {
                        devLog.what = 'login'
                        
                        if (error) {
                            devLog.why = 'signing in'
                            devLog.when = new Date().toISOString();
                            devLog.message = `ERROR: ${devLog.why} - ${error.message}`;
                            devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                            if (config.DEV){
                                logger.log(devLog,'ERROR'); // Send to LogDNA
                            }
                            console.log(devLog); // Send to terminal too
                            delete devLog.error_data;
                            return process.exit(0); // Hard fail
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
                            devLog.what = 'saving configuration'
                            if (error) {
                                devLog.why = 'registration via API'
                                devLog.when = new Date().toISOString();
                                devLog.message = `ERROR: saving configuration - ${error.message}`;
                                devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                                if (config.DEV){
                                    logger.log(devLog,'ERROR'); // Send to LogDNA
                                }
                                console.log(devLog); // Send to terminal too
                                delete devLog.error_data;
                                return process.exit(0); // Hard fail
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
        .action(function(query, options) {
            let params = utils.authParams(config);
            params.q = query || '';

            devLog.what = `tailing logs using query "${params.q}"`;

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
                    devLog.why = 'malformed line: '+err.message
                    devLog.when = new Date().toISOString();
                    devLog.message = `ERROR: ${devLog.why}`;
                    devLog.error_data = {'message':err.message,'code':err.code,'stack':err.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                    return process.exit(0); // Hard fail
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
                raw_err = err;
                err = err.toString();
                devLog.when = new Date().toISOString();
                if (err.indexOf('401') > -1) {
                    // invalid token
                    devLog.why = 'access token invlaid. If you created or changed your password recently, please \'logdna login\' or \'logdna ssologin\' again. Type \'logdna --help\' for more info.';
                    devLog.message = `ERROR: ${devLog.why}`;
                    devLog.error_data = {'message':raw_err.message,'code':raw_err.code,'stack':raw_err.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                    return process.exit();
                } else {
                    devLog.why = err;
                    devLog.message = "ERROR: "+devLog.why
                    devLog.error_data = {'message':raw_err.message,'code':raw_err.code,'stack':raw_err.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                }
            });

            ws.on('close', function() {
                utils.uiDisp('tail lost connection', null, 'error');
            });
        });

    program.command('switch')
        .description('If your login has access to more than one account, this command allows you to switch between them')
        .action(function(options) {
            devLog.what = "Switching LogDNA account"
            utils.apiGet(config, 'orgs', {}, function(error, response) {
                if (error) {
                    devLog.why = "Error: "+error.message;
                    devLog.when = new Date().toISOString();
                    devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                    return process.exit(0);
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
                        devLog.what = 'saving configuration'
                        if (error) {
                            devLog.why = 'registration via API'
                            devLog.when = new Date().toISOString();
                            devLog.message = `ERROR: saving configuration - ${error.message}`;
                            devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                            if (config.DEV){
                                logger.log(devLog,'ERROR'); // Send to LogDNA
                            }
                            console.log(devLog); // Send to terminal too
                            delete devLog.error_data;
                            return process.exit(0); // Hard fail
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
        .action(function(query, options) {
            let params = {
                q: query || ''
            };

            if (options.preferHead) params.prefer = 'head';

            if (options.timeframe) {
                devLog.why = 'search timeframe - chrono nlp'
                devLog.what = options.timeframe;
                try {
                    devLog.when = new Date().toISOString();
                    devLog.message = `SUCCESS: ${devLog.who} parsing --timeframe "${devLog.what}"`;
                    
                    if (config.DEV) {
                        logger.log(devLog,'DEBUG'); // Send to LogDNA
                        console.log(devLog); // Send to terminal too
                    }

                    // Chrono parse
                    tf_obj = chrono.parse(options.timeframe)[0];

                    // Grab the From
                    let from_date = tf_obj.start.date();
                    params.from = from_date.getTime();
                    devLog.message = `SUCCESS: ${devLog.who} search --timeframe from "${from_date}"`;
                    devLog.when = new Date().toISOString();
                    devLog.why = 'search timeframe:from - chrono nlp'
                    if (config.DEV){
                        logger.log(devLog,'DEBUG'); // Send to LogDNA
                        console.log(devLog); // Send to terminal too
                    }

                    // Grab the To (when applicable)
                    if (tf_obj.end) {
                        let to_date = tf_obj.end.date();
                        params.to = to_date.getTime();
                        devLog.message = `SUCCESS: ${devLog.who} search --timeframe to "${to_date}"`;
                        devLog.when = new Date().toISOString();
                        devLog.why = 'search timeframe:to - chrono nlp'
                        if (config.DEV){
                            logger.log(devLog,'DEBUG'); // Send to LogDNA
                            console.log(devLog); // Send to terminal too
                        }
                    }
                } catch (err) {
                    devLog.message = 'ERROR: '+devLog.why+' - '+err.message;
                    devLog.when = new Date().toISOString();
                    devLog.why = 'ERROR - '+devLog.why;
                    devLog.error_data = {'message':err.message,'code':err.code,'stack':err.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                        console.log(devLog); // Send to terminal too
                    }
                    delete devLog.error_data;
                }
            } else { // Skip From and To if Timeframe is used
                if (options.from) {
                    devLog.what = options.from;
                    try {
                        devLog.why = 'search from - timestamp'
                        devLog.when = new Date().toISOString();
                        params.from = new Date(parseInt(options.from)).getTime();
                        devLog.message = `SUCCESS: ${devLog.who} search --from "${params.from}"`;
                        if (isNaN(params.from)) { // Int parsing failed
                            devLog.why = 'search from - chrono nlp'
                            tf_obj = chrono.parse(options.from)[0];

                            let from_date = tf_obj.start.date();
                            params.from = from_date.getTime();
                            
                            devLog.message = `SUCCESS: ${devLog.who} search --from "${from_date}"`;
                            devLog.when = new Date().toISOString();
                        }
                        if (config.DEV){
                            logger.log(devLog,'DEBUG'); // Send to LogDNA
                            console.log(devLog); // Send to terminal too
                        }
                    } catch (err) {
                        devLog.message = 'ERROR: '+devLog.why+' - '+err.message;
                        devLog.when = new Date().toISOString();
                        devLog.why = 'ERROR - '+devLog.why;
                        devLog.error_data = {'message':err.message,'code':err.code,'stack':err.stack};
                        if (config.DEV){
                            logger.log(devLog,'ERROR'); // Send to LogDNA
                            console.log(devLog); // Send to terminal too
                        }
                        delete devLog.error_data;
                    }
                }

                if (options.to) {
                    devLog.what = options.to;
                    try {
                        devLog.why = 'search to - timestamp'
                        devLog.when = new Date().toISOString();
                        params.to = new Date(parseInt(options.to)).getTime();
                        devLog.message = `SUCCESS: ${devLog.who} search --to "${params.to}"`;
                        if (isNaN(params.to)) { // Int parsing failed
                            devLog.why = 'search to - chrono nlp'
                            tf_obj = chrono.parse(options.to)[0];
                            
                            let to_date = tf_obj.start.date();
                            params.to = to_date.getTime();
                            
                            devLog.message = `SUCCESS: ${devLog.who} search --to "${to_date}"`;
                            devLog.when = new Date().toISOString();
                        }
                        if (config.DEV){
                            logger.log(devLog,'DEBUG'); // Send to LogDNA
                            console.log(devLog); // Send to terminal too
                        }
                    } catch (err) {
                        devLog.message = 'ERROR: '+devLog.why+' - '+err.message;
                        devLog.when = new Date().toISOString();
                        devLog.why = 'ERROR - '+devLog.why;
                        devLog.error_data = {'message':err.message,'code':err.code,'stack':err.stack};
                        if (config.DEV){
                            logger.log(devLog,'ERROR'); // Send to LogDNA
                            console.log(devLog); // Send to terminal too
                        }
                        delete devLog.error_data;
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
                } catch (err) {
                }
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
                devLog.why = 'API call to search';
                if (error) {
                    devLog.message = 'ERROR: '+devLog.why+' - '+error.message;
                    devLog.when = new Date().toISOString();
                    devLog.why = 'ERROR - '+devLog.why;
                    devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                    return proccess.exit(0);
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
                    devLog.what = 'saving configuration'
                    if (error) {
                        devLog.why = 'registration via API'
                        devLog.when = new Date().toISOString();
                        devLog.message = `ERROR: saving configuration - ${error.message}`;
                        devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                        if (config.DEV){
                            logger.log(devLog,'ERROR'); // Send to LogDNA
                        }
                        console.log(devLog); // Send to terminal too
                        delete devLog.error_data;
                        return process.exit(0); // Hard fail
                    }
                });
            });
        });

    program.command('info')
        .alias('whoami')
        .description('Show current logged in user info')
        .action(function() {
            utils.apiGet(config, 'info', function(error, body) {
                
                devLog.what = "displaying current logged in user info";
                if (error) {
                    devLog.why = "Error: "+error.message;
                    devLog.when = new Date().toISOString();
                    devLog.error_data = {'message':error.message,'code':error.code,'stack':error.stack};
                    if (config.DEV){
                        logger.log(devLog,'ERROR'); // Send to LogDNA
                    }
                    console.log(devLog); // Send to terminal too
                    delete devLog.error_data;
                    return process.exit(0);
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
