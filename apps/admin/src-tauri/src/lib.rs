use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::{process::CommandChild, ShellExt};
use uuid::Uuid;

const LOCAL_API_URL: &str = "http://127.0.0.1:7843";
const CONFIG_FILE: &str = "desktop-config.json";
const DATABASE_FILE: &str = "codeverta-offline.db";
const RECOVERY_BACKUP_DIRECTORY: &str = "recovery-backups";
const UPDATE_PENDING_FILE: &str = "desktop-update-pending";
const MIGRATION_PENDING_FILE: &str = "desktop-migration-pending.json";
const LAST_RECOVERY_FILE: &str = "desktop-last-recovery.json";

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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRecoveryBackup {
    name: String,
    size: u64,
    created_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRecoveryStatus {
    backups: Vec<DesktopRecoveryBackup>,
    migration_interrupted: bool,
    last_recovery: Option<serde_json::Value>,
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
        .env(
            "DESKTOP_APP_VERSION",
            app.package_info().version.to_string(),
        )
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
        return Err(
            "The offline administrator password must contain at least 8 characters".to_string(),
        );
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

#[tauri::command]
fn desktop_prepare_update(app: AppHandle) -> Result<(), String> {
    let Some(config) = read_config(&app)? else {
        return Ok(());
    };
    if config.mode != "offline" || !database_path(&app)?.exists() {
        return Ok(());
    }
    let marker = app_data_dir(&app)?.join(UPDATE_PENDING_FILE);
    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&marker)
        .map_err(|error| format!("Unable to prepare the local database for update: {error}"))?;
    use std::io::Write;
    file.write_all(app.package_info().version.to_string().as_bytes())
        .map_err(|error| format!("Unable to write the desktop update marker: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Unable to persist the desktop update marker: {error}"))?;
    secure_file(&marker)
}

#[tauri::command]
fn desktop_recovery_status(app: AppHandle) -> Result<DesktopRecoveryStatus, String> {
    let data_dir = app_data_dir(&app)?;
    let backup_dir = data_dir.join(RECOVERY_BACKUP_DIRECTORY);
    let mut backups = Vec::new();
    if backup_dir.exists() {
        for entry in fs::read_dir(&backup_dir)
            .map_err(|error| format!("Unable to read recovery backups: {error}"))?
        {
            let entry =
                entry.map_err(|error| format!("Unable to read a recovery backup: {error}"))?;
            let path = entry.path();
            if !path.is_file()
                || path.extension().and_then(|value| value.to_str()) != Some("db")
                || !PathBuf::from(format!("{}.sha256", path.to_string_lossy())).exists()
            {
                continue;
            }
            let metadata = entry
                .metadata()
                .map_err(|error| format!("Unable to inspect a recovery backup: {error}"))?;
            let created_at = metadata
                .modified()
                .unwrap_or(UNIX_EPOCH)
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            backups.push(DesktopRecoveryBackup {
                name: entry.file_name().to_string_lossy().to_string(),
                size: metadata.len(),
                created_at,
            });
        }
    }
    backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    let last_recovery = fs::read_to_string(data_dir.join(LAST_RECOVERY_FILE))
        .ok()
        .and_then(|value| serde_json::from_str(&value).ok());
    Ok(DesktopRecoveryStatus {
        backups,
        migration_interrupted: data_dir.join(MIGRATION_PENDING_FILE).exists(),
        last_recovery,
    })
}

#[tauri::command]
fn desktop_restore_recovery_backup(
    app: AppHandle,
    state: State<DesktopState>,
    name: String,
) -> Result<(), String> {
    validate_backup_name(&name)?;
    let config =
        read_config(&app)?.ok_or_else(|| "Desktop configuration is not available".to_string())?;
    if config.mode != "offline" {
        return Err("Recovery backup is only available in offline mode".to_string());
    }
    let data_dir = app_data_dir(&app)?;
    let backup_dir = data_dir.join(RECOVERY_BACKUP_DIRECTORY);
    let source = backup_dir.join(&name);
    validate_sqlite_header(&source)?;
    verify_recovery_checksum(&source)?;

    if let Ok(mut backend) = state.backend.lock() {
        if let Some(child) = backend.take() {
            let _ = child.kill();
        }
    }
    thread::sleep(Duration::from_millis(500));

    let target = database_path(&app)?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let safety = backup_dir.join(format!("manual-before-restore-{stamp}.db"));
    if target.exists() {
        fs::copy(&target, &safety)
            .map_err(|error| format!("Unable to create a safety backup before restore: {error}"))?;
        secure_file(&safety)?;
        write_recovery_checksum(&safety)?;
    }
    let temporary = target.with_extension("restore-tmp");
    let _ = fs::remove_file(&temporary);
    fs::copy(&source, &temporary)
        .map_err(|error| format!("Unable to stage the recovery database: {error}"))?;
    secure_file(&temporary)?;
    replace_file(&temporary, &target)?;
    let _ = fs::remove_file(target.to_string_lossy().to_string() + "-wal");
    let _ = fs::remove_file(target.to_string_lossy().to_string() + "-shm");
    let _ = fs::remove_file(data_dir.join(MIGRATION_PENDING_FILE));
    let _ = fs::remove_file(data_dir.join(UPDATE_PENDING_FILE));

    let recovery_event = serde_json::json!({
        "reason": "manual recovery from desktop recovery center",
        "backupPath": source.file_name().and_then(|value| value.to_str()),
        "recoveredAt": stamp,
    });
    fs::write(
        data_dir.join(LAST_RECOVERY_FILE),
        serde_json::to_vec_pretty(&recovery_event).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Unable to record desktop recovery: {error}"))?;

    start_offline_backend(&app, &state, &config, None, None)
}

fn validate_backup_name(name: &str) -> Result<(), String> {
    let path = Path::new(name);
    if name.trim().is_empty()
        || path.file_name().and_then(|value| value.to_str()) != Some(name)
        || path.extension().and_then(|value| value.to_str()) != Some("db")
    {
        return Err("Invalid recovery backup name".to_string());
    }
    Ok(())
}

fn validate_sqlite_header(path: &Path) -> Result<(), String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Unable to open the selected recovery backup: {error}"))?;
    let mut header = [0_u8; 16];
    file.read_exact(&mut header)
        .map_err(|error| format!("Recovery backup is incomplete: {error}"))?;
    if &header != b"SQLite format 3\0" {
        return Err("The selected recovery backup is not a SQLite database".to_string());
    }
    Ok(())
}

fn verify_recovery_checksum(path: &Path) -> Result<(), String> {
    let expected = fs::read_to_string(format!("{}.sha256", path.to_string_lossy()))
        .map_err(|error| format!("Recovery backup checksum is missing: {error}"))?;
    let actual = recovery_checksum(path)?;
    if expected.trim() != actual {
        return Err("Recovery backup failed checksum verification".to_string());
    }
    Ok(())
}

fn write_recovery_checksum(path: &Path) -> Result<(), String> {
    let checksum = recovery_checksum(path)?;
    let checksum_path = PathBuf::from(format!("{}.sha256", path.to_string_lossy()));
    fs::write(&checksum_path, format!("{checksum}\n"))
        .map_err(|error| format!("Unable to save recovery backup checksum: {error}"))?;
    secure_file(&checksum_path)
}

fn recovery_checksum(path: &Path) -> Result<String, String> {
    let mut file =
        fs::File::open(path).map_err(|error| format!("Unable to read recovery backup: {error}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Unable to verify recovery backup: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    if fs::rename(source, target).is_ok() {
        return Ok(());
    }
    let old = target.with_extension("recovery-old");
    let _ = fs::remove_file(&old);
    if target.exists() {
        fs::rename(target, &old)
            .map_err(|error| format!("Unable to preserve the active database: {error}"))?;
    }
    if let Err(error) = fs::rename(source, target) {
        let _ = fs::rename(&old, target);
        return Err(format!("Unable to activate the recovery database: {error}"));
    }
    let _ = fs::remove_file(old);
    Ok(())
}

fn secure_file(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Unable to secure recovery data: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod recovery_tests {
    use super::*;

    #[test]
    fn recovery_backup_name_rejects_path_traversal() {
        assert!(validate_backup_name("schema-v1-to-v2.db").is_ok());
        assert!(validate_backup_name("../codeverta-offline.db").is_err());
        assert!(validate_backup_name("nested/backup.db").is_err());
        assert!(validate_backup_name("backup.txt").is_err());
    }

    #[test]
    fn recovery_checksum_detects_tampering() {
        let directory = std::env::temp_dir().join(format!("codeverta-recovery-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).expect("create test directory");
        let backup = directory.join("snapshot.db");
        fs::write(&backup, b"SQLite format 3\0test payload").expect("write backup");
        write_recovery_checksum(&backup).expect("write checksum");
        verify_recovery_checksum(&backup).expect("verify checksum");
        fs::write(&backup, b"SQLite format 3\0tampered payload").expect("tamper backup");
        assert!(verify_recovery_checksum(&backup).is_err());
        let _ = fs::remove_dir_all(directory);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![
            desktop_get_config,
            desktop_configure,
            desktop_prepare_update,
            desktop_recovery_status,
            desktop_restore_recovery_backup
        ])
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
