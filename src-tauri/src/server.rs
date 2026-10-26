use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LanInfo {
    #[serde(rename = "localUrl")]
    pub local_url: String,
    pub ips: Vec<String>,
    pub port: u16,
}

pub struct LanServer {
    port: AtomicU16,
    ips: Mutex<Vec<String>>,
    state: Arc<Mutex<serde_json::Value>>,
    sse_clients: Arc<Mutex<Vec<TcpStream>>>,
    dist_dir: Mutex<PathBuf>,
}

impl LanServer {
    pub fn new() -> Arc<Self> {
        // Detect dist dir location
        let mut dist_path = PathBuf::from("dist");
        if !dist_path.exists() {
            let parent_dist = PathBuf::from("../dist");
            if parent_dist.exists() {
                dist_path = parent_dist;
            } else if let Ok(exe) = std::env::current_exe() {
                if let Some(parent) = exe.parent() {
                    let exe_dist = parent.join("dist");
                    if exe_dist.exists() {
                        dist_path = exe_dist;
                    }
                }
            }
        }

        let initial_state = serde_json::json!({
            "type": "FULL_SYNC",
            "rawLrc": "",
            "offsetMs": 350,
            "position": 0.0,
            "transport": "stopped",
            "duration": 0.0,
            "projectName": "OpenMT",
            "options": {
                "theme": "transparent",
                "mode": "lowerthird",
                "fontSize": "large",
                "uppercase": false,
                "showNext": true
            },
            "timestamp": 0
        });

        let server = Arc::new(Self {
            port: AtomicU16::new(3000),
            ips: Mutex::new(Vec::new()),
            state: Arc::new(Mutex::new(initial_state)),
            sse_clients: Arc::new(Mutex::new(Vec::new())),
            dist_dir: Mutex::new(dist_path),
        });

        let srv_clone = Arc::clone(&server);
        thread::spawn(move || {
            srv_clone.refresh_ips();
            srv_clone.start_listener();
        });

        server
    }

