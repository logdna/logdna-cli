function hereDoc(f) {
    return f.toString(); /*
        .replace(/^[^\/]+\/\*!?/, '')
        .replace(/\*\/[^\/]+$/, '');
*/ }

module.exports.deb = hereDoc(function() { /* !
Run these commands on your Linux Ubuntu/Debian-based hosts, it'll install our self-updating collector agent:

echo "deb http://repo.logdna.com stable main" | sudo tee /etc/apt/sources.list.d/logdna.list
wget -O- https://s3.amazonaws.com/repo.logdna.com/logdna.gpg | sudo apt-key add -
sudo apt-get update
sudo apt-get install logdna-agent < "/dev/null" # this line needed for copy/paste
sudo logdna-agent -k ZZZZZZZZ # this is your unique Ingestion Key
# /var/log is monitored/added by default (recursively), optionally add more dirs here
sudo logdna-agent -d /path/to/log/folders
sudo update-rc.d logdna-agent defaults
sudo /etc/init.d/logdna-agent start

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.rpm = hereDoc(function() { /* !
Run these commands on your Linux RPM-based hosts, it'll install our self-updating collector agent:

echo "[logdna]
name=LogDNA packages
baseurl=http://repo.logdna.com/el6/
enabled=1
gpgcheck=0" | sudo tee /etc/yum.repos.d/logdna.repo
sudo yum -y install logdna-agent
sudo logdna-agent -k ZZZZZZZZ # this is your unique Ingestion Key
# /var/log is monitored/added by default (recursively), optionally add more dirs here
sudo logdna-agent -d /path/to/log/folders
sudo chkconfig logdna-agent on
sudo service logdna-agent start

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });


module.exports.windows = hereDoc(function() { /* !
Run these commands on your Windows hosts using Command Prompt (cmd.exe), it'll install our self-updating collector agent:

@powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))" && SET PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin
choco install logdna-agent -y
logdna-agent -k ZZZZZZZZ # this is your unique Ingestion Key
:: %ALLUSERSPROFILE%\logs is monitored/added by default (recursively), optionally add more dirs here
logdna-agent -d C:\path\to\log\folders
nssm start logdna-agent

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.mac = hereDoc(function() { /* !
These commands require Homebrew package manager (http://brew.sh/).
Run these commands on your macOS Server hosts, it'll install our self-updating collector agent:

brew update
brew cask install logdna-agent
sudo logdna-agent -k ZZZZZZZZ # this is your unique Ingestion Key
# /var/log is monitored/added by default (recursively), optionally add more dirs here
sudo logdna-agent -d /path/to/log/folders
# Optional: Have logdna-agent always run in the background
sudo launchctl load -w /Library/LaunchDaemons/com.logdna.logdna-agent.plist

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.heroku = hereDoc(function() { /* !
The LogDNA add-on is available through the Heroku Elements Marketplace.

1) Sign up for an account first using 'logdna register'
2) Install the add-on here: https://elements.heroku.com/addons/logdna

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports['heroku-drains'] = hereDoc(function() { /* !
Use 'logdna heroku <heroku-app-name>' to generate a Heroku Drain URL.
*/ });

module.exports.syslog = hereDoc(function() { /* !
We support ingesting logs from rsyslog, syslog-ng, and plain 'ol syslog. Secure TLS, custom ports, etc.

1) Sign up for an account first using 'logdna register'
2) Follow syslog instructions here: https://app.logdna.com/pages/add-host

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.api = hereDoc(function() { /* !
Send us your logs via our REST-based ingestion API.

1) Sign up for an account first using 'logdna register'
2) See our docs here: https://docs.logdna.com/docs/api

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.nodejs = hereDoc(function() { /* !
Check out our official Node.js library. Supports both direct logging and integration via Winston.

1) Sign up for an account first using 'logdna register'
2) See our GitHub repo here: https://github.com/logdna/nodejs

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.k8s = hereDoc(function() { /* !
Ship logs from your Kubernetes v1.2+ cluster:

1) Sign up for an account first using 'logdna register'
2) Run: kubectl create secret generic logdna-agent-key --from-literal=logdna-agent-key=ZZZZZZZZ
3) Run: kubectl create -f https://raw.githubusercontent.com/logdna/logdna-agent/master/logdna-agent-ds.yaml

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });

module.exports.docker = hereDoc(function() { /* !
Ship logs from Docker containers:

1) Sign up for an account first using 'logdna register'
2) Follow Docker instructions here: https://app.logdna.com/pages/add-host

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info
*/ });
