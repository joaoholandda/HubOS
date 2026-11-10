//! Núcleo do HubOS: tudo que não depende da interface nem do Windows.
//!
//! Fica separado do app Tauri para poder ser testado em qualquer máquina
//! (inclusive no CI em Linux) com arquivos de exemplo.

pub mod media;
pub mod model;
pub mod sessions;
pub mod sgdb;
pub mod steam;
pub mod vdf;
pub mod xbox;

pub use model::{Game, Source};
