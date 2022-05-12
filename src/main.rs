use clap::{AppSettings, Args, Parser, Subcommand};
use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};
use serde_json::json;
use std::fs::OpenOptions;
use std::io::Write;
use url::Url;

use std::time::{Duration, SystemTime};

use directories::ProjectDirs;

#[derive(Debug, Parser)]
#[clap(name = "logdna-cli")]
struct Cli {
    #[clap(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
#[clap(name = "logdna-cli")]
enum Commands {
    /// Log in to a LogDNA with email
    #[clap(name = "login")]
    Login(Login),
    /// Log in to a LogDNA via single sign-on
    #[clap(name = "ssologin")]
    SSOLogin(SSOLogin),
    /// Basic search with optional filtering. Run logdna search --help for options.
    #[clap(name = "search", arg_required_else_help = true)]
    Search(Search),
}

#[derive(Debug, Args)]
#[clap(args_conflicts_with_subcommands = true)]
#[clap(name = "logdna-cli login")]
struct Login {
    email: String,
}

#[derive(Debug, Args)]
#[clap(args_conflicts_with_subcommands = true, setting = AppSettings::DeriveDisplayOrder)]
#[clap(name = "logdna-cli search")]
struct Search {
    /// Filter on hosts (separate by comma)
    #[clap(long, next_display_order = 5000)]
    hosts: Option<String>,
    /// Filter on apps (separate by comma)
    #[clap(long, next_display_order = 5001)]
    apps: Option<String>,
    /// Filter on levels (separate by comma)
    #[clap(long, next_display_order = 5002)]
    levels: Option<String>,
    /// Filter on tagss (separate by comma)
    #[clap(long, next_display_order = 5003)]
    tags: Option<String>,
    /// Set how many lines to request
    #[clap(short, long, alias = "number", next_display_order = 5004)]
    size: Option<u64>,
    /// Unix/Natural Language timestamp of beginning of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.
    #[clap(long, parse(try_from_str = parse_time), next_display_order = 10000)]
    from: Option<SystemTime>,
    /// Unix/Natural Language timestamp of end of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.
    #[clap(long, parse(try_from_str = parse_time), next_display_order = 10001)]
    to: Option<SystemTime>,

