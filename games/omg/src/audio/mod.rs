//! The sound engine. Runs in its own wasm instance inside a Web Worker: the
//! browser hands it the decoded base voice clips once, then asks for sounds by
//! id and gets interleaved stereo PCM back.

pub mod dsp;
pub mod sfx;
pub mod omg;
pub mod music;

use alloc::vec;
use alloc::vec::Vec;

use crate::Global;
use dsp::*;
use crate::m::db;

pub struct Snd {
    pub sr: f32,
    pub clips: Vec<Vec<f32>>,
    pub staging: Vec<Vec<f32>>,
    pub out: Vec<f32>,
    pub style: u8,
}

static SND: Global<Snd> = Global::new();
fn s() -> &'static mut Snd {
    let g = SND.get();
    if g.is_none() { *g = Some(Snd { sr: 48000.0, clips: Vec::new(), staging: Vec::new(), out: Vec::new(), style: 0 }); }
    g.as_mut().unwrap()
}

pub fn render_id(snd: &mut Snd, id: u32) -> St {
    let sr = snd.sr;
    let seed = 1000 + id * 7919;
    match id {
        0..=36 => { let mut r = omg::recipe(id as u8); omg::apply_style(&mut r, snd.style); omg::render(snd, &r, seed) }
        40 => { let mut s = St::from_mono(&sfx::tick(sr), 0.0); master(&mut s, -24.0, db(-1.0), 0.0, sr); s }
        41 => { let mut s = St::from_mono(&sfx::pop(sr), 0.0); master(&mut s, -22.0, db(-1.0), 0.0, sr); s }
        42 => { let mut s = sfx::coins(sr); master(&mut s, -22.0, db(-1.0), 0.0, sr); s }
        43 => { let mut s = sfx::rumble(sr, 0.9, seed); master(&mut s, -18.0, db(-1.0), 0.1, sr); s }
        44 => { let mut s = sfx::magnet(sr); master(&mut s, -20.0, db(-1.0), 0.0, sr); s }
        45 => { let mut s = sfx::explosion(sr, seed); master(&mut s, -14.0, db(-1.0), 0.2, sr); s }
        46 => { let mut s = sfx::tape_down(sr); master(&mut s, -20.0, db(-1.0), 0.0, sr); s }
        47 => { let mut s = St::from_mono(&sfx::whoosh(sr, 0.7, 2500.0, 300.0, seed), 0.0); master(&mut s, -20.0, db(-1.0), 0.0, sr); s }
        48 => { let mut s = sfx::arp_up(sr, &[72.0, 76.0, 79.0, 84.0, 88.0], 0.06); master(&mut s, -19.0, db(-1.0), 0.0, sr); s }
        49 => { let mut s = St::from_mono(&sfx::whoosh(sr, 0.6, 400.0, 3000.0, seed), 0.0); master(&mut s, -22.0, db(-1.0), 0.0, sr); s }
        50 => { let mut s = sfx::arp_up(sr, &[67.0, 72.0, 79.0], 0.08); master(&mut s, -22.0, db(-1.0), 0.0, sr); s }
        51 => { let mut r = omg::iam(); omg::apply_style(&mut r, if snd.style == 3 { 0 } else { snd.style }); omg::render(snd, &r, seed) }
        52 => { let mut s = sfx::honk(sr); master(&mut s, -18.0, db(-1.0), 0.0, sr); s }
        53 => { let mut s = St::from_mono(&sfx::click(sr), 0.0); master(&mut s, -24.0, db(-1.0), 0.0, sr); s }
        54 => { let mut s = St::from_mono(&sfx::buzzer(sr), 0.0); master(&mut s, -16.0, db(-1.0), 0.0, sr); s }
        60..=66 => music::render(sr, (id - 60) as u8),
        _ => St::new(1),
    }
}

// ───────────────────────── exports (used by audio-worker.js)
#[unsafe(no_mangle)]
pub extern "C" fn snd_init(sr: f32) { let s = s(); s.sr = if sr > 8000.0 { sr } else { 48000.0 }; }
#[unsafe(no_mangle)]
pub extern "C" fn snd_clip_alloc(id: u32, len: u32) -> *mut f32 {
    let s = s();
    let id = id as usize;
    if s.staging.len() <= id { s.staging.resize(id + 1, Vec::new()); }
    s.staging[id] = vec![0.0; len as usize];
    s.staging[id].as_mut_ptr()
}
#[unsafe(no_mangle)]
pub extern "C" fn snd_clip_ready(id: u32, src_sr: f32) {
    let s = s();
    let id = id as usize;
    if id >= s.staging.len() { return; }
    let raw = core::mem::take(&mut s.staging[id]);
    let mut x = resample(&raw, src_sr, s.sr);
    // trim silence around the words, keep a breath
    let thr = 0.004;
    let a = x.iter().position(|v| v.abs_gt(thr)).unwrap_or(0);
    let b = x.iter().rposition(|v| v.abs_gt(thr)).unwrap_or(x.len().saturating_sub(1));
    let pre = (0.02 * s.sr) as usize; let post = (0.08 * s.sr) as usize;
    let a = a.saturating_sub(pre); let b = (b + post).min(x.len());
    if b > a { x = x[a..b].to_vec(); }
    normalize(&mut x, 0.9);
    if s.clips.len() <= id { s.clips.resize(id + 1, Vec::new()); }
    s.clips[id] = x;
}
#[unsafe(no_mangle)]
pub extern "C" fn snd_style(style: u32) { s().style = style.min(5) as u8; }
/// Renders sound `id`; returns the number of stereo frames available at snd_out_ptr().
#[unsafe(no_mangle)]
pub extern "C" fn snd_render(id: u32) -> u32 {
    let snd = s();
    let st = render_id(snd, id);
    let n = st.len();
    snd.out.clear();
    snd.out.reserve(n * 2);
    for i in 0..n { snd.out.push(st.l[i]); snd.out.push(st.r[i]); }
    n as u32
}
#[unsafe(no_mangle)]
pub extern "C" fn snd_out_ptr() -> *const f32 { s().out.as_ptr() }
#[unsafe(no_mangle)]
pub extern "C" fn snd_clip_count() -> u32 { omg::CLIPS.len() as u32 }

