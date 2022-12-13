# LogDNA CLI

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-14-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

The LogDNA CLI allows you to sign up for a new account and tail your logs right from the command line.

## Deprecation Notice: LogDNA CLI deprecates supporting CentOS 6 and Debian 8 as of v2.

## Getting Started

Note that prebuilt images are of [v2.0.0](https://github.com/logdna/logdna-cli/tree/2.0.0) (without natural language time), not of [master](https://github.com/logdna/logdna-cli/tree/master).  Please bear with us as we convert to an automated release pipeline for this repo.

### macOS

Download the [LogDNA CLI installer for Mac](http://repo.logdna.com/mac/logdna-cli.pkg).  

Alternatively install via [brew cask](https://caskroom.github.io/):
```
brew cask update
brew install --cask logdna-cli
```

### Windows

To install on Windows, using [chocolatey](https://chocolatey.org):

```
choco install logdna
```

### Linux

For Ubuntu/Debian:

```bash
sudo wget -qO /tmp/logdna-cli.deb http://repo.logdna.com/linux/logdna-cli.deb && sudo dpkg -i /tmp/logdna-cli.deb
```

For RHEL/CentOS:

```bash
sudo wget -qO /tmp/logdna-cli.rpm http://repo.logdna.com/linux/logdna-cli.rpm && sudo rpm -ivh /tmp/logdna-cli.rpm
```

### From Source

Follow these quick instructions to run the LogDNA CLI from source:

```
git clone https://github.com/logdna/logdna-cli.git
cd logdna-cli
npm install --production

# help
node index.js --help

# login using one of commands below
node index.js login
node index.js ssologin
```

## Usage

| Command | Description |
| - | - |
| ~~`logdna register [email]`~~ | _This command is no longer functional.  Please use https://www.mezmo.com/sign-up-today to register_ |
| `logdna ssologin` | Log in to a LogDNA via single sign-on |
| `logdna login [email]` | Log in to LogDNA |
| `logdna tail [options] [query]` | Live tail with optional filtering. Options include `-h`, `-a`, `-l`, `-t` to filter by hosts, apps, levels or tags respectively. Run `logdna tail --help` to learn more. |
| `logdna switch` | If your login has access to more than one account, this command allows you to switch between them |
| `logdna search [options] [query]` | Basic search with optional filtering. Run `logdna search --help` for options. |
| `logdna info` | Show current logged in user info |
| `logdna update` | Update the CLI to the latest version |

### Examples

```sh
# Login
$ logdna login user@example.com

# Tail
$ logdna tail '("timed out" OR "connection refused") -request'
$ logdna tail -a access.log 500
$ logdna tail -l error,warn

# Search
$ logdna search "logdna cli" -a logdna.log -t tag1,tag2 -n 300
# Search via UNIX timestamps
$ logdna search "logdna" --from 1541100040931 --to 1541102940000
# Search via Natural Language (Chrono)
# Ensure to enclose natural langauge strings in ""
# Must include date reference (i.e., `May 26`, `yesterday`, or the like)
$ logdna search "logdna" --from "yesterday at 3pm" --to "today at 3:05pm"
$ logdna search "logdna" --timeframe "May 26 at 3pm to 3:05pm"
# Search with dev logs
$ logdna search "logdna" --timeframe "May 28 at 1pm to 3:05pm" -d

# Other
$ logdna info
$ logdna update

# Switch organization
$ logdna switch

> 1: ACME (active)
> 2: Strickland Propane
> Choose account [1-2]:
```

## Developer Logs
Logs for troubleshooting during development are included. These logs will pipe to console and optionally to [LogDNA](https://www.logdna.com/).

Switch dev logs on via the `-d` or `--dev` flag.

In order to pipe the developer logs to LogDNA, you should set the account API Key using `LOGDNA_API_KEY` environment variable.  Otherwise, dev logs will only been seen in the console.

Currently the dev log coverage is limited to the code regarding `--timeframe`, `--from` and `--to` in [index.js](./index.js).


## Contributing

Contributions are always welcome. See the [contributing guide](./CONTRIBUTING.md) to learn how you can help.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/yields"><img src="https://avatars.githubusercontent.com/u/1661587?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Amir Abushareb</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=yields" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=yields" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/braxtonj"><img src="https://avatars.githubusercontent.com/u/7331755?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Braxton</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=braxtonj" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=braxtonj" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/meffij"><img src="https://avatars.githubusercontent.com/u/8787479?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Calvin Cochran</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=meffij" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=meffij" title="Documentation">📖</a></td>
    <td align="center"><a href="https://ernesti.me/"><img src="https://avatars.githubusercontent.com/u/20255948?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ernest Iliiasov</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=ernestii" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=ernestii" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/jakedipity"><img src="https://avatars.githubusercontent.com/u/29671917?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jacob Hull</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=jakedipity" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=jakedipity" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/stuckj"><img src="https://avatars.githubusercontent.com/u/2205578?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jonathan Stucklen</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=stuckj" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=stuckj" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/leeliu"><img src="https://avatars.githubusercontent.com/u/1399797?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Lee Liu</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=leeliu" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=leeliu" title="Documentation">📖</a> <a href="https://github.com/logdna/logdna-cli/commits?author=leeliu" title="Tests">⚠️</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/mikehu"><img src="https://avatars.githubusercontent.com/u/981800?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike Hu</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=mikehu" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/respectus"><img src="https://avatars.githubusercontent.com/u/1046364?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Muaz Siddiqui</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=respectus" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=respectus" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/beefcheeks"><img src="https://avatars.githubusercontent.com/u/4133158?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ryan</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=beefcheeks" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=beefcheeks" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/smusali"><img src="https://avatars.githubusercontent.com/u/34287490?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Samir Musali</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=smusali" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=smusali" title="Documentation">📖</a> <a href="https://github.com/logdna/logdna-cli/commits?author=smusali" title="Tests">⚠️</a></td>
    <td align="center"><a href="http://stevenedouard.com/"><img src="https://avatars.githubusercontent.com/u/3053263?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Steven Edouard</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=sedouard" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=sedouard" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/ydshah2"><img src="https://avatars.githubusercontent.com/u/11240269?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yash Shah</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=ydshah2" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=ydshah2" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/vilyapilya"><img src="https://avatars.githubusercontent.com/u/17367511?v=4?s=100" width="100px;" alt=""/><br /><sub><b>vilyapilya</b></sub></a><br /><a href="https://github.com/logdna/logdna-cli/commits?author=vilyapilya" title="Code">💻</a> <a href="https://github.com/logdna/logdna-cli/commits?author=vilyapilya" title="Documentation">📖</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