    /// Output raw JSON
    #[clap(short, long, parse(from_flag), next_display_order = 20001)]
    json: bool,
    query: String,
}

fn parse_time(s: &str) -> Result<SystemTime, &'static str> {
    if let Ok(res) = humantime::parse_rfc3339_weak(s) {
        return Ok(res);
    };
    if let Ok(d) = humantime::parse_duration(s) {
        return Ok(SystemTime::now() - d);
    }
    // Assume it's a unix Timestamp
    if let Ok(d) = s.parse::<u64>() {
        return Ok(SystemTime::UNIX_EPOCH + Duration::from_secs(d));
    }
    Err("Could not parse timestamp")
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct ExportRespBody {
    pagination_id: Option<String>,
    lines: Vec<serde_json::Value>,
}

/*
.option('-h, --hosts <hosts>', 'Filter on hosts (separate by comma)')$
.option('-a, --apps <apps>', 'Filter on apps (separate by comma)')$
.option('-l, --levels <levels>', 'Filter on levels (separate by comma)')$
.option('-n, --number <number>', 'Set how many lines to request')$
.option('-t, --tags <tags>', 'Filter on tags (separate by comma)')$
.option('--prefer-head', 'Get lines from the beginning of the interval rather than the end')$
.option('--next', 'Get next chunk of lines (after last search). This is a convenience wrapper around the --from and --to parameters.')$
.option('--timeframe <timeframe>', 'Natural Language Timeframe via Chrono. Wrap in quotes. IE "today 5PM to 7PM" or "yesterday at 3PM to now" or "May 26 at 4PM UTC". If only one time is given, "from">
.option('--from <from>', 'Unix/Natural Language timestamp of beginning of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.')$
.option('--to <to>', 'Unix/Natural Language timestamp of end of search timeframe. Wrap in quotes if NL. Ignored if --timeframe used.')$
.option('-j, --json', 'Output raw JSON', false)$
.option(devOption.param, devOption.message)$
*/
#[derive(Debug, Args)]
#[clap(args_conflicts_with_subcommands = true)]
#[clap(name = "logdna-cli ssologin")]
struct SSOLogin {}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct LoginRespBody {
    status: String,
    email: Option<String>,
    accounts: Option<Vec<String>>,
    token: Option<String>,
    keys: Option<Vec<Vec<String>>>,
    servicekeys: Option<Vec<String>>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct SSOLoginRespBody {
    status: String,
    email: Option<String>,
    accounts: Option<Vec<String>>,
    token: Option<String>,
    keys: Option<Vec<Vec<String>>>,
    servicekeys: Option<Vec<String>>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
struct PersistentConfig {
    email: Option<String>,
    accounts: Option<Vec<String>>,
    account: Option<String>,
    keys: Option<Vec<Vec<String>>>,
    servicekeys: Option<Vec<String>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rng = StdRng::from_entropy();

    let client = reqwest::Client::new();

    let logdna_url = Url::parse("https://logdna.com/")?;
    let logdna_api_base_url = Url::parse("https://api.logdna.com/")?;
    let logdna_sso_url = logdna_api_base_url.join("sso")?;

    let logdna_login_url = logdna_api_base_url.join("login")?;
    let logdna_api_v2_url = logdna_api_base_url.join("v2/")?;
    let logdna_api_export_url = logdna_api_v2_url.join("export")?;

    let conf_file_path: std::path::PathBuf = ProjectDirs::from("com", "logdna", "logdna-cli")
        .map(|proj_dirs| proj_dirs.config_dir().join("logdna.conf"))
        .ok_or("Could not open conf dir")?;

    let args = Cli::parse();
    match args.command {
        Commands::Login(options) => {
            let password = rpassword::prompt_password("Your password: ")?;

            let req = client
                .post(logdna_login_url.clone())
                .basic_auth(options.email, Some(password));
            let res = req.send().await?;
            if res.status() != 200 {
                Err("Authentication failed")?
            }
            let resp_body: LoginRespBody = res.json().await?;
            if resp_body.email.is_some() {
                let conf = PersistentConfig {
                    email: resp_body.email,
                    servicekeys: resp_body.servicekeys,
                    accounts: resp_body.accounts,
                    account: None,
                    keys: resp_body.keys,
                };
                println!("Writing config to {}", conf_file_path.to_string_lossy());
                std::fs::create_dir_all(&conf_file_path.parent().unwrap())?;
                let mut conf_file = OpenOptions::new()
                    .create(true)
                    .write(true)
                    .open(conf_file_path)?;
                serde_json::to_writer_pretty(&mut conf_file, &conf)?;
                conf_file.write_all(b"\n")?;
            }
        }
        Commands::SSOLogin(_) => {
            let bytes: [u8; 10] = rng.gen();

            let token = base32::encode(base32::Alphabet::Crockford, &bytes).to_lowercase();
            let user_url = logdna_url.join("sso/")?.join(&token)?;
            println!(
                "Attempting to automatically open the SSO authorization page in your default browser.\nIf the browser does not open or you wish to use a different device to authorize this request, open the following URL:\n    {}",
                user_url
            );
            open::that(user_url.as_str())?;

            let resp_body = loop {
                let body = json!({
                    "token": token,
                });
                let req = client.post(logdna_sso_url.clone()).json(&body);
                let res = req.send().await?;
                let json: Result<SSOLoginRespBody, _> = res.json().await;
                match json {
                    Ok(body) => {
                        if body.email.is_some() {
                            break body;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                    }
                    Err(e) => {
                        println!("Error: {:#?}", e);
                        tokio::time::sleep(tokio::time::Duration::from_millis(5000)).await;
                    }
                }
            };
            let conf = PersistentConfig {
                email: resp_body.email,
                servicekeys: resp_body.servicekeys,
                accounts: resp_body.accounts,
                account: None,
                keys: resp_body.keys,
            };
            println!("Writing config to {}", conf_file_path.to_string_lossy());
            std::fs::create_dir_all(&conf_file_path.parent().unwrap())?;
            let mut conf_file = OpenOptions::new()
                .create(true)
                .write(true)
                .open(conf_file_path)?;
            serde_json::to_writer_pretty(&mut conf_file, &conf)?;
            conf_file.write_all(b"\n")?;
        }
        Commands::Search(options) => {
            let mut conf_file = OpenOptions::new().read(true).open(conf_file_path)?;

            let conf: PersistentConfig = serde_json::from_reader(&mut conf_file)?;

            let mut req_builder = client
                .get(logdna_api_export_url.clone())
                .header("Accept", "application/json")
                .header(
                    "servicekey",
                    &conf
                        .servicekeys
                        .ok_or("No servicekey found please run logdna-cli ssologin")?[0],
                );

            fn systemtime_to_epoch_s(t: SystemTime) -> Result<u64, std::time::SystemTimeError> {
                Ok(t.duration_since(SystemTime::UNIX_EPOCH)?.as_secs())
            }

            req_builder = req_builder.query(&[
                (
                    "from",
                    &format!(
                        "{}",
                        options.from.map(systemtime_to_epoch_s).unwrap_or(Ok(0))?
                    ),
                ),
                (
                    "to",
                    &format!(
                        "{}",
                        options
                            .to
                            .map(systemtime_to_epoch_s)
                            .unwrap_or(Ok(SystemTime::now()
                                .duration_since(SystemTime::UNIX_EPOCH)?
                                .as_secs()))?
                    ),
                ),
            ]);

            if let Some(hosts) = options.hosts {
                req_builder = req_builder.query(&[("hosts", &format!("{}", hosts))])
            };

            if let Some(apps) = options.apps {
                req_builder = req_builder.query(&[("apps", &format!("{}", apps))])
            };

            if let Some(levels) = options.levels {
                req_builder = req_builder.query(&[("levels", &format!("{}", levels))])
            };

            if let Some(tags) = options.tags {
                req_builder = req_builder.query(&[("tags", &format!("{}", tags))])
            };

            if let Some(size) = options.size {
                req_builder = req_builder.query(&[("size", &format!("{}", size))])
            };

            req_builder = req_builder.query(&[("query", &options.query)]);

            /*
             * prefer
             * string
             *
             * Defines the log lines that you want to export. Valid values are head, first log
             * lines, and tail, last log lines. If not specified, defaults to tail.
             *
             * pagination_id
             * string
             *
             * ID that indicates which page of results to be retrieved. Leave empty for the initial export request.
             */

            let mut pagination_id = None;
            loop {
                let mut req = req_builder
                    .try_clone()
                    .ok_or("Failed to clone request builder")?;
                if let Some(pagination_id) = pagination_id {
                    req = req.query(&[("pagination_id", pagination_id)]);
                }
                let res = req.send().await?;
                let body: ExportRespBody = res.json().await?;

                for line in body.lines {
                    if options.json {
                        println!("{}", line.to_string());
                    } else {
                        println!(
                            "{}",
                            line.get("_line")
                                .ok_or("Received line without a value")?
                                .to_string()
                        );
                    }
                }
                pagination_id = body.pagination_id;
                if pagination_id.is_none() {
                    break;
                }
            }
        }
    }

    Ok(())
}
