function hereDoc(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}

module.exports.deb = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most YUM or APT-based Linux systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

Debian/Ubuntu/APT hosts:
========================
wget -O- http://repo.logdna.com/logdna.gpg | sudo apt-key add -
echo "deb http://repo.logdna.com stable main" | sudo tee /etc/apt/sources.list.d/logdna.list
sudo apt-get update
sudo apt-get install logdna-agent < "/dev/null" # dev/null required for scripting
sudo logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
# /var/log is monitored/added by default (recursively), optionally specify more folders here
sudo logdna-agent -d /path/to/log/folders
sudo update-rc.d logdna-agent defaults
sudo /etc/init.d/logdna-agent start

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});

module.exports.rpm = hereDoc(function()
{/*!Below are instructions on getting our log collector/shipper agent installed on to your staging and production hosts.  It should work on most YUM or APT-based Linux systems.  Please let us know if you encounter errors on any specific hosts.  The agent will auto-reconnect on disconnect and is self-updating so it's ideal on auto-scaling instances.

CentOS/Amazon Linux/SUSE/Enterprise Linux hosts:
================================================
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
================================================
@powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))" && SET PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin
choco install logdna-agent -y
logdna-agent -k ZZZZZZZZ # this is your unique Agent API Key
:: by default the agent monitors %ALLUSERSPROFILE%\logs
logdna-agent -d C:\path\to\log\folders
nssm start logdna-agent

Once shipping begins, you can tail using 'logdna tail' or 'logdna tail --help' for more info*/});