    pub fn refresh_ips(&self) {
        let mut detected_ips: Vec<String> = Vec::new();

        // 1. Probar ruta UDP activa (detecta IP principal conectada a router/gateway)
        if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
            if socket.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = socket.local_addr() {
                    let ip = addr.ip().to_string();
                    if !ip.starts_with("127.") && !detected_ips.contains(&ip) {
                        detected_ips.push(ip);
                    }
                }
            }
        }

        // 2. En Windows, consultar interfaces de red (Wi-Fi, Ethernet Cable, Hotspot)
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            use std::process::Command;

            let ps_script = "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress";
            if let Ok(output) = Command::new("powershell")
                .args(["-NoProfile", "-Command", ps_script])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let ip = line.trim().to_string();
                    if !ip.is_empty() && !detected_ips.contains(&ip) {
                        detected_ips.push(ip);
                    }
                }
            }
        }

        if detected_ips.is_empty() {
            detected_ips.push("127.0.0.1".to_string());
        }

        *self.ips.lock() = detected_ips;
    }

    pub fn get_info(&self) -> LanInfo {
        self.refresh_ips();
        let ips = self.ips.lock().clone();
        let port = self.port.load(Ordering::SeqCst);
        let primary_ip = ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string());
        LanInfo {
            local_url: format!("http://{}:{}", primary_ip, port),
            ips,
            port,
        }
    }

    pub fn update_state(&self, new_state: serde_json::Value) {
        let payload_str = {
            let mut state_guard = self.state.lock();
            if let serde_json::Value::Object(new_map) = new_state {
                if let serde_json::Value::Object(ref mut cur_map) = *state_guard {
                    for (k, v) in new_map {
                        cur_map.insert(k, v);
                    }
                }
            }
            serde_json::to_string(&*state_guard).unwrap_or_default()
        };

        if !payload_str.is_empty() {
            self.broadcast_sse(&payload_str);
        }
    }

    fn broadcast_sse(&self, json_data: &str) {
        let message = format!("data: {}\n\n", json_data);
        let mut clients = self.sse_clients.lock();
        let mut active_clients = Vec::new();

        for mut client in clients.drain(..) {
            if client.write_all(message.as_bytes()).is_ok() {
                active_clients.push(client);
            }
        }

        *clients = active_clients;
    }

    fn start_listener(&self) {
        let mut port = 3000;
        let mut listener: Option<TcpListener> = None;

        while port <= 3020 {
            match TcpListener::bind(format!("0.0.0.0:{}", port)) {
                Ok(l) => {
                    self.port.store(port, Ordering::SeqCst);
                    listener = Some(l);
                    break;
                }
                Err(_) => {
                    port += 1;
                }
            }
        }

        let listener = match listener {
            Some(l) => l,
            None => {
                eprintln!("[OpenMT LAN Server] Error: no se pudo enlazar ningún puerto entre 3000 y 3020");
                return;
            }
        };

        let current_port = self.port.load(Ordering::SeqCst);
        println!("[OpenMT LAN Server] Escuchando en 0.0.0.0:{}", current_port);

        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                let state_clone = Arc::clone(&self.state);
                let sse_clone = Arc::clone(&self.sse_clients);
                let dist_ref = self.dist_dir.lock().clone();

                thread::spawn(move || {
                    Self::handle_connection(stream, &state_clone, &sse_clone, &dist_ref);
                });
            }
        }
    }

    fn handle_connection(
        mut stream: TcpStream,
        state: &Mutex<serde_json::Value>,
        sse_clients: &Mutex<Vec<TcpStream>>,
        dist_dir: &Path,
    ) {
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let mut buffer = [0u8; 4096];
        let bytes_read = match stream.read(&mut buffer) {
            Ok(n) if n > 0 => n,
            _ => return,
        };

        let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);
        let mut lines = req_str.lines();
        let first_line = match lines.next() {
            Some(l) => l,
            None => return,
        };

        let parts: Vec<&str> = first_line.split_whitespace().collect();
        if parts.len() < 2 {
            return;
        }

        let method = parts[0];
        let full_uri = parts[1];
        let path = full_uri.split('?').next().unwrap_or("/");

        // Manejo de CORS Preflight
        if method == "OPTIONS" {
            let response = "HTTP/1.1 204 No Content\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                Access-Control-Allow-Headers: *\r\n\
                Connection: close\r\n\r\n";
            let _ = stream.write_all(response.as_bytes());
            return;
        }

        // 1. Endpoint SSE: /api/lyrics/events
        if path == "/api/lyrics/events" {
            let initial_json = {
                let st = state.lock();
                serde_json::to_string(&*st).unwrap_or_default()
            };

            let headers = "HTTP/1.1 200 OK\r\n\
                Content-Type: text/event-stream\r\n\
                Cache-Control: no-cache, no-transform\r\n\
                Connection: keep-alive\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Access-Control-Allow-Headers: *\r\n\r\n";

            if stream.write_all(headers.as_bytes()).is_ok() {
                let init_msg = format!("data: {}\n\n", initial_json);
                let _ = stream.write_all(init_msg.as_bytes());
                let _ = stream.set_read_timeout(None);
                sse_clients.lock().push(stream);
            }
            return;
        }

        // 2. Endpoint REST: /api/lyrics/sync
        if path == "/api/lyrics/sync" {
            if method == "POST" {
                // Encontrar el inicio del cuerpo JSON
                if let Some(body_start) = req_str.find("\r\n\r\n") {
                    let body = &req_str[body_start + 4..];
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
                        let payload_str = {
                            let mut st = state.lock();
                            if let serde_json::Value::Object(map) = parsed {
                                if let serde_json::Value::Object(ref mut cur_map) = *st {
                                    for (k, v) in map {
                                        cur_map.insert(k, v);
                                    }
                                }
                            }
                            serde_json::to_string(&*st).unwrap_or_default()
                        };

                        // Broadcast a todos los clientes SSE
                        let msg = format!("data: {}\n\n", payload_str);
                        let mut clients = sse_clients.lock();
                        let mut active = Vec::new();
                        for mut c in clients.drain(..) {
                            if c.write_all(msg.as_bytes()).is_ok() {
                                active.push(c);
                            }
                        }
                        *clients = active;

                        let resp = "HTTP/1.1 200 OK\r\n\
                            Content-Type: application/json\r\n\
                            Access-Control-Allow-Origin: *\r\n\
                            Connection: close\r\n\r\n\
                            {\"ok\":true}";
                        let _ = stream.write_all(resp.as_bytes());
                        return;
                    }
                }
            }

            // GET /api/lyrics/sync
            let json_body = {
                let st = state.lock();
                serde_json::to_string(&*st).unwrap_or_default()
            };
            let resp = format!(
                "HTTP/1.1 200 OK\r\n\
                Content-Type: application/json\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Content-Length: {}\r\n\
                Connection: close\r\n\r\n{}",
                json_body.len(),
                json_body
            );
            let _ = stream.write_all(resp.as_bytes());
            return;
        }

        // 3. Servir archivos estáticos de dist/ o fallback prompter
        Self::serve_static_file(stream, path, dist_dir);
    }

    fn serve_static_file(mut stream: TcpStream, path: &str, dist_dir: &Path) {
        let clean_path = path.trim_start_matches('/');
        let target_file = if clean_path.is_empty() || clean_path == "index.html" || clean_path == "prompter" || clean_path == "obs" {
            dist_dir.join("index.html")
        } else {
            let candidate = dist_dir.join(clean_path);
            if candidate.exists() && candidate.is_file() {
                candidate
            } else {
                dist_dir.join("index.html")
            }
        };

        if target_file.exists() && target_file.is_file() {
            if let Ok(mut file) = File::open(&target_file) {
                let mut contents = Vec::new();
                if file.read_to_end(&mut contents).is_ok() {
                    let mime = Self::get_mime_type(&target_file);
                    let resp_header = format!(
                        "HTTP/1.1 200 OK\r\n\
                        Content-Type: {}\r\n\
                        Content-Length: {}\r\n\
                        Access-Control-Allow-Origin: *\r\n\
                        Connection: close\r\n\r\n",
                        mime,
                        contents.len()
                    );
                    let _ = stream.write_all(resp_header.as_bytes());
                    let _ = stream.write_all(&contents);
                    return;
                }
            }
        }

        // Fallback: Si no hay carpeta dist física, servir prompter HTML autónomo embebido
        let fallback_html = Self::get_embedded_prompter_html();
        let resp = format!(
            "HTTP/1.1 200 OK\r\n\
            Content-Type: text/html; charset=utf-8\r\n\
            Content-Length: {}\r\n\
            Access-Control-Allow-Origin: *\r\n\
            Connection: close\r\n\r\n{}",
            fallback_html.len(),
            fallback_html
        );
        let _ = stream.write_all(resp.as_bytes());
    }

    fn get_mime_type(path: &Path) -> &'static str {
        match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
            "html" | "htm" => "text/html; charset=utf-8",
            "js" | "mjs" => "application/javascript; charset=utf-8",
            "css" => "text/css; charset=utf-8",
            "json" => "application/json; charset=utf-8",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "woff" => "font/woff",
            "woff2" => "font/woff2",
            "wasm" => "application/wasm",
            _ => "application/octet-stream",
        }
    }

    fn get_embedded_prompter_html() -> &'static str {
        r#"<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OpenMT Prompter LAN</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0d10;
      color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 10px 16px;
      background: #141820;
      border-bottom: 1px solid #232a36;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
    }
    .song-title { font-weight: 700; color: #ff7a2f; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
    .prompter-box {
      flex: 1;
      overflow-y: auto;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .current-line {
      font-size: clamp(28px, 6vw, 56px);
      font-weight: 800;
      line-height: 1.25;
      color: #ffffff;
      text-shadow: 0 2px 16px rgba(0,0,0,0.8);
      transition: all 0.15s ease;
      margin-bottom: 18px;
      max-width: 900px;
    }
    .next-line {
      font-size: clamp(18px, 3.8vw, 32px);
      font-weight: 500;
      line-height: 1.3;
      color: rgba(255, 255, 255, 0.55);
      max-width: 800px;
    }
    .empty-state {
      color: #64748b;
      font-size: 16px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="song-title" id="songName">OpenMT Live</div>
    <div class="status-badge"><span class="status-dot"></span><span id="connStatus">LAN WiFi Conectado</span></div>
  </div>
  <div class="prompter-box" id="prompter">
    <div class="current-line" id="curLine">Esperando reproducción...</div>
    <div class="next-line" id="nextLine"></div>
  </div>
  <script>
    let rawLrc = "";
    let parsedLines = [];
    let offsetMs = 350;
    let position = 0;

    function parseLrc(text) {
      if (!text) return [];
      const lines = text.split('\n');
      const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
      const result = [];
      for (const line of lines) {
        const trimmed = line.trim();
        let match;
        timeRegex.lastIndex = 0;
        const matches = [];
        while ((match = timeRegex.exec(trimmed)) !== null) {
          matches.push(match);
        }
        if (matches.length > 0) {
          const textOnly = trimmed.replace(timeRegex, '').trim();
          for (const m of matches) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const frac = m[3] ? parseFloat('0.' + m[3]) : 0;
            result.push({ time: min * 60 + sec + frac, text: textOnly });
          }
        }
      }
      return result.sort((a, b) => a.time - b.time);
    }

    function updateDisplay() {
      if (parsedLines.length === 0) {
        document.getElementById('curLine').textContent = "Esperando reproducción...";
        document.getElementById('nextLine').textContent = "";
        return;
      }
      const adjPos = Math.max(0, position - (offsetMs / 1000));
      let idx = -1;
      for (let i = 0; i < parsedLines.length; i++) {
        if (parsedLines[i].time <= adjPos) {
          idx = i;
        } else {
          break;
        }
      }
      if (idx >= 0 && idx < parsedLines.length) {
        document.getElementById('curLine').textContent = parsedLines[idx].text || "♪ ♪ ♪";
        if (idx + 1 < parsedLines.length) {
          document.getElementById('nextLine').textContent = parsedLines[idx + 1].text || "";
        } else {
          document.getElementById('nextLine').textContent = "";
        }
      } else {
        document.getElementById('curLine').textContent = "♪ ♪ ♪";
        document.getElementById('nextLine').textContent = parsedLines[0]?.text || "";
      }
    }

    function applyData(data) {
      if (!data) return;
      if (data.projectName) document.getElementById('songName').textContent = data.projectName;
      if (data.rawLrc !== undefined && data.rawLrc !== rawLrc) {
        rawLrc = data.rawLrc;
        parsedLines = parseLrc(rawLrc);
      }
      if (data.offsetMs !== undefined) offsetMs = data.offsetMs;
      if (data.position !== undefined) position = data.position;
      updateDisplay();
    }

    // Server-Sent Events
    function connectSSE() {
      const sse = new EventSource('/api/lyrics/events');
      sse.onmessage = (e) => {
        try {
          applyData(JSON.parse(e.data));
          document.getElementById('connStatus').textContent = 'LAN WiFi En Vivo';
        } catch {}
      };
      sse.onerror = () => {
        document.getElementById('connStatus').textContent = 'Reconectando...';
        sse.close();
        setTimeout(connectSSE, 2000);
      };
    }
    connectSSE();

    // Polling respaldo
    setInterval(() => {
      fetch('/api/lyrics/sync')
        .then(r => r.json())
        .then(d => applyData(d))
        .catch(() => {});
    }, 250);
  </script>
</body>
</html>"#
    }
}
