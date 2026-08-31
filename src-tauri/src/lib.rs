use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::process::{Child, Command};
use std::time::Duration;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct Credentials {
    pub server_url: String,
    pub password: Option<String>,
}

struct ServerState(pub Mutex<Option<Child>>);

#[tauri::command]
fn save_credentials(server_url: String, password: Option<String>) -> Result<(), String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server").map_err(|e| e.to_string())?;
    let creds = Credentials { server_url, password };
    let json = serde_json::to_string(&creds).map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_credentials() -> Result<Option<Credentials>, String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let creds: Credentials = serde_json::from_str(&json).map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn clear_credentials() -> Result<(), String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server").map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(())
}

fn is_server_healthy_sync(port: u16) -> bool {
    std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

async fn wait_for_health(port: u16, timeout_ms: u64) -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
        .unwrap();
    let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
    while tokio::time::Instant::now() < deadline {
        if let Ok(resp) = client.get(format!("http://127.0.0.1:{}/global/health", port)).send().await {
            if resp.status().is_success() {
                return true;
            }
        }
        tokio::time::sleep(Duration::from_millis(400)).await;
    }
    false
}

fn find_opencode_bin() -> Option<String> {
    // Try sidecar first: src-tauri/binaries/opencode-<triple>
    // Then try PATH: opencode, opencode.cmd, npx
    let candidates: Vec<String> = {
        let mut v = Vec::new();
        // sidecar paths (Tauri will place sidecars next to exe with -<arch> suffix)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let triples = ["x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc", "x86_64-unknown-linux-gnu", "aarch64-apple-darwin", "x86_64-apple-darwin"];
                for t in triples {
                    v.push(dir.join(format!("opencode-{}", t)).to_string_lossy().to_string());
                    v.push(dir.join(format!("opencode-{}-{}", t, std::env::consts::EXE_SUFFIX.trim_start_matches('.'))).to_string_lossy().to_string());
                }
                v.push(dir.join(format!("opencode{}", std::env::consts::EXE_SUFFIX)).to_string_lossy().to_string());
            }
        }
        v.push("opencode".to_string());
        if cfg!(windows) {
            v.push("opencode.cmd".to_string());
            v.push(format!(r"{}\npm\opencode.cmd", std::env::var("APPDATA").unwrap_or_default()));
            v.push(format!(r"{}\npm\opencode", std::env::var("APPDATA").unwrap_or_default()));
        }
        v
    };

    for c in candidates {
        if c.contains('/') || c.contains('\\') {
            if std::path::Path::new(&c).exists() {
                return Some(c);
            }
        } else {
            // Check PATH via `which` equivalent: try to spawn --version
            let probe = if cfg!(windows) {
                Command::new("cmd").args(["/c", &format!("{} --version", c)]).output()
            } else {
                Command::new(&c).arg("--version").output()
            };
            if let Ok(o) = probe {
                if o.status.success() {
                    return Some(c);
                }
            }
        }
    }
    None
}

#[tauri::command]
async fn ensure_opencode_server(
    state: tauri::State<'_, ServerState>,
    port: Option<u16>,
) -> Result<String, String> {
    let port = port.unwrap_or(4096);

    // Fast path: already healthy
    if is_server_healthy_sync(port) {
        if wait_for_health(port, 2000).await {
            return Ok(format!("already running on {}", port));
        }
    }

    // Check if we already spawned one and it's still alive (don't hold lock across await)
    let already_running = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) => {
                    *guard = None;
                    false
                }
                Err(_) => {
                    *guard = None;
                    false
                }
            }
        } else {
            false
        }
    };
    if already_running {
        if wait_for_health(port, 8000).await {
            return Ok(format!("spawned process healthy on {}", port));
        } else {
            return Err("spawned process not healthy in time".into());
        }
    }

    let bin = find_opencode_bin().ok_or_else(|| {
        "opencode binary not found. Install with: npm install -g opencode-ai  or  curl -fsSL https://opencode.ai/install | bash".to_string()
    })?;

    // Build command
    let mut cmd: Command;
    if bin.ends_with("opencode.cmd") || bin == "opencode.cmd" {
        cmd = Command::new("cmd");
        cmd.args(["/c", &bin, "serve", "--port", &port.to_string(), "--cors", "http://localhost:1420", "--cors", "http://localhost:1430"]);
    } else if bin == "opencode" && cfg!(windows) {
        // Try via npx as fallback
        cmd = Command::new("cmd");
        cmd.args(["/c", "npx", "opencode", "serve", "--port", &port.to_string(), "--cors", "http://localhost:1420"]);
    } else {
        cmd = Command::new(&bin);
        cmd.args(["serve", "--port", &port.to_string(), "--cors", "http://localhost:1420", "--cors", "http://localhost:1430"]);
    }

    // Ensure OPENCODE_SERVER_PASSWORD is not set (or keep if user wants auth — for now ensure unauthenticated for local)
    cmd.env_remove("OPENCODE_SERVER_PASSWORD");
    // Inherit other env, set working dir to current dir of tauri? Use manager's resource resolver not needed

    // Spawn detached
    cmd.stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let child = cmd.spawn().map_err(|e| format!("failed to spawn '{}': {}", bin, e))?;

    {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        *guard = Some(child);
    }

    if wait_for_health(port, 12000).await {
        Ok(format!("started {} on {}", bin, port))
    } else {
        // Cleanup failed spawn
        if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
            }
        }
        Err(format!("opencode server failed to become healthy on port {} (bin: {})", port, bin))
    }
}

#[tauri::command]
fn get_opencode_status(port: Option<u16>) -> bool {
    is_server_healthy_sync(port.unwrap_or(4096))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ServerState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            save_credentials,
            load_credentials,
            clear_credentials,
            ensure_opencode_server,
            get_opencode_status,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Auto-start on launch (best-effort, don't block UI)
                tokio::time::sleep(Duration::from_millis(800)).await;
                let state: tauri::State<ServerState> = handle.state();
                let _ = ensure_opencode_server(state, Some(4096)).await;
            });
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Cleanup is handled via Drop of Child, but ensure kill
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app.try_state::<ServerState>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
