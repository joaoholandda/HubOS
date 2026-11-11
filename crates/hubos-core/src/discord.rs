//! Conversa com o Discord do PC (o "RPC" local): formato das mensagens e
//! leitura das respostas. A conexão em si fica no app (é um canal do Windows).
//!
//! Cada mensagem é: código (4 bytes) + tamanho (4 bytes) + JSON.

use serde::Serialize;
use serde_json::{json, Value};

pub const OP_HANDSHAKE: u32 = 0;
pub const OP_FRAME: u32 = 1;
pub const OP_CLOSE: u32 = 2;
pub const OP_PING: u32 = 3;
pub const OP_PONG: u32 = 4;

/// Permissões pedidas: ler e controlar a chamada de voz.
pub const SCOPES: [&str; 4] = ["identify", "rpc", "rpc.voice.read", "rpc.voice.write"];

pub fn encode(op: u32, payload: &Value) -> Vec<u8> {
    let body = payload.to_string().into_bytes();
    let mut out = Vec::with_capacity(8 + body.len());
    out.extend_from_slice(&op.to_le_bytes());
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
    out.extend_from_slice(&body);
    out
}

/// (código, tamanho do JSON que vem a seguir).
pub fn decode_header(h: [u8; 8]) -> (u32, usize) {
    (u32::from_le_bytes([h[0], h[1], h[2], h[3]]), u32::from_le_bytes([h[4], h[5], h[6], h[7]]) as usize)
}

pub fn handshake(client_id: &str) -> Value {
    json!({ "v": 1, "client_id": client_id })
}

pub fn command(cmd: &str, args: Value, nonce: u64) -> Value {
    json!({ "cmd": cmd, "args": args, "nonce": nonce.to_string() })
}

/// Resposta de um comando: os dados, ou a mensagem de erro do Discord.
pub fn response(msg: &Value) -> Result<Value, String> {
    if msg["evt"] == "ERROR" {
        return Err(msg["data"]["message"].as_str().unwrap_or("O Discord recusou o pedido.").to_string());
    }
    Ok(msg["data"].clone())
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub id: String,
    pub name: String,
    pub avatar_url: Option<String>,
    pub muted: bool,
    pub deafened: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceChannel {
    pub id: String,
    pub name: String,
    pub guild_id: Option<String>,
    pub members: Vec<Member>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Guild {
    pub id: String,
    pub name: String,
    pub icon_url: Option<String>,
}

fn text(v: &Value) -> Option<String> {
    v.as_str().filter(|s| !s.is_empty()).map(str::to_string)
}

fn member(v: &Value) -> Option<Member> {
    let user = &v["user"];
    let id = text(&user["id"])?;
    let vs = &v["voice_state"];
    let flag = |k: &str| vs[k].as_bool().unwrap_or(false);
    Some(Member {
        name: text(&v["nick"]).or_else(|| text(&user["global_name"])).or_else(|| text(&user["username"])).unwrap_or_else(|| "Alguém".into()),
        avatar_url: text(&user["avatar"]).map(|a| format!("https://cdn.discordapp.com/avatars/{id}/{a}.png?size=64")),
        muted: flag("mute") || flag("self_mute") || v["mute"].as_bool().unwrap_or(false),
        deafened: flag("deaf") || flag("self_deaf"),
        id,
    })
}

/// Canal de voz (resposta de GET_SELECTED_VOICE_CHANNEL ou GET_CHANNEL). `null` = fora de chamada.
pub fn voice_channel(data: &Value) -> Option<VoiceChannel> {
    Some(VoiceChannel {
        id: text(&data["id"])?,
        name: text(&data["name"]).unwrap_or_else(|| "Chamada".into()),
        guild_id: text(&data["guild_id"]),
        members: data["voice_states"].as_array().map(|a| a.iter().filter_map(member).collect()).unwrap_or_default(),
    })
}

pub fn guilds(data: &Value) -> Vec<Guild> {
    let list = data["guilds"].as_array().cloned().unwrap_or_default();
    list.iter().filter_map(|g| Some(Guild { id: text(&g["id"])?, name: text(&g["name"])?, icon_url: text(&g["icon_url"]) })).collect()
}

/// Ids e nomes dos canais de voz de um servidor (tipo 2 = voz, 13 = palco).
pub fn voice_channel_ids(data: &Value) -> Vec<(String, String)> {
    let list = data["channels"].as_array().cloned().unwrap_or_default();
    list.iter().filter(|c| matches!(c["type"].as_u64(), Some(2) | Some(13))).filter_map(|c| Some((text(&c["id"])?, text(&c["name"])?))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mensagem_vai_e_volta() {
        let bytes = encode(OP_FRAME, &command("GET_GUILDS", json!({}), 7));
        let (op, len) = decode_header(bytes[..8].try_into().unwrap());
        assert_eq!(op, OP_FRAME);
        assert_eq!(len, bytes.len() - 8);
        let v: Value = serde_json::from_slice(&bytes[8..]).unwrap();
        assert_eq!(v["nonce"], "7");
    }

    #[test]
    fn erro_do_discord() {
        let msg = json!({"cmd":"AUTHORIZE","evt":"ERROR","data":{"code":5000,"message":"OAuth2 Error: access_denied"}});
        assert_eq!(response(&msg).unwrap_err(), "OAuth2 Error: access_denied");
        assert_eq!(response(&json!({"cmd":"X","evt":null,"data":{"a":1}})).unwrap()["a"], 1);
    }

    #[test]
    fn canal_de_voz() {
        let data = json!({"id":"10","name":"Geral","guild_id":"1","voice_states":[
            {"nick":"Jota","mute":false,"user":{"id":"5","username":"jota","avatar":"abc"},"voice_state":{"self_mute":true,"deaf":false}},
            {"nick":"","user":{"id":"6","username":"ana","global_name":"Ana","avatar":null},"voice_state":{"self_deaf":true}}]});
        let ch = voice_channel(&data).unwrap();
        assert_eq!(ch.name, "Geral");
        assert_eq!(ch.members[0].name, "Jota");
        assert!(ch.members[0].muted && !ch.members[0].deafened);
        assert_eq!(ch.members[0].avatar_url.as_deref(), Some("https://cdn.discordapp.com/avatars/5/abc.png?size=64"));
        assert_eq!(ch.members[1].name, "Ana");
        assert!(ch.members[1].deafened && ch.members[1].avatar_url.is_none());
        assert!(voice_channel(&Value::Null).is_none());
    }

    #[test]
    fn servidores_e_canais() {
        assert_eq!(guilds(&json!({"guilds":[{"id":"1","name":"Amigos","icon_url":null}]}))[0].name, "Amigos");
        let ch = voice_channel_ids(&json!({"channels":[{"id":"1","name":"texto","type":0},{"id":"2","name":"Voz","type":2}]}));
        assert_eq!(ch, vec![("2".to_string(), "Voz".to_string())]);
    }
}
