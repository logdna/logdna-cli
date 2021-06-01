// Configuration when logging as a developer.  Default is to send to LogDNA.  API Key required via environment variable LOGDNA_API_KEY

module.exports = {
    LOGDNA_LOGGING: {
          APP: "LogDNA_CLI"
        , HOSTNAME: "test-env"
        , TAGS: ["LogDNA_CLI","dev"]
        , DEFAULT_LEVEL: "INFO"
        , INDEXMETA: true
        , ENDPOINT_URL: "https://logs.logdna.com/logs/ingest"
        , API_KEY: process.env.LOGDNA_API_KEY  /* SET THIS ENV VARIABLE TO SEE LOGS IN LOGDNA */
        , OPTIONS: {
            level: 'DEBUG' // Default level to log to
        }
    }
};
