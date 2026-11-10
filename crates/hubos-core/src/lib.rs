//! Núcleo do HubOS: tudo que não depende da interface nem do Windows.
//!
//! Fica separado do app Tauri para poder ser testado em qualquer máquina
//! (inclusive no CI em Linux) com arquivos de exemplo.

pub mod model;
pub mod sgdb;
pub mod steam;
pub mod vdf;

pub use model::{Game, Source};
