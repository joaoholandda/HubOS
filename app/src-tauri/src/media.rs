//! "Tocando agora": lê e controla a mídia do Windows (a mesma que aparece
//! nas teclas de mídia). Funciona com Spotify, Firefox, YouTube etc.

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub title: String,
    pub artist: String,
    /// Nome amigável do programa que está tocando.
    pub app: String,
    pub playing: bool,
}

#[cfg(windows)]
mod imp {
    use base64::Engine;
    use windows::core::Interface;
    use windows::Media::Control::{GlobalSystemMediaTransportControlsSession as Session, GlobalSystemMediaTransportControlsSessionManager as Manager, GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status};
    use windows::Storage::Streams::{DataReader, IInputStream};

    use super::Media;

    fn session() -> windows::core::Result<Session> {
        Manager::RequestAsync()?.join()?.GetCurrentSession()
    }

    pub fn current() -> Option<Media> {
        let s = session().ok()?;
        let props = s.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
        let title = props.Title().map(|t| t.to_string()).unwrap_or_default();
        if title.is_empty() {
            return None;
        }
        Some(Media {
            title,
            artist: props.Artist().map(|t| t.to_string()).unwrap_or_default(),
            app: hubos_core::media::app_name(&s.SourceAppUserModelId().map(|t| t.to_string()).unwrap_or_default()),
            playing: s.GetPlaybackInfo().and_then(|i| i.PlaybackStatus()).map(|st| st == Status::Playing).unwrap_or(false),
        })
    }

    /// Capa do que está tocando, como `data:` URL (para a interface mostrar direto).
    pub fn art() -> Option<String> {
        let props = session().ok()?.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
        let stream = props.Thumbnail().ok()?.OpenReadAsync().ok()?.join().ok()?;
        let size = stream.Size().ok()? as u32;
        if size == 0 || size > 8 * 1024 * 1024 {
            return None;
        }
        let mime = stream.ContentType().map(|t| t.to_string()).ok().filter(|m| m.starts_with("image/")).unwrap_or_else(|| "image/png".into());
        let reader = DataReader::CreateDataReader(&stream.cast::<IInputStream>().ok()?).ok()?;
        reader.LoadAsync(size).ok()?.join().ok()?;
        let mut buf = vec![0u8; size as usize];
        reader.ReadBytes(&mut buf).ok()?;
        Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(buf)))
    }

    pub fn control(action: &str) -> Result<(), String> {
        let s = session().map_err(|_| "Nada tocando agora.".to_string())?;
        let op = match action {
            "toggle" => s.TryTogglePlayPauseAsync(),
            "next" => s.TrySkipNextAsync(),
            "prev" => s.TrySkipPreviousAsync(),
            other => return Err(format!("Ação de mídia desconhecida: {other}")),
        };
        match op.and_then(|o| o.join()) {
            Ok(true) => Ok(()),
            Ok(false) => Err("O player não aceitou o comando.".into()),
            Err(e) => Err(format!("Não consegui controlar a mídia: {e}")),
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn current() -> Option<super::Media> {
        None
    }
    pub fn art() -> Option<String> {
        None
    }
    pub fn control(_: &str) -> Result<(), String> {
        Err("Só funciona no Windows.".into())
    }
}

pub use imp::{art, control, current};
