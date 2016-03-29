#!/usr/bin/env node

var program = require('commander');
var pkg = require('./package.json');
var properties = require("properties");
var _ = require("lodash");
var WebSocket = require('./lib/logdna-websocket');
var minireq = require("./lib/minireq");
var input = require("./lib/input");
var semver = require("semver");
var os = require("os");
var qs = require("querystring");
var crypto = require("crypto");
var spawn = require('child_process').spawn;

var UPDATE_CHECK_URL = "http://repo.logdna.com/PLATFORM/version";
var UPDATE_UPDATE_URL = "http://repo.logdna.com/PLATFORM/logdna.gz";
var UPDATE_CHECK_INTERVAL = 86400000; // 1 day
var DEFAULT_CONF_FILE = "~/.logdna.conf".replace("~", process.env.HOME || process.env.USERPROFILE);
var LOGDNA_APIHOST = process.env.LDAPIHOST || "api.logdna.com";
var LOGDNA_APISSL = isNaN(process.env.USESSL) ? true : +process.env.USESSL;

var EMAIL_REGEX = /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

process.title = 'logdna';
program._name = 'logdna';
program
    .version(pkg.version, "-v, --version")
    .usage("[options] [commands]\n\n  This CLI duplicates useful functionality of the LogDNA web app.")
    // .description('This CLI duplicates useful functionality of the LogDNA web app.')
    .on('--help', function() {
        log('  Examples:');
        log();
        log('    $ logdna register user@example.com');
        log('    $ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d    # use this if you were assigned an API Key');
        log('    $ logdna tail \'("timed out" OR "connection refused") -request\'');
        log('    $ logdna tail -a access.log 500');
        log('    $ logdna tail -l error,warn');
        log();
    });

minireq.setUA(program._name + "-cli/" + pkg.version);

