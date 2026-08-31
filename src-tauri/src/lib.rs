use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Credentials {
    pub server_url: String,
    pub password: Option<String>,
}

#[tauri::command]
fn save_credentials(server_url: String, password: Option<String>) -> Result<(), String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server")
        .map_err(|e| e.to_string())?;
    let creds = Credentials {
        server_url,
        password,
    };
    let json = serde_json::to_string(&creds).map_err(|e| e.to_string())?;
    entry.set_password(&json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_credentials() -> Result<Option<Credentials>, String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server")
        .map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(json) => {
            let creds: Credentials = serde_json::from_str(&json)
                .map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn clear_credentials() -> Result<(), String> {
    let entry = keyring::Entry::new("ganesha", "opencode-server")
        .map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            save_credentials,
            load_credentials,
            clear_credentials,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ganesha");
}
