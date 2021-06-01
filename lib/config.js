module.exports = {
    // Configuration
    DEFAULT_CONF_FILE: '~/.logdna.conf'.replace('~', process.env.HOME || process.env.USERPROFILE)
    , SUPPORTS_COLORS: /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM) && (!process.stdout || process.stdout.isTTY) // ensure console supports colors and not being piped
    
    // LogDNA Developer Loggging Settings
    , LOGDNA_LOGGING: {
        APP: "LogDNA_CLI"
        , HOSTNAME: "test-env"
        , TAGS: ["LogDNA_CLI","dev"]
        , DEFAULT_LEVEL: "INFO"
        , INDEXMETA: true
        , ENDPOINT_URL: "https://logs.logdna.com/logs/ingest"
        , API_KEY: process.env.LOGDNA_API_KEY || '' /* SET THIS ENV VARIABLE TO SEE LOGS IN LOGDNA */
        , OPTIONS: {
            level: 'DEBUG' // Default level to log to
        }
    }
    
    // LogDNA System Specifics
    , VERSION_CHECK_URL: 'https://repo.logdna.com/PLATFORM/version'
    , UPDATE_CHECK_URL: 'https://repo.logdna.com/PLATFORM/logdna.gz'
    , UPDATE_CHECK_INTERVAL: 86400000 // 1 day
    , SSO_URL: 'https://logdna.com/sso/'
    , SSO_LONG_PATH: '/ext/cli-sso/'
    , SSO_POLL_INTERVAL: 5000 // 5s
    , LOGDNA_APIHOST: process.env.LDAPIHOST || 'api.logdna.com'
    , LOGDNA_TAILHOST: process.env.LDTAILHOST || 'tail.logdna.com'
    , LOGDNA_APPHOST: process.env.LDAPPHOST || ''
    , LOGDNA_APISSL: isNaN(process.env.USESSL) ? true : +process.env.USESSL
};
