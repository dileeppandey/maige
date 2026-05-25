//! Ollama-backed AI chat for image editing.
//!
//! Calls the local Ollama API (`http://localhost:11434`) using `gemma3:4b`,
//! which supports multimodal (image) input. All adjustment values are
//! absolute values in the -100 to 100 range.

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use image::{imageops, DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::io::Cursor;

const OLLAMA_URL: &str = "http://127.0.0.1:11434/api/chat";
const MODEL: &str = "gemma4:e4b";

// ============================================================================
// Public types (serialized to/from JSON for Tauri IPC)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CropRegion {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FlatAdjustments {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub temperature: f32,
    pub tint: f32,
    pub saturation: f32,
    pub vibrance: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Suggestion {
    pub label: String,
    pub adjustments: FlatAdjustments,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: String,
    pub adjustments: Option<FlatAdjustments>,
    pub suggestions: Vec<Suggestion>,
}

impl ChatResponse {
    fn unavailable() -> Self {
        ChatResponse {
            message: "AI assistant unavailable — is Ollama running with gemma4:e4b?".into(),
            adjustments: None,
            suggestions: vec![],
        }
    }
}

// ============================================================================
// Ollama wire types
// ============================================================================

#[derive(Serialize)]
struct OllamaMessage {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    images: Vec<String>,
}

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaResponseMessage,
}

#[derive(Deserialize)]
struct OllamaResponseMessage {
    content: String,
}

// ============================================================================
// Internal helpers
// ============================================================================

/// Strip markdown code fences that Gemma sometimes wraps JSON in.
fn strip_code_fences(s: &str) -> &str {
    let s = s.trim();
    if let Some(inner) = s.strip_prefix("```json") {
        inner.trim_end_matches("```").trim()
    } else if let Some(inner) = s.strip_prefix("```") {
        inner.trim_end_matches("```").trim()
    } else {
        s
    }
}

async fn call_ollama(
    client: &reqwest::Client,
    system: &str,
    user_text: &str,
    image_b64s: Vec<String>,
) -> Option<ChatResponse> {
    let messages = vec![
        OllamaMessage {
            role: "system".into(),
            content: system.into(),
            images: vec![],
        },
        OllamaMessage {
            role: "user".into(),
            content: user_text.into(),
            images: image_b64s,
        },
    ];

    let req = OllamaChatRequest {
        model: MODEL.into(),
        messages,
        stream: false,
    };

    let resp = client
        .post(OLLAMA_URL)
        .json(&req)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await
        .ok()?;

    let body: OllamaChatResponse = resp.json().await.ok()?;
    let raw = strip_code_fences(&body.message.content);
    serde_json::from_str(raw).ok()
}

/// Read image file and base64-encode it as JPEG (≤ 512px longest edge for speed).
fn load_image_b64(path: &str, region: Option<&CropRegion>) -> Option<String> {
    let img = image::open(path).ok()?;

    let img = if let Some(r) = region {
        let w = img.width() as f32;
        let h = img.height() as f32;
        let x = (r.x * w) as u32;
        let y = (r.y * h) as u32;
        let cw = ((r.width * w) as u32).max(1);
        let ch = ((r.height * h) as u32).max(1);
        DynamicImage::ImageRgba8(imageops::crop_imm(&img, x, y, cw, ch).to_image())
    } else {
        img
    };

    // Downscale to keep payload small
    let img = img.thumbnail(512, 512);

    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg).ok()?;
    Some(B64.encode(&buf))
}

// ============================================================================
// Public API called by Tauri commands
// ============================================================================

pub async fn check_reachable() -> bool {
    reqwest::Client::new()
        .get("http://127.0.0.1:11434")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .is_ok()
}

pub async fn analyze_scene(image_path: &str, region: Option<CropRegion>) -> ChatResponse {
    let Some(b64) = load_image_b64(image_path, region.as_ref()) else {
        return ChatResponse {
            message: "Could not read image file.".into(),
            adjustments: None,
            suggestions: vec![],
        };
    };

    let client = reqwest::Client::new();

    let system = r#"You are a photo editing assistant. Analyze the provided image and suggest specific adjustments.
Respond ONLY with valid JSON matching this exact schema (no extra text, no markdown):
{
  "message": "Brief scene description and editing recommendation",
  "adjustments": null,
  "suggestions": [
    { "label": "Short label", "adjustments": { "exposure": 0, "contrast": 0, "highlights": 0, "shadows": 0, "whites": 0, "blacks": 0, "temperature": 0, "tint": 0, "saturation": 0, "vibrance": 0 } }
  ]
}
Provide 2-3 suggestions. All values are absolute in the range -100 to 100."#;

    let user_text = "Please analyze this image and suggest editing adjustments.";

    call_ollama(&client, system, user_text, vec![b64])
        .await
        .unwrap_or_else(ChatResponse::unavailable)
}

pub async fn chat_edit(
    image_path: &str,
    instruction: &str,
    current: FlatAdjustments,
    region_b64: Option<String>,
) -> ChatResponse {
    let client = reqwest::Client::new();

    let system = r#"You are a photo editing assistant. The user describes a photo edit in natural language.
Respond ONLY with valid JSON matching this EXACT schema (no extra text, no markdown, no other fields):
{
  "message": "Brief confirmation of what you changed",
  "adjustments": { "exposure": 0, "contrast": 0, "highlights": 0, "shadows": 0, "whites": 0, "blacks": 0, "temperature": 0, "tint": 0, "saturation": 0, "vibrance": 0 },
  "suggestions": []
}
IMPORTANT: "suggestions" MUST always be an empty array []. Never put strings or objects in it.
All adjustment values are ABSOLUTE (not deltas) in the range -100 to 100.
Start from the current adjustments provided and modify only what the instruction requests."#;

    let user_text = format!(
        "Instruction: {instruction}\n\nCurrent adjustments: exposure={e}, contrast={c}, highlights={hl}, shadows={sh}, whites={w}, blacks={bl}, temperature={t}, tint={ti}, saturation={sat}, vibrance={v}",
        e = current.exposure, c = current.contrast, hl = current.highlights, sh = current.shadows,
        w = current.whites, bl = current.blacks, t = current.temperature, ti = current.tint,
        sat = current.saturation, v = current.vibrance,
    );

    // Include main image for context (small thumbnail); also include region if provided
    let mut images = Vec::new();
    if let Some(b64) = load_image_b64(image_path, None) {
        images.push(b64);
    }
    if let Some(rb64) = region_b64 {
        // Strip data URL prefix if present
        let raw = rb64.splitn(2, ',').last().unwrap_or(&rb64).to_string();
        images.push(raw);
    }

    call_ollama(&client, system, &user_text, images)
        .await
        .unwrap_or_else(ChatResponse::unavailable)
}
