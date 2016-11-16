# logdna-cli

The LogDNA CLI allows you to signup for a new account and tail your servers right from the command line.

## Installation

### macOS

Download the [LogDNA CLI installer for Mac] (http://repo.logdna.com/mac/logdna-cli.pkg).  

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
wget -qO /tmp/logdna-cli.deb http://repo.logdna.com/linux/logdna-cli.deb && sudo dpkg -i /tmp/logdna-cli.deb
```

## Using the CLI

Go to the [LogDNA website](https://logdna.com), select your OS and follow the instructions.
You can also type: `logdna --help` or `node index --help` using the source.

## Building

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

## Packaging

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


## Contributing

Contributions are always welcome. See the [contributing guide](./CONTRIBUTING.md) to learn how you can help.
