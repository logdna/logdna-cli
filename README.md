# LogDNA CLI

The LogDNA CLI allows you to sign up for a new account and tail your logs right from the command line.

## Deprecation Notice: LogDNA CLI deprecates supporting CentOS 6 and Debian 8 as of v2.

## Getting Started

### macOS

Download the [LogDNA CLI installer for Mac](http://repo.logdna.com/mac/logdna-cli.pkg).  

Alternatively install via [brew cask](https://caskroom.github.io/):
```
brew cask update
brew cask install logdna-cli
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
| `logdna register [email]` | Register a new LogDNA account |
| `logdna ssologin` | Log in to a LogDNA via single sign-on |
| `logdna login [email]` | Log in to LogDNA |
| `logdna tail [options] [query]` | Live tail with optional filtering. Options include `-h`, `-a`, `-l`, `-t` to filter by hosts, apps, levels or tags respectively. Run `logdna tail --help` to learn more. |
| `logdna switch` | If your login has access to more than one account, this command allows you to switch between them |
| `logdna search [options] [query]` | Basic search with optional filtering. Run `logdna search --help` for options. |
| `logdna info` | Show current logged in user info |
| `logdna update` | Update the CLI to the latest version |

### Examples

```sh
# Register
$ logdna register user@example.com

# Login
$ logdna login user@example.com

# Tail
$ logdna tail '("timed out" OR "connection refused") -request'
$ logdna tail -a access.log 500
$ logdna tail -l error,warn

# Search
$ logdna search "logdna cli" -a logdna.log -t tag1,tag2 -n 300
$ logdna search "logdna" --from 1541100040931 --to 1541102940000

# Other
$ logdna info
$ logdna update

# Switch organization
$ logdna switch

> 1: ACME (active)
> 2: Strickland Propane
> Choose account [1-2]:
```

## Contributing

Contributions are always welcome. See the [contributing guide](./CONTRIBUTING.md) to learn how you can help.
