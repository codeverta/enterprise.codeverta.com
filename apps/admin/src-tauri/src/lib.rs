use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use uuid::Uuid;

const LOCAL_API_URL: &str = "http://127.0.0.1:7843";
const CONFIG_FILE: &str = "desktop-config.json";
const DATABASE_FILE: &str = "codeverta-offline.db";

#[derive(Default)]
struct DesktopState {
    backend: Mutex<Option<CommandChild>>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredDesktopConfig {
    mode: String,
    language: String,
    currency: String,
    workspace_name: String,
    server_url: Option<String>,
    jwt_secret: String,
    encryption_key: String,
    hmac_key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSetupInput {
    mode: String,
    language: String,
    currency: String,
    workspace_name: String,
    server_url: Option<String>,
    admin_name: Option<String>,
    admin_password: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeConfig {
    mode: String,
    language: String,
    currency: String,
    workspace_name: String,
    server_url: Option<String>,
    api_url: String,
}

impl StoredDesktopConfig {
    fn public(&self) -> DesktopRuntimeConfig {
        let api_url = if self.mode == "offline" {
            LOCAL_API_URL.to_string()
        } else {
            self.server_url.clone().unwrap_or_default()
        };
        DesktopRuntimeConfig {
            mode: self.mode.clone(),
            language: self.language.clone(),
            currency: self.currency.clone(),
            workspace_name: self.workspace_name.clone(),
            server_url: self.server_url.clone(),
            api_url,
        }
    }
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|error| format!("Unable to locate the desktop configuration directory: {error}"))
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Unable to locate the desktop data directory: {error}"))
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(CONFIG_FILE))
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(DATABASE_FILE))
}

fn read_config(app: &AppHandle) -> Result<Option<StoredDesktopConfig>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let value = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read desktop configuration: {error}"))?;
    let config = serde_json::from_str(&value)
        .map_err(|error| format!("Desktop configuration is invalid: {error}"))?;
    Ok(Some(config))
}

fn write_config(app: &AppHandle, config: &StoredDesktopConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "Desktop configuration path has no parent directory".to_string())?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Unable to create desktop configuration directory: {error}"))?;
    let value = serde_json::to_vec_pretty(config)
        .map_err(|error| format!("Unable to serialize desktop configuration: {error}"))?;
    fs::write(&path, value)
        .map_err(|error| format!("Unable to save desktop configuration: {error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Unable to secure desktop configuration: {error}"))?;
    }
    Ok(())
}

fn start_offline_backend(
    app: &AppHandle,
    state: &DesktopState,
    config: &StoredDesktopConfig,
    bootstrap_name: Option<&str>,
    bootstrap_password: Option<&str>,
) -> Result<(), String> {
    let mut backend = state
        .backend
        .lock()
        .map_err(|_| "Offline backend state is unavailable".to_string())?;
    if backend.is_some() {
        return Ok(());
    }

    let data_dir = app_data_dir(app)?;
    let upload_dir = data_dir.join("uploads");
    fs::create_dir_all(&upload_dir)
        .map_err(|error| format!("Unable to create the offline data directory: {error}"))?;

    let database = data_dir.join(DATABASE_FILE);
    let mut command = app
        .shell()
        .sidecar("codeverta-backend")
        .map_err(|error| format!("Offline backend is not bundled correctly: {error}"))?
        .env("OFFLINE_MODE", "true")
        .env("APP_ENV", "offline")
        .env("GIN_MODE", "release")
        .env("PORT", "7843")
        .env("SQL_DSN", "")
        .env("REDIS_CONN_STRING", "")
        .env("SQLITE_PATH", database.to_string_lossy().as_ref())
        .env("UPLOAD_PATH", upload_dir.to_string_lossy().as_ref())
        .env("OFFLINE_WORKSPACE_NAME", &config.workspace_name)
        .env("OFFLINE_CURRENCY", &config.currency)
        .env("JWT_SECRET", &config.jwt_secret)
        .env("SESSION_SECRET", &config.jwt_secret)
        .env("DB_ENCRYPTION_KEY", &config.encryption_key)
        .env("DB_HMAC_KEY", &config.hmac_key);

    if let Some(name) = bootstrap_name.filter(|value| !value.trim().is_empty()) {
        command = command.env("OFFLINE_ADMIN_NAME", name.trim());
    }
    if let Some(password) = bootstrap_password.filter(|value| !value.is_empty()) {
        command = command.env("OFFLINE_BOOTSTRAP_PASSWORD", password);
    }

    let (mut events, child) = command
        .spawn()
        .map_err(|error| format!("Unable to start the offline backend: {error}"))?;
    *backend = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                tauri_plugin_shell::process::CommandEvent::Stderr(bytes) => {
                    eprintln!("[offline-backend] {}", String::from_utf8_lossy(&bytes));
                }
                tauri_plugin_shell::process::CommandEvent::Error(error) => {
                    eprintln!("[offline-backend] {error}");
                }
                tauri_plugin_shell::process::CommandEvent::Terminated(_) => {
                    if let Ok(mut backend) = app_handle.state::<DesktopState>().backend.lock() {
                        backend.take();
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn desktop_get_config(app: AppHandle) -> Result<Option<DesktopRuntimeConfig>, String> {
    let Some(config) = read_config(&app)? else {
        return Ok(None);
    };
    if config.mode == "offline" && !database_path(&app)?.exists() {
        return Ok(None);
    }
    Ok(Some(config.public()))
}

#[tauri::command]
fn desktop_configure(
    app: AppHandle,
    state: State<DesktopState>,
    input: DesktopSetupInput,
) -> Result<DesktopRuntimeConfig, String> {
    let mode = input.mode.trim().to_lowercase();
    if mode != "offline" && mode != "server" {
        return Err("Choose either offline or server mode".to_string());
    }
    let server_url = input
        .server_url
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty());
    if mode == "server"
        && !server_url
            .as_deref()
            .is_some_and(|url| url.starts_with("https://") || url.starts_with("http://"))
    {
        return Err("Enter a valid server URL beginning with http:// or https://".to_string());
    }
    if mode == "offline" && input.admin_password.as_deref().unwrap_or_default().len() < 8 {
        return Err("The offline administrator password must contain at least 8 characters".to_string());
    }

    let config = StoredDesktopConfig {
        mode: mode.clone(),
        language: if input.language == "en" { "en" } else { "id" }.to_string(),
        currency: input.currency.trim().to_uppercase(),
        workspace_name: input.workspace_name.trim().to_string(),
        server_url,
        jwt_secret: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        encryption_key: Uuid::new_v4().simple().to_string(),
        hmac_key: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
    };
    write_config(&app, &config)?;

    if mode == "offline" {
        start_offline_backend(
            &app,
            &state,
            &config,
            input.admin_name.as_deref(),
            input.admin_password.as_deref(),
        )?;
    }

    Ok(config.public())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![desktop_get_config, desktop_configure])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(config) = read_config(&handle)? {
                if config.mode == "offline" && database_path(&handle)?.exists() {
                    let state = app.state::<DesktopState>();
                    start_offline_backend(&handle, &state, &config, None, None)?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Ok(mut backend) = window.state::<DesktopState>().backend.lock() {
                    if let Some(child) = backend.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Codeverta Enterprise System");
}
