# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v2.0.0] - 2021-06-01
### Changed
- Natural Language Processing on timestamps using [Chrono](https://github.com/wanasit/chrono).  Introduction of --timeframe option for search.  Addition of developer logging via LogDNA for troubleshooting.
- Changed CONTRIBUTING.md to reflect "fork-and-PR" process

### TODO
- Dev logs currently only in index.js.  Extend for full coverage
- Add "today" when a date reference isn't explicity included (ie `search --from "7PM" --to "8PM"` instead of `search --from "today at 7PM" --to "today at 8PM"`)
- Systematic testing

## [v2.0.0] - 2020-05-21
### Fixed
- Fix `Cannot read property 'statusCode' of undefined` when updating [#40](https://github.com/logdna/logdna-cli/pull/40)

### Changed
- Write information output to stderr for tail and search [#43](https://github.com/logdna/logdna-cli/pull/43)
- Reorganize and modify package info [#45](https://github.com/logdna/logdna-cli/pull/45)

## [v1.4.1] - 2019-08-14
### Changed
- Don't show error if the configuration file does not exist [#38](https://github.com/logdna/logdna-cli/pull/38)

## [v1.4.0] - 2019-08-13
### Changed
- Don't require super user [#36](https://github.com/logdna/logdna-cli/pull/36)

### Added
- Add Usage Information to Readme [#35](https://github.com/logdna/logdna-cli/pull/35)

### Fixed
- Update packages and fix authentication [#33](https://github.com/logdna/logdna-cli/pull/33)

## [v1.3.1] - 2019-02-14
### Fixed
- Fix SSO Login [#25](https://github.com/logdna/logdna-cli/pull/25)
- Fix NPM Vulnerabilities [#24](https://github.com/logdna/logdna-cli/pull/24)
- Fix issue with search where results with only 1 result aren't properly displayed [#23](https://github.com/logdna/logdna-cli/pull/23)

### Changed
- Use `request` instead of `got` [#22](https://github.com/logdna/logdna-cli/pull/22)

## [v1.3.0] - 2018-11-09
### Fixed
- Fix the issues and update the CLI [#21](https://github.com/logdna/logdna-cli/pull/21)
- Fix incorrect query parameter to the search API [#16](https://github.com/logdna/logdna-cli/pull/16)

## [v1.2.2] - 2017-10-11
### Added
- Add SSO support to CLI

## [v1.2.1] - 2017-09-25
### Added
- Add --json option [#12](https://github.com/logdna/logdna-cli/pull/12)

## [v1.2.0] - 2017-05-25
### Added
- `switch` option
- ANSI color for levels

### Changed
- `logdna search` now uses `Export API`

## [v1.1.1] - 2017-02-03
### Fixed
- Fix tailing

### Changed
- ANSI color support for `tail`/`search`
- Specify or omit email on command line support for both `login` and `register`

### Added
- Add Kubernetes and Docker instructions
- Add `-h` help option for `tail`/`search`

## [v1.1.0] - 2016-08-24
### Fixed
- Fix various authentication issues

### Added
- Add instructions for Syslog, Heroku, API, Node.js
- Add `brew cask` install option for Mac [#5](https://github.com/logdna/logdna-cli/pull/5)

## [v1.0.9] - 2016-03-29
### Added
- Add Windows and Mac support for CLI
- Add instructions for Windows Hosts by doing `logdna install windows` [#1](https://github.com/logdna/logdna-cli/pull/1)


[v2.0.0]: https://github.com/answerbook/logdna-workers/compare/v1.4.1...v2.0.0
[v1.4.1]: https://github.com/answerbook/logdna-workers/compare/v1.4.0...v1.4.1
[v1.4.0]: https://github.com/answerbook/logdna-workers/compare/v1.3.1...v1.4.0
[v1.3.1]: https://github.com/answerbook/logdna-workers/compare/v1.3.0...v1.3.1
[v1.3.0]: https://github.com/answerbook/logdna-workers/compare/v1.2.2...v1.3.0
[v1.2.2]: https://github.com/answerbook/logdna-workers/compare/v1.2.1...v1.2.2
[v1.2.1]: https://github.com/answerbook/logdna-workers/compare/v1.2.0...v1.2.1
[v1.2.0]: https://github.com/answerbook/logdna-workers/compare/v1.1.1...v1.2.0
[v1.1.1]: https://github.com/answerbook/logdna-workers/compare/v1.0.9...v1.1.1
[v1.1.0]: https://github.com/answerbook/logdna-workers/compare/v1.0.9...v1.1.0
[v1.0.9]: https://github.com/answerbook/logdna-workers/releases/tag/v1.0.9