properties.parse(DEFAULT_CONF_FILE, { path: true }, function(error, config) {
    config = config || {};

    performUpgrade(config, function() {

        program.command('register <email> [key]')
            .description('Register a new LogDNA account. [key] is optional and will autogenerate')
            .action(function(email, key) {
                email = email.toLowerCase();
                if (!EMAIL_REGEX.test(email))
                    return log("Invalid email address");

                input.required("First name: ", function(firstname) {
                    input.required("Last name: ", function(lastname) {
                        input.required("Company/Organization: ", function(company) {
                            input.done();

                            key = (key || '').toLowerCase();
                            minireq.post( (LOGDNA_APISSL ? "https://" : "http://") + LOGDNA_APIHOST + "/register", { email: email, key: key, firstname: firstname, lastname: lastname, company: company }, handleReqError(function(res, body) {
                                config.email = email;
                                if (config.account != body.account) {
                                    config.account = body.account;
                                    config.token = null;
                                }
                                config.key = body.key;
                                if (body.token) config.token = body.token; // save token if available

                                saveConfig(config, function() {
                                    log("Thank you for signing up! Your API Key is: " + body.key + ". Saving credentials to local config.");
                                    log();
                                    log("Next steps:");
                                    log("===========");
                                    log("1) We've sent you a welcome email to create your password. Enter it using 'logdna login'");
                                    log("2) Install our log collector agent on to your staging/production hosts. See 'logdna install' for more info.");
                                    log("3) Or, if you use Heroku, use 'logdna heroku <heroku-app-name>' instead to set up log shipping.");
                                    return;
                                });
                            }));
                        });
                    });
                });
            });

        program.command('login')
            .description('Login to a LogDNA user account')
            .action(function() {
                input.required("Email: ", function(email) {
                    input.hidden("Password: ", function(password) {
                        input.done();

                        email = email.toLowerCase();
                        if (!EMAIL_REGEX.test(email))
                            return log("Invalid email address");

                        minireq.post( (LOGDNA_APISSL ? "https://" : "http://") + encodeURIComponent(email) + ":" + encodeURIComponent(password) + "@" +LOGDNA_APIHOST + "/login", null, handleReqError(function(res, body) {
                            config.email = email;
                            if (body.accounts.length && config.account != body.accounts[0]) {
                                config.account = body.accounts[0];
                                config.key = null;
                            }
                            if (body.keys && body.keys.length) config.key = body.keys[0];
                            config.token = body.token;

                            saveConfig(config, function() {
                                log("Logged in successfully as: " + email + ". Saving credentials to local config.");
                            });
                        }));
                    });
                });
            });

        program.command('tail [query]')
            .description("Realtime tail with optional filtering. See 'logdna tail --help'")
            .option('-d, --debug', "Show debug level messages. Filtered by default")
            .option('-h, --hosts <hosts>', "Filter on hosts (separate by comma)")
            .option('-a, --apps <apps>', "Filter on apps (separate by comma)")
            .option('-l, --levels <levels>', "Filter on levels (separate by comma)")
            .action(function(query, options) {
                var params = authParams(config);
                params.q = query || "";

                if (!options.debug)
                    params.q += " level:-debug";

                if (options.hosts)
                    params.hosts = options.hosts.replace(/, /g, ",");

                if (options.apps)
                    params.apps = options.apps.replace(/, /g, ",");

                if (options.levels)
                    params.levels = options.levels.replace(/, /g, ",");

                params.q = params.q.trim();

                var ws = new WebSocket( (LOGDNA_APISSL ? "https://" : "http://") + LOGDNA_APIHOST + "/ws/tail?" + qs.stringify(params) );
                var t;

                ws.on('open', function open() {
                    log("tail started. hosts: " + (options.hosts || "all") + ". apps: " + (options.apps || "all") + ". levels: " + (options.levels || (options.debug ? "all" : "-debug")) + ". query: " + (query || "none"));
                });

                ws.on('reconnecting', function(num) {
                    log("tail reconnect attmpt #" + num + "...");
                });

                ws.on('message', function(data) {
                    if (data.substring(0, 1) == "{")
                        data = JSON.parse(data);

                    t = new Date(data.p._ts);
                    log(t.toString().substring(4,11) + t.toString().substring(16,24) + " " + data.p._host + " " + data.p._app + " " + (data.p.level ? "[" + data.p.level + "] " : "") + data.p._line);
                });

                ws.on('error', function (err) {
                    log("Error: " + err);
                });

                ws.on('close', function () {
                    log('tail lost connection');
                });
            });

        program.command('search [query]')
            .description("Search with optional filtering. See 'logdna search --help'")
            .option('-d, --debug', "Show debug level messages. Filtered by default")
            .option('-h, --hosts <hosts>', "Filter on hosts (separate by comma)")
            .option('-a, --apps <apps>', "Filter on apps (separate by comma)")
            .option('-l, --levels <levels>', "Filter on levels (separate by comma)")
            .action(function(query, options) {
                var params = {
                    q: query || ""
                };

                if (!options.debug)
                    params.q += " level:-debug";

                if (options.hosts)
                    params.hosts = options.hosts.replace(/, /g, ",");

                if (options.apps)
                    params.apps = options.apps.replace(/, /g, ",");

                if (options.levels)
                    params.levels = options.levels.replace(/, /g, ",");

                var t, t2, range;

                apiGet(config, "search", params, function(body) {
                    if (body.range && body.range.from && body.range.to) {
                        t = new Date(body.range.from);
                        t2 = new Date(body.range.to);
                        range = " between " + t.toString().substring(4,11) + t.toString().substring(16,24) + "-" + t2.toString().substring(4,11) + t2.toString().substring(16,24);
                    }

                    log("search finished: " + body.lines.length + " line(s)" + (range || "") + ". hosts: " + (options.hosts || "all") + ". apps: " + (options.apps || "all") + ". levels: " + (options.levels || (options.debug ? "all" : "-debug")) + ". query: " + (query || "none"));

                    _.each(body.lines, function(line) {
                        t = new Date(line._ts);
                        log(t.toString().substring(4,11) + t.toString().substring(16,24) + " " + line._host + " " + line._app + " " + (line.level ? "[" + line.level + "] " : "") + line._line);
                    });
                });
            });

        program.command('heroku <heroku-app-name>')
            .description("Generates a Heroku Drain URL for log shipping to LogDNA")
            .action(function(app) {
                if (!config.token)
                    return log("Please login first. Type 'logdna login' or 'logdna --help' for more info.");

                log("Use the following Heroku CLI command to start log shipping:");
                log('heroku drains:add https://' + config.account + ':' + (config.key || "YOUR_API_KEY_HERE") + '@heroku.logdna.com/heroku/logplex?app=' + app + ' --app ' + app);
                log();
                log("Once shipping begins, you can tail using 'logdna tail -h " + app + "'");

            });

        program.command('install <os>')
            .description("Install steps to get the LogDNA Collector Agent onto your staging/production hosts")
            .action(function(os) {
                try {
                    log(require("./install")[os].replace(/ZZZZZZZZ/g, (config.key || "YOUR_API_KEY_HERE")));
                } catch (e) {
                    log('OS Type: ' + os + ' is not a supported option. Valid options are:');
                    log('deb, rpm, windows');
                }
            });

        program.command('info')
            .description("Show current logged in user info")
            .action(function() {
                apiGet(config, "info", function(body) {
                    log(body);
                });
            });

        program.command("update")
            .description("Update CLI to latest version")
            .action(function() {
                performUpgrade(config, true, function() {
                    log("No update available. You have the latest version: " + pkg.version);
                });
            });

        program.parse(process.argv);
        if (!process.argv.slice(2).length) return program.outputHelp(); // show help if no commands given
    });
});