trait AbsGt { fn abs_gt(&self, k: f32) -> bool; }
impl AbsGt for f32 { #[inline] fn abs_gt(&self, k: f32) -> bool { *self > k || *self < -k } }

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    fn read_wav(path: &str) -> (Vec<f32>, f32) {
        let mut b = Vec::new();
        std::fs::File::open(path).unwrap().read_to_end(&mut b).unwrap();
        let sr = u32::from_le_bytes([b[24], b[25], b[26], b[27]]) as f32;
        let ch = u16::from_le_bytes([b[22], b[23]]) as usize;
        // find "data"
        let mut i = 12;
        while i + 8 < b.len() {
            let id = &b[i..i + 4]; let sz = u32::from_le_bytes([b[i + 4], b[i + 5], b[i + 6], b[i + 7]]) as usize;
            if id == b"data" {
                let d = &b[i + 8..(i + 8 + sz).min(b.len())];
                let mut x = Vec::new();
                for f in d.chunks_exact(2 * ch) { x.push(i16::from_le_bytes([f[0], f[1]]) as f32 / 32768.0); }
                return (x, sr);
            }
            i += 8 + sz;
        }
        panic!("no data");
    }
    fn write_wav(path: &str, s: &St, sr: u32) {
        let n = s.len();
        let mut f = std::fs::File::create(path).unwrap();
        let data_len = (n * 4) as u32;
        let mut h = Vec::new();
        h.extend_from_slice(b"RIFF"); h.extend_from_slice(&(36 + data_len).to_le_bytes()); h.extend_from_slice(b"WAVEfmt ");
        h.extend_from_slice(&16u32.to_le_bytes()); h.extend_from_slice(&1u16.to_le_bytes()); h.extend_from_slice(&2u16.to_le_bytes());
        h.extend_from_slice(&sr.to_le_bytes()); h.extend_from_slice(&(sr * 4).to_le_bytes()); h.extend_from_slice(&4u16.to_le_bytes()); h.extend_from_slice(&16u16.to_le_bytes());
        h.extend_from_slice(b"data"); h.extend_from_slice(&data_len.to_le_bytes());
        f.write_all(&h).unwrap();
        let mut d = Vec::with_capacity(n * 4);
        for i in 0..n {
            for v in [s.l[i], s.r[i]] { let q = (v.clamp(-1.0, 1.0) * 32767.0) as i16; d.extend_from_slice(&q.to_le_bytes()); }
        }
        f.write_all(&d).unwrap();
    }

    #[test]
    #[ignore]
    fn render_all() {
        let sr = 48000.0;
        snd_init(sr);
        for (id, name) in omg::CLIPS.iter().enumerate() {
            let dir = std::env::var("OMG_VOX_DIR").unwrap_or_else(|_| "tools/voice/out".into());
            let (x, csr) = read_wav(&format!("{dir}/{name}.wav"));
            let p = snd_clip_alloc(id as u32, x.len() as u32);
            unsafe { std::ptr::copy_nonoverlapping(x.as_ptr(), p, x.len()); }
            snd_clip_ready(id as u32, csr);
        }
        let out = std::env::var("OMG_RENDER_DIR").unwrap_or_else(|_| "target/render".into());
        std::fs::create_dir_all(&out).unwrap();
        let only: Option<Vec<u32>> = std::env::var("OMG_IDS").ok().map(|v| v.split(',').filter_map(|x| x.parse().ok()).collect());
        let ids: Vec<u32> = only.unwrap_or_else(|| (0..=36).chain(40..=54).chain(60..=66).collect());
        for id in ids {
            let t = std::time::Instant::now();
            let snd = s();
            let st = render_id(snd, id);
            let ms = t.elapsed().as_millis();
            let l = loudness(&st, sr);
            println!("id {id:2}  {:5.2}s  peak {:5.2} dBFS  loud {:6.1} LUFS  render {ms} ms", st.len() as f32 / sr, 20.0 * st.peak().max(1e-9).log10(), l);
            write_wav(&format!("{out}/s{id:02}.wav"), &st, sr as u32);
        }
    }
}

