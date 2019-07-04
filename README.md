# logdna-cli

The LogDNA CLI allows you to signup for a new account and tail your servers right from the command line.

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
npm install

# help
sudo node index.js --help

# login using one of commands below
sudo node index.js login
sudo node index.js ssologin
```

## Building Binaries

To build the cli, ensure you have [nexe](https://www.npmjs.com/package/nexe) installed. This packages the LogDNA CLI as a native executable with the node.js runtime bundled. This will automatically build the runtime from source.

### Linux

Ensure you have a native C++ compiler installed.

### Windows

Ensure you have Visual Studio 2015 or newer installed.

### macOS

Ensure you have Xcode 7 or newer installed.

### Creating the binary

To start the build:

```
grunt build
```

This takes a bit of time and will output a binary at `./logdna` (or `.\logdna.exe` if on Windows). For the initial build, majority of time will be spent building node.js. Subsequent builds will be much faster as node.js would've already been built.

## Packaging Binaries

### Linux

```
sudo gem install fpm
sudo yum install rpm-build createrepo
sudo yum --enablerepo=epel install dpkg-devel dpkg-dev
grunt linux
```

This will output the `deb` and `yum` files to the root of the repo.

### Windows

Install [chocolatey](https://chocolatey.org). Then do:

```
grunt windows
```

This will output the chocolatey package under `.\.builds\windows`.

### macOS

```
gem install fpm
grunt mac
```

This will output the `pkg` file to the root of the repo. Signing will likely fail since we typically sign it with our Apple Developer key, but the package should still be usable, just unsigned.


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
$ logdna register user@example.com b7c0487cfa5fa7327c9a166c6418598d # use this if you were assigned an Ingestion Key

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
```

## Contributing

Contributions are always welcome. See the [contributing guide](./CONTRIBUTING.md) to learn how you can help.