function apiGet(config, endpoint, params, callback) {
    apiCall(config, endpoint, "get", params, callback);
}

function apiPost(config, endpoint, params, callback) {
    apiCall(config, endpoint, "post", params, callback);
}

function apiCall(config, endpoint, method, params, callback) {
    if (typeof params == "function") {
        callback = params;
        params = null;
    }

    var hmacParams = authParams(config);

    if (method == "get") {
        params = _.extend(params || {}, hmacParams);

        minireq.get( (LOGDNA_APISSL ? "https://" : "http://") + LOGDNA_APIHOST + "/" + endpoint + "?" + qs.stringify(params), handleReqError(function(res, body) {
            callback(body);
        }));

    } else {
        minireq.post( (LOGDNA_APISSL ? "https://" : "http://") + LOGDNA_APIHOST + "/" + endpoint + "?" + qs.stringify(hmacParams), params, handleReqError(function(res, body) {
            callback(body);
        }));
    }
}

function authParams(config) {
    if (!config.token)
        return log("Please login first. Type 'logdna login' or 'logdna --help' for more info.");

    var hmacParams = {
        email: config.email
      , id: config.account
      , ts: Date.now()
    };

    hmacParams.hmac = generateHmac(hmacParams, config.token);
    return hmacParams;
}

function handleReqError(callback) {
    return function(err, res, body) {
        if (err || res.statusCode != "200") {
            if (err) {
                return log("HTTP Error: " + err);
            } else if (res.statusCode == "403") {
                return log("Access token invalid. If you created or changed your password recently, please 'logdna login' again. Type 'logdna --help' for more info.");
            } else {
                return log("Error " + res.statusCode + ": " + JSON.stringify(body));
            }
        }

        callback(res, body);
    };
}

function performUpgrade(config, force, callback) {
    if (typeof force == "function") {
        callback = force;
        force = null;
    }
    if (force || Date.now() - (config.updatecheck || 0) > UPDATE_CHECK_INTERVAL) {
        if (os.platform() == "darwin") {
            UPDATE_CHECK_URL = UPDATE_CHECK_URL.replace("PLATFORM", "mac");
            UPDATE_UPDATE_URL = UPDATE_UPDATE_URL.replace("PLATFORM", "mac");

        } else if (os.platform() == "linux") {
            UPDATE_CHECK_URL = UPDATE_CHECK_URL.replace("PLATFORM", "linux");
            UPDATE_UPDATE_URL = UPDATE_UPDATE_URL.replace("PLATFORM", "linux");
        }

        if (force) log("Checking for updates...");
        minireq.get(UPDATE_CHECK_URL, { timeout: (force ? 30000 : 2500) }, function(err, res, body) {
            if (err || !body || !semver.valid(body.replace(/\r/g, "").replace(/\n/g, ""))) {
                // error during update check, set to check again in a day
                config.updatecheck = Date.now() - UPDATE_CHECK_INTERVAL + 86400000;
                saveConfig(config);
                return callback && callback();
            }

            body = body.replace(/\r/g, "").replace(/\n/g, "");
            config.updatecheck = Date.now();
            saveConfig(config);

            if (semver.gt(body, pkg.version)) {
                // update needed
                log("Performing upgrade from " + pkg.version + " to " + body + "...");
                var shell = spawn('/bin/bash', ['-c',
                    'if [[ ! -z $(which curl) ]]; then curl -so /tmp/logdna.gz ' + UPDATE_UPDATE_URL + '; elif [[ ! -z $(which wget) ]]; then wget -qO /tmp/logdna.gz ' + UPDATE_UPDATE_URL + '; fi; gunzip -f /tmp/logdna.gz; cp -f /tmp/logdna /usr/local/logdna/bin/logdna; chmod 777 /usr/local/logdna/bin/logdna 2> /dev/null; echo -n "Successfully upgraded logdna-cli to "; /usr/local/bin/logdna -v'
                ], { stdio: 'inherit' });
                shell.on("close", function() {
                    if (!force && process.argv[process.argv.length-1].toLowerCase() != "update")
                        log("Please run your command again");
                });
                return;

            } else {
                // no update necessary, run rest of program
                return callback && callback();
            }
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
        if (err)
            console.error("Error while saving to: " + (DEFAULT_CONF_FILE) + ": " + err);
        else
            return callback && callback();
    });
}

function generateHmac(payload, secret) {
    var msg = qs.stringify(payload);
    return crypto.createHmac("sha256", secret.toString()).update(msg).digest("hex");
}

function log(msg) {
    console.log(msg || "");
}
