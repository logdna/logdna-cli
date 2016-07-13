# logdna-cli

The LogDNA CLI allows you to signup for a new account and tail your servers right from the command line.

## Installation

### OS X

Download the [LogDNA CLI installer for Mac] (http://repo.logdna.com/mac/logdna-cli.pkg).  

Alternatively install via [brew cask](https://caskroom.github.io/):
```
brew cask update
```
```
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
wget -qO /tmp/logdna-cli.deb http://repo.logdna.com/linux/logdna-cli.deb && sudo dpkg -i /tmp/logdna-cli.deb
```

### Using the CLI

Go to the [LogDNA website](https://logdna.com), select your OS and follow the instructions.

### Building the CLI

If you would like to build the CLI yourself, follow the instructions below.

Requirements:
* Node version 5
* grunt (```npm install -g grunt```)
* fpm (```gem install fpm```)
* gnu-tar, if you are building a Linux binary (```brew install gnu-tar```)
* nexe, if you are building a Windows binary (```npm install -g nexe```)

Once you've cloned the repo and entered the directory, exceute:
```
npm install
```
Choose the appropriate target:
```
grunt mac
grunt linux
grunt windows
```

## Contributing

Contributions are always welcome. See the [contributing guide](./CONTRIBUTING.md) to learn how you can help.
