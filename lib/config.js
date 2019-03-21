module.exports = {
    DEFAULT_CONF_FILE: '~/.logdna.conf'.replace('~', process.env.HOME || process.env.USERPROFILE)
    , DEFAULT_TIMEOUT: 2500
    , FORCE_TIMEOUT: 30000
    , LOGDNA_APIHOST: process.env.LDAPIHOST || 'api.logdna.com'
    , LOGDNA_APISSL: isNaN(process.env.USESSL) ? true : +process.env.USESSL
    , LOGDNA_APPHOST: process.env.LDAPPHOST || ''
    , LOGDNA_TAILHOST: process.env.LDTAILHOST || 'tail.logdna.com'
    , SSO_LONG_PATH: '/ext/cli-sso/'
    , SSO_POLL_INTERVAL: 5000 // 5s
    , SSO_URL: 'https://logdna.com/sso/'
    , SUPPORTS_COLORS: /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM) && (!process.stdout || process.stdout.isTTY) // ensure console supports colors and not being piped
    , UPDATE_CHECK_INTERVAL: 86400000 // 1 day
    , UPDATE_CHECK_URL: 'https://repo.logdna.com/PLATFORM/logdna.gz'
    , VERSION_CHECK_URL: 'https://repo.logdna.com/PLATFORM/version'
    , WS: {
        DELAY: 1000
        , DELAY_MAX: 5000
        , TIMEOUT: 20000
        , ATTEMPT: 0
        , FACTOR: 1.5
    }
};
