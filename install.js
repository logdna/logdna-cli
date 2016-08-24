function hereDoc(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}

module.exports.deb = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most APT-based systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

Debian/Ubuntu/Linux Mint hosts:
===============================
echo "deb http://repo.logdna.com stable main" | sudo tee /etc/apt/sources.list.d/logdna.list
wget -O- http://repo.logdna.com/logdna.gpg | sudo apt-key add -
sudo apt-get update
sudo apt-get install logdna-agent < "/dev/null" # dev/null required for scripting
sudo logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
# /var/log is monitored/added by default (recursively), optionally specify more folders here
sudo logdna-agent -d /path/to/log/folders
sudo update-rc.d logdna-agent defaults
sudo /etc/init.d/logdna-agent start

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.rpm = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most YUM and Enterprise Linux systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

CentOS/Amazon Linux/Red Hat/Enterprise Linux hosts:
===================================================
echo "[logdna]
name=LogDNA packages
baseurl=http://repo.logdna.com/el6/
enabled=1
gpgcheck=0" | sudo tee /etc/yum.repos.d/logdna.repo

sudo yum -y install logdna-agent
sudo logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
# /var/log is monitored/added by default (recursively), optionally specify more folders here
sudo logdna-agent -d /path/to/log/folders
sudo chkconfig logdna-agent on
sudo service logdna-agent start

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});


module.exports.windows = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most Windows Server systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

Windows Server Hosts:
=====================
@powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))" && SET PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin
choco install logdna-agent -y
logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
:: by default the agent monitors %ALLUSERSPROFILE%\logs
logdna-agent -d C:\path\to\log\folders
nssm start logdna-agent

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.mac = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most macOS 10.8+ Server systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

macOS Server Hosts:
===================
brew update
brew cask install logdna-agent
sudo logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
# /var/log is monitored/added by default (recursively), optionally specify more folders here
sudo logdna-agent -d /path/to/log/folders
# Optional: Always run logdna-agent in the background:
sudo launchctl load -w /Library/LaunchDaemons/com.logdna.logdna-agent.plist

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.heroku = hereDoc(function()
{/*!The LogDNA add-on is available through the Heroku Elements Marketplace.

1) Sign up for an account first using 'logdna register'
2) Install the add-on here: https://elements.heroku.com/addons/logdna

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.syslog = hereDoc(function()
{/*!We now support ingesting logs from rsyslog, syslog-ng, and plain 'ol syslog. Secure TLS, custom ports, etc.

1) Sign up for an account first using 'logdna register'
2) Follow syslog instructions here: https://app.logdna.com/pages/add-host

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.api = hereDoc(function()
{/*!Send us your logs via our REST-based ingestion API.

1) Sign up for an account first using 'logdna register'
2) See our docs here: https://docs.logdna.com/docs/api

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.nodejs = hereDoc(function()
{/*!Check out our official Node.js library. Supports both direct logging and integration via Winston.

1) Sign up for an account first using 'logdna register'
2) See our GitHub repo here: https://github.com/logdna/nodejs

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});
