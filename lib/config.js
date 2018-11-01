module.exports = {
    VERSION_CHECK_URL: 'http://repo.logdna.com/PLATFORM/version'
    , UPDATE_CHECK_URL: 'http://repo.logdna.com/PLATFORM/logdna.gz'
    , UPDATE_CHECK_INTERVAL: 86400000 // 1 day
    , SSO_URL: 'https://logdna.com/sso/'
    , SSO_POLL_INTERVAL: 5000 // 5s
    , DEFAULT_CONF_FILE: '~/.logdna.conf'.replace('~', process.env.HOME || process.env.USERPROFILE)
    , LOGDNA_APIHOST: process.env.LDAPIHOST || 'api.logdna.com'
    , LOGDNA_TAILHOST: process.env.LDTAILHOST || 'tail.logdna.com'
    , LOGDNA_APISSL: isNaN(process.env.USESSL) ? true : +process.env.USESSL
    , SUPPORTS_COLORS: /^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM) && (!process.stdout || process.stdout.isTTY) // ensure console supports colors and not being piped
    , EMAIL_REGEX: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    , ERROR_LEVEL_TEST: /[Ee]rr(?:or)?|ERR(?:OR)?|[Cc]rit(?:ical)?|CRIT(?:ICAL)?|[Ff]atal|FATAL|[Ss]evere|SEVERE|EMERG(?:ENCY)?|[Ee]merg(?:ency)?/
    , WARN_LEVEL_TEST: /[Ww]arn(?:ing)?|WARN(?:ING)?/
};
