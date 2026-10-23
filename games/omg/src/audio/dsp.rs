//! DSP building blocks: filters, oscillators, noise, time-stretch, pitch-shift,
//! reverb, echo, chorus, FFT vocoder, limiter and loudness.

use alloc::vec;
use alloc::vec::Vec;

use crate::m::*;

/// Stereo buffer.
#[derive(Clone, Default)]
pub struct St { pub l: Vec<f32>, pub r: Vec<f32> }
impl St {
    pub fn new(n: usize) -> St { St { l: vec![0.0; n], r: vec![0.0; n] } }
    pub fn len(&self) -> usize { self.l.len() }
    pub fn from_mono(x: &[f32], pan: f32) -> St {
        let a = (pan + 1.0) * PI * 0.25;
        let (gl, gr) = (cos(a) * 1.4142, sin(a) * 1.4142);
        St { l: x.iter().map(|v| v * gl).collect(), r: x.iter().map(|v| v * gr).collect() }
    }
    pub fn ensure(&mut self, n: usize) { if self.l.len() < n { self.l.resize(n, 0.0); self.r.resize(n, 0.0); } }
    /// mix `o` into self starting at sample `at` with gain `g`
    pub fn add(&mut self, o: &St, at: usize, g: f32) {
        self.ensure(at + o.len());
        for i in 0..o.len() { self.l[at + i] += o.l[i] * g; self.r[at + i] += o.r[i] * g; }
    }
    pub fn add_mono(&mut self, x: &[f32], at: usize, g: f32, pan: f32) {
        self.ensure(at + x.len());
        let a = (pan + 1.0) * PI * 0.25;
        let (gl, gr) = (cos(a) * 1.4142 * g, sin(a) * 1.4142 * g);
        for i in 0..x.len() { self.l[at + i] += x[i] * gl; self.r[at + i] += x[i] * gr; }
    }
    pub fn gain(&mut self, g: f32) { for v in self.l.iter_mut() { *v *= g; } for v in self.r.iter_mut() { *v *= g; } }
    pub fn peak(&self) -> f32 { let mut p = 0.0f32; for i in 0..self.len() { p = p.max(abs(self.l[i])).max(abs(self.r[i])); } p }
    pub fn mono(&self) -> Vec<f32> { (0..self.len()).map(|i| 0.5 * (self.l[i] + self.r[i])).collect() }
    pub fn trim_tail(&mut self, thr: f32, sr: f32) {
        let mut n = self.len();
        while n > 1 && abs(self.l[n - 1]) < thr && abs(self.r[n - 1]) < thr { n -= 1; }
        let n = (n + (0.05 * sr) as usize).min(self.len());
        self.l.truncate(n); self.r.truncate(n);
    }
}

// ───────────────────────── filters
#[derive(Clone, Copy, Default)]
pub struct Bq { b0: f32, b1: f32, b2: f32, a1: f32, a2: f32, z1: f32, z2: f32 }
impl Bq {
    fn norm(b0: f32, b1: f32, b2: f32, a0: f32, a1: f32, a2: f32) -> Bq { Bq { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, z1: 0.0, z2: 0.0 } }
    pub fn lp(sr: f32, f: f32, q: f32) -> Bq { let w = TAU * clamp(f, 10.0, sr * 0.45) / sr; let (s, c) = (sin(w), cos(w)); let a = s / (2.0 * q); Bq::norm((1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0, 1.0 + a, -2.0 * c, 1.0 - a) }
    pub fn hp(sr: f32, f: f32, q: f32) -> Bq { let w = TAU * clamp(f, 10.0, sr * 0.45) / sr; let (s, c) = (sin(w), cos(w)); let a = s / (2.0 * q); Bq::norm((1.0 + c) / 2.0, -(1.0 + c), (1.0 + c) / 2.0, 1.0 + a, -2.0 * c, 1.0 - a) }
    pub fn bp(sr: f32, f: f32, q: f32) -> Bq { let w = TAU * clamp(f, 10.0, sr * 0.45) / sr; let (s, c) = (sin(w), cos(w)); let a = s / (2.0 * q); Bq::norm(a, 0.0, -a, 1.0 + a, -2.0 * c, 1.0 - a) }
    pub fn peak(sr: f32, f: f32, q: f32, db_: f32) -> Bq { let w = TAU * clamp(f, 10.0, sr * 0.45) / sr; let (s, c) = (sin(w), cos(w)); let a = s / (2.0 * q); let k = pow(10.0, db_ / 40.0); Bq::norm(1.0 + a * k, -2.0 * c, 1.0 - a * k, 1.0 + a / k, -2.0 * c, 1.0 - a / k) }
    pub fn shelf(sr: f32, f: f32, db_: f32, high: bool) -> Bq {
        let a = pow(10.0, db_ / 40.0); let w = TAU * clamp(f, 10.0, sr * 0.45) / sr; let (s, c) = (sin(w), cos(w)); let al = s / 2.0 * 1.4142; let sa = 2.0 * sqrt(a) * al;
        if high { Bq::norm(a * ((a + 1.0) + (a - 1.0) * c + sa), -2.0 * a * ((a - 1.0) + (a + 1.0) * c), a * ((a + 1.0) + (a - 1.0) * c - sa), (a + 1.0) - (a - 1.0) * c + sa, 2.0 * ((a - 1.0) - (a + 1.0) * c), (a + 1.0) - (a - 1.0) * c - sa) }
        else { Bq::norm(a * ((a + 1.0) - (a - 1.0) * c + sa), 2.0 * a * ((a - 1.0) - (a + 1.0) * c), a * ((a + 1.0) - (a - 1.0) * c - sa), (a + 1.0) + (a - 1.0) * c + sa, -2.0 * ((a - 1.0) + (a + 1.0) * c), (a + 1.0) + (a - 1.0) * c - sa) }
    }
    /// Swap in new coefficients but keep the filter state (for sweeps).
    #[inline] pub fn coef(&mut self, n: Bq) { self.b0 = n.b0; self.b1 = n.b1; self.b2 = n.b2; self.a1 = n.a1; self.a2 = n.a2; }
    #[inline] pub fn run(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.z1;
        self.z1 = self.b1 * x - self.a1 * y + self.z2;
        self.z2 = self.b2 * x - self.a2 * y;
        y
    }
    pub fn apply(&mut self, x: &mut [f32]) { for v in x.iter_mut() { *v = self.run(*v); } }
}
pub fn filt(x: &mut [f32], mut f: Bq) { f.apply(x); }
pub fn filt_st(s: &mut St, f: Bq) { let mut a = f; let mut b = f; a.apply(&mut s.l); b.apply(&mut s.r); }
pub fn lp(x: &mut [f32], sr: f32, f: f32) { filt(x, Bq::lp(sr, f, 0.707)); }
pub fn hp(x: &mut [f32], sr: f32, f: f32) { filt(x, Bq::hp(sr, f, 0.707)); }

// ───────────────────────── sources
pub struct Noise { s: u32, b0: f32, b1: f32, b2: f32, br: f32 }
impl Noise {
    pub fn new(seed: u32) -> Noise { Noise { s: seed | 1, b0: 0.0, b1: 0.0, b2: 0.0, br: 0.0 } }
    #[inline] pub fn white(&mut self) -> f32 { self.s ^= self.s << 13; self.s ^= self.s >> 17; self.s ^= self.s << 5; (self.s as f32 / 4_294_967_296.0) * 2.0 - 1.0 }
    #[inline] pub fn pink(&mut self) -> f32 { let w = self.white(); self.b0 = 0.99765 * self.b0 + w * 0.0990460; self.b1 = 0.96300 * self.b1 + w * 0.2965164; self.b2 = 0.57000 * self.b2 + w * 1.0526913; (self.b0 + self.b1 + self.b2 + w * 0.1848) * 0.25 }
    #[inline] pub fn brown(&mut self) -> f32 { let w = self.white(); self.br = (self.br + w * 0.02) * 0.998; self.br * 3.5 }
}
#[inline] fn blep(t: f32, dt: f32) -> f32 {
    if t < dt { let t = t / dt; t + t - t * t - 1.0 } else if t > 1.0 - dt { let t = (t - 1.0) / dt; t * t + t + t + 1.0 } else { 0.0 }
}
/// Band-limited sawtooth / square oscillator.
#[derive(Clone, Copy, Default)]
pub struct Osc { pub ph: f32 }
impl Osc {
    #[inline] pub fn saw(&mut self, f: f32, sr: f32) -> f32 {
        let dt = clamp(f / sr, 0.0, 0.45);
        let v = 2.0 * self.ph - 1.0 - blep(self.ph, dt);
        self.ph += dt; if self.ph >= 1.0 { self.ph -= 1.0; }
        v
    }
    #[inline] pub fn square(&mut self, f: f32, sr: f32, pw: f32) -> f32 {
        let dt = clamp(f / sr, 0.0, 0.45);
        let mut v = if self.ph < pw { 1.0 } else { -1.0 };
        v += blep(self.ph, dt);
        let mut t2 = self.ph - pw; if t2 < 0.0 { t2 += 1.0; }
        v -= blep(t2, dt);
        self.ph += dt; if self.ph >= 1.0 { self.ph -= 1.0; }
        v
    }
    #[inline] pub fn sine(&mut self, f: f32, sr: f32) -> f32 {
        let v = sin(self.ph * TAU);
        self.ph += f / sr; if self.ph >= 1.0 { self.ph -= floor(self.ph); }
        v
    }
}

pub fn env_adsr(n: usize, sr: f32, a: f32, d: f32, s: f32, r: f32) -> Vec<f32> {
    let (na, nd, nr) = ((a * sr) as usize, (d * sr) as usize, (r * sr) as usize);
    (0..n).map(|i| {
        let mut e = if i < na { i as f32 / na.max(1) as f32 } else if i < na + nd { 1.0 - (1.0 - s) * (i - na) as f32 / nd.max(1) as f32 } else { s };
        if i + nr > n { e *= (n - i) as f32 / nr.max(1) as f32; }
        e
    }).collect()
}

// ───────────────────────── resampling / time
pub fn resample(x: &[f32], from: f32, to: f32) -> Vec<f32> {
    if (from - to).abs_lt(0.5) { return x.to_vec(); }
    let ratio = from / to;
    let mut y = x.to_vec();
    if ratio > 1.0 { // downsampling: pre-filter
        let mut f1 = Bq::lp(from, to * 0.45, 0.707); let mut f2 = f1; f1.apply(&mut y); f2.apply(&mut y);
    }
    let n = (x.len() as f32 / ratio) as usize;
    (0..n).map(|i| interp(&y, i as f32 * ratio)).collect()
}
trait AbsLt { fn abs_lt(self, k: f32) -> bool; }
impl AbsLt for f32 { #[inline] fn abs_lt(self, k: f32) -> bool { self < k && self > -k } }
#[inline] pub fn interp(x: &[f32], pos: f32) -> f32 {
    if pos < 0.0 { return 0.0; }
    let i = pos as usize;
    if i + 1 >= x.len() { return if i < x.len() { x[i] } else { 0.0 }; }
    // 4-point Hermite
    let f = pos - i as f32;
    let xm1 = if i > 0 { x[i - 1] } else { x[i] };
    let (x0, x1) = (x[i], x[i + 1]);
    let x2 = if i + 2 < x.len() { x[i + 2] } else { x1 };
    let c0 = x0; let c1 = 0.5 * (x1 - xm1); let c2 = xm1 - 2.5 * x0 + 2.0 * x1 - 0.5 * x2; let c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    ((c3 * f + c2) * f + c1) * f + c0
}
/// Tape-style speed change: rate > 1 is faster and higher.
pub fn varispeed(x: &[f32], rate: f32) -> Vec<f32> {
    let n = (x.len() as f32 / rate) as usize;
    (0..n).map(|i| interp(x, i as f32 * rate)).collect()
}
/// Varispeed with a per-output-sample rate curve function.
pub fn varispeed_curve(x: &[f32], rate: impl Fn(f32) -> f32, max_len: usize) -> Vec<f32> {
    let mut out = Vec::with_capacity(max_len);
    let mut pos = 0.0f32; let n = x.len() as f32;
    let mut i = 0usize;
    while pos < n - 1.0 && out.len() < max_len {
        out.push(interp(x, pos));
        pos += rate(i as f32);
        i += 1;
    }
    out
}

/// WSOLA time-stretch: factor > 1 makes it longer, pitch unchanged.
pub fn stretch(x: &[f32], factor: f32, sr: f32) -> Vec<f32> {
    if (factor - 1.0).abs_lt(0.01) || x.len() < 64 { return x.to_vec(); }
    let n = ((0.038 * sr) as usize) & !1;
    let hop_out = n / 2;
    let hop_in = hop_out as f32 / factor;
    let tol = (0.011 * sr) as isize;
    let win: Vec<f32> = (0..n).map(|i| 0.5 - 0.5 * cos(TAU * i as f32 / n as f32)).collect();
    let out_len = (x.len() as f32 * factor) as usize + n;
    let mut out = vec![0.0f32; out_len];
    let mut norm = vec![0.0f32; out_len];
    let get = |i: isize| -> f32 { if i < 0 || i as usize >= x.len() { 0.0 } else { x[i as usize] } };
    let mut prev_end: isize = 0; // position in input right after previous chosen frame's overlap part
    let mut k = 0usize;
    loop {
        let out_pos = k * hop_out;
        if out_pos + n > out_len { break; }
        let nominal = (k as f32 * hop_in) as isize;
        if nominal as usize >= x.len() { break; }
        let best = if k == 0 { 0 } else {
            // match the natural continuation of the previous frame
            let target = prev_end;
            let mut best_d = 0isize; let mut best_c = f32::MIN;
            let step = 2isize;
            let mut d = -tol;
            while d <= tol {
                let cand = nominal + d;
                let mut c = 0.0f32; let mut e1 = 1e-9f32; let mut e2 = 1e-9f32;
                let mut j = 0isize;
                while j < (n / 2) as isize {
                    let a = get(cand + j); let b = get(target + j);
                    c += a * b; e1 += a * a; e2 += b * b;
                    j += 4;
                }
                let score = c / sqrt(e1 * e2);
                if score > best_c { best_c = score; best_d = d; }
                d += step;
            }
            best_d
        };
        let start = (nominal + best).max(0);
        for j in 0..n {
            let v = get(start + j as isize) * win[j];
            out[out_pos + j] += v;
            norm[out_pos + j] += win[j];
        }
        prev_end = start + hop_out as isize;
        k += 1;
    }
    let total = ((x.len() as f32) * factor) as usize;
    let mut y: Vec<f32> = (0..total.min(out_len)).map(|i| if norm[i] > 1e-3 { out[i] / norm[i] } else { 0.0 }).collect();
    let f = (0.004 * sr) as usize;
    let ln = y.len();
    for i in 0..f.min(ln) { y[ln - 1 - i] *= i as f32 / f as f32; }
    y
}
/// Pitch shift by `semis` semitones and play `tempo` times as fast.
pub fn pitch_shift(x: &[f32], semis: f32, tempo: f32, sr: f32) -> Vec<f32> {
    let ratio = pow(2.0, semis / 12.0);
    let s = stretch(x, ratio / tempo, sr);
    if (ratio - 1.0).abs_lt(0.002) { s } else { varispeed(&s, ratio) }
}

// ───────────────────────── effects
pub fn saturate(x: &mut [f32], drive: f32) {
    if drive <= 0.0 { return; }
    let d = 1.0 + drive * 6.0; let n = tanh(d);
    for v in x.iter_mut() { *v = tanh(*v * d) / n; }
}
pub fn saturate_st(s: &mut St, drive: f32) { saturate(&mut s.l, drive); saturate(&mut s.r, drive); }

pub fn ringmod(x: &mut [f32], f: f32, mix: f32, sr: f32) {
    let mut o = Osc::default();
    for v in x.iter_mut() { let m = o.sine(f, sr); *v = *v * (1.0 - mix) + *v * m * mix; }
}

pub fn radio(x: &mut [f32], amt: f32, sr: f32, seed: u32) {
    if amt <= 0.0 { return; }
    let dry = x.to_vec();
    let mut y = dry.clone();
    filt(&mut y, Bq::hp(sr, 380.0, 0.9)); filt(&mut y, Bq::hp(sr, 380.0, 0.7));
    filt(&mut y, Bq::lp(sr, 3000.0, 0.9)); filt(&mut y, Bq::lp(sr, 3200.0, 0.7));
    filt(&mut y, Bq::peak(sr, 1800.0, 1.2, 5.0));
    let pk = y.iter().fold(0.0f32, |a, v| a.max(abs(*v))).max(1e-6);
    for v in y.iter_mut() { *v /= pk; }
    saturate(&mut y, 0.5 + amt);
    let mut nz = Noise::new(seed);
    let mut nf = Bq::bp(sr, 2500.0, 0.6);
    for i in 0..y.len() { y[i] += nf.run(nz.white()) * 0.035 * amt; }
    for i in 0..x.len() { x[i] = dry[i] * (1.0 - amt) + y[i] * amt * 0.9; }
}

pub fn chorus(x: &[f32], voices: usize, depth_ms: f32, rate: f32, spread: f32, sr: f32) -> St {
    let n = x.len() + (0.04 * sr) as usize;
    let mut out = St::new(n);
    for v in 0..voices {
        let ph = v as f32 * 2.1;
        let r = rate * (1.0 + 0.27 * v as f32);
        let base = (0.010 + 0.006 * v as f32) * sr;
        let pan = if voices > 1 { (v as f32 / (voices - 1) as f32 * 2.0 - 1.0) * spread } else { 0.0 };
        let mut y = vec![0.0f32; n];
        for i in 0..n {
            let d = base + depth_ms * 0.001 * sr * (0.5 + 0.5 * sin(TAU * r * i as f32 / sr + ph));
            y[i] = interp(x, i as f32 - d);
        }
        out.add_mono(&y, 0, 1.0 / sqrt(voices as f32), pan);
    }
    out
}

pub fn echo(s: &St, delay: f32, fb: f32, taps: usize, sr: f32, lpf: f32) -> St {
    let d = (delay * sr) as usize;
    let mut out = s.clone();
    out.ensure(s.len() + d * taps + 1);
    let mut tap = s.clone();
    let mut g = 1.0;
    for k in 1..=taps {
        g *= fb;
        filt_st(&mut tap, Bq::lp(sr, lpf, 0.707));
        let at = d * k;
        let (gl, gr) = if k % 2 == 1 { (g * 0.45, g) } else { (g, g * 0.45) };
        for i in 0..tap.len() { out.l[at + i] += tap.l[i] * gl; out.r[at + i] += tap.r[i] * gr; }
    }
    out
}

/// 8-line feedback delay network reverb. Returns the full signal (dry*dry + wet*reverb) with tail.
pub fn reverb(s: &St, rt60: f32, size: f32, bright: f32, predelay: f32, wet: f32, dry: f32, sr: f32) -> St {
    const DL: [f32; 8] = [0.0297, 0.0371, 0.0411, 0.0437, 0.0530, 0.0593, 0.0671, 0.0733];
    let tail = (rt60 * 1.1 * sr) as usize;
    let n = s.len() + tail + (predelay * sr) as usize;
    let mut out = St::new(n);
    let lens: Vec<usize> = DL.iter().map(|d| ((d * size * sr) as usize).max(8)).collect();
    let mut lines: Vec<Vec<f32>> = lens.iter().map(|&l| vec![0.0; l]).collect();
    let mut idx = [0usize; 8];
    let g: Vec<f32> = lens.iter().map(|&l| pow(10.0, -3.0 * l as f32 / (rt60.max(0.05) * sr))).collect();
    let damp = exp(-TAU * (1500.0 + 9000.0 * bright) / sr);
    let mut lpz = [0.0f32; 8];
    // input diffusion allpasses
    let apd: [usize; 4] = [(0.0047 * sr) as usize, (0.0036 * sr) as usize, (0.0127 * sr) as usize, (0.0093 * sr) as usize];
    let mut ap: Vec<Vec<f32>> = apd.iter().map(|&l| vec![0.0; l.max(1)]).collect();
    let mut api = [0usize; 4];
    let pd = (predelay * sr) as usize;
    let mut hp_in = Bq::hp(sr, 140.0, 0.707);
    for i in 0..n {
        let src = if i >= pd && i - pd < s.len() { 0.5 * (s.l[i - pd] + s.r[i - pd]) } else { 0.0 };
        let mut x = hp_in.run(src);
        for k in 0..4 {
            let buf = &mut ap[k]; let j = api[k];
            let d = buf[j];
            let y = -0.7 * x + d;
            buf[j] = x + 0.7 * y;
            api[k] = (j + 1) % buf.len();
            x = y;
        }
        let mut y = [0.0f32; 8];
        let mut sum = 0.0;
        for k in 0..8 {
            let v = lines[k][idx[k]];
            lpz[k] = v * (1.0 - damp) + lpz[k] * damp;
            y[k] = lpz[k];
            sum += y[k];
        }
        let m = sum * 0.25;
        for k in 0..8 {
            let fbk = (y[k] - m) * g[k];
            let sign = if k % 2 == 0 { 1.0 } else { -1.0 };
            lines[k][idx[k]] = x * 0.6 * sign + fbk;
            idx[k] = (idx[k] + 1) % lens[k];
        }
        let l = y[0] - y[2] + y[4] - y[6] + 0.5 * y[1];
        let r = y[1] - y[3] + y[5] - y[7] + 0.5 * y[2];
        out.l[i] = l * 0.42 * wet;
        out.r[i] = r * 0.42 * wet;
        if i < s.len() { out.l[i] += s.l[i] * dry; out.r[i] += s.r[i] * dry; }
    }
    out
}

// ───────────────────────── FFT + vocoder
pub fn fft(re: &mut [f32], im: &mut [f32], inv: bool) {
    let n = re.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j |= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    let mut len = 2;
    while len <= n {
        let ang = TAU / len as f32 * if inv { 1.0 } else { -1.0 };
        let (wr, wi) = (cos(ang), sin(ang));
        let mut i = 0;
        while i < n {
            let (mut cr, mut ci) = (1.0f32, 0.0f32);
            for k in 0..len / 2 {
                let (ar, ai) = (re[i + k], im[i + k]);
                let (br, bi) = (re[i + k + len / 2], im[i + k + len / 2]);
                let (tr, ti) = (br * cr - bi * ci, br * ci + bi * cr);
                re[i + k] = ar + tr; im[i + k] = ai + ti;
                re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti;
                let ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
            }
            i += len;
        }
        len <<= 1;
    }
    if inv { let k = 1.0 / n as f32; for v in re.iter_mut() { *v *= k; } for v in im.iter_mut() { *v *= k; } }
}

fn smooth_env(mag: &[f32], out: &mut [f32], w: usize) {
    let n = mag.len(); let w = w.max(1);
    let mut acc = 0.0f32;
    // centred moving average via prefix sums
    let mut pre = vec![0.0f32; n + 1];
    for i in 0..n { pre[i + 1] = pre[i] + mag[i]; }
    for i in 0..n {
        let a = i.saturating_sub(w); let b = (i + w + 1).min(n);
        acc = (pre[b] - pre[a]) / (b - a) as f32;
        out[i] = acc + 1e-6;
    }
    let _ = acc;
}

/// Channel vocoder: the carrier takes the modulator's spectral envelope.
pub fn vocode(modu: &[f32], car: &[f32], sr: f32) -> Vec<f32> {
    let n = if sr > 30000.0 { 2048 } else { 1024 };
    let hop = n / 4;
    let len = modu.len().min(car.len());
    let win: Vec<f32> = (0..n).map(|i| 0.5 - 0.5 * cos(TAU * i as f32 / n as f32)).collect();
    let mut out = vec![0.0f32; len + n];
    let mut wsum = vec![0.0f32; len + n];
    let (mut mr, mut mi, mut cr, mut ci) = (vec![0.0f32; n], vec![0.0f32; n], vec![0.0f32; n], vec![0.0f32; n]);
    let half = n / 2 + 1;
    let (mut mm, mut cm, mut me, mut ce) = (vec![0.0f32; half], vec![0.0f32; half], vec![0.0f32; half], vec![0.0f32; half]);
    let bw = ((180.0 / (sr / n as f32)) as usize).max(2);
    let mut pos = 0usize;
    while pos < len {
        for i in 0..n {
            let j = pos + i;
            let w = win[i];
            mr[i] = if j < len { modu[j] * w } else { 0.0 }; mi[i] = 0.0;
            cr[i] = if j < len { car[j] * w } else { 0.0 }; ci[i] = 0.0;
        }
        fft(&mut mr, &mut mi, false); fft(&mut cr, &mut ci, false);
        for k in 0..half { mm[k] = sqrt(mr[k] * mr[k] + mi[k] * mi[k]); cm[k] = sqrt(cr[k] * cr[k] + ci[k] * ci[k]); }
        smooth_env(&mm, &mut me, bw); smooth_env(&cm, &mut ce, bw);
        for k in 0..half {
            let g = me[k] / ce[k];
            cr[k] *= g; ci[k] *= g;
            if k > 0 && k < n / 2 { cr[n - k] = cr[k]; ci[n - k] = -ci[k]; }
        }
        fft(&mut cr, &mut ci, true);
        for i in 0..n { out[pos + i] += cr[i] * win[i]; wsum[pos + i] += win[i] * win[i]; }
        pos += hop;
    }
    let mut y: Vec<f32> = (0..len).map(|i| if wsum[i] > 1e-4 { out[i] / wsum[i] } else { 0.0 }).collect();
    normalize(&mut y, 0.9);
    y
}

pub fn normalize(x: &mut [f32], peak: f32) {
    let p = x.iter().fold(0.0f32, |a, v| a.max(abs(*v)));
    if p > 1e-6 { let g = peak / p; for v in x.iter_mut() { *v *= g; } }
}
pub fn reverse(x: &[f32]) -> Vec<f32> { x.iter().rev().cloned().collect() }
pub fn fade(x: &mut [f32], fin: usize, fout: usize) {
    let n = x.len();
    for i in 0..fin.min(n) { x[i] *= i as f32 / fin as f32; }
    for i in 0..fout.min(n) { x[n - 1 - i] *= i as f32 / fout as f32; }
}

// ───────────────────────── loudness + mastering
/// Approximate integrated loudness (BS.1770 K-weighting, 400 ms blocks, gated).
pub fn loudness(s: &St, sr: f32) -> f32 {
    let mut l = s.l.clone(); let mut r = s.r.clone();
    let k1 = Bq::shelf(sr, 1500.0, 4.0, true); let k2 = Bq::hp(sr, 60.0, 0.5);
    filt(&mut l, k1); filt(&mut l, k2); filt(&mut r, k1); filt(&mut r, k2);
    let b = (0.4 * sr) as usize; let h = (0.1 * sr) as usize;
    let mut blocks = Vec::new();
    let mut i = 0;
    while i + b <= l.len().max(b) {
        let e = (i + b).min(l.len());
        if e <= i { break; }
        let mut ms = 0.0f32;
        for j in i..e { ms += l[j] * l[j] + r[j] * r[j]; }
        blocks.push(ms / (e - i) as f32);
        i += h;
        if e == l.len() { break; }
    }
    let lk = |ms: f32| -0.691 + 10.0 * log10(ms.max(1e-12));
    let gated: Vec<f32> = blocks.iter().cloned().filter(|&m| lk(m) > -70.0).collect();
    if gated.is_empty() { return -70.0; }
    let mean = gated.iter().sum::<f32>() / gated.len() as f32;
    let rel = lk(mean) - 10.0;
    let g2: Vec<f32> = gated.into_iter().filter(|&m| lk(m) > rel).collect();
    if g2.is_empty() { return lk(mean); }
    lk(g2.iter().sum::<f32>() / g2.len() as f32)
}

pub fn limiter(s: &mut St, ceiling: f32, sr: f32) {
    let n = s.len(); if n == 0 { return; }
    let look = ((0.003 * sr) as usize).max(1);
    let raw: Vec<f32> = (0..n).map(|i| { let p = abs(s.l[i]).max(abs(s.r[i])); if p > ceiling { ceiling / p } else { 1.0 } }).collect();
    // forward-looking sliding minimum over [i, i + look]
    let mut mn = vec![1.0f32; n];
    let mut dq: Vec<usize> = Vec::with_capacity(n);
    let mut head = 0usize;
    for j in 0..n + look {
        if j < n {
            while dq.len() > head && raw[*dq.last().unwrap()] >= raw[j] { dq.pop(); }
            dq.push(j);
        }
        if j >= look {
            let i = j - look;
            while head < dq.len() && dq[head] < i { head += 1; }
            if head < dq.len() { mn[i] = raw[dq[head]]; }
        }
    }
    // smooth attack (backwards) and release (forwards)
    let att = exp(-1.0 / (look as f32 * 0.35));
    let mut e = 1.0f32;
    for i in (0..n).rev() { let t = mn[i]; e = if t < e { t } else { t + (e - t) * att }; mn[i] = e; }
    let rel = exp(-1.0 / (0.08 * sr));
    let mut env = 1.0f32;
    for i in 0..n {
        let t = mn[i];
        env = if t < env { t } else { t + (env - t) * rel };
        s.l[i] = clamp(s.l[i] * env, -ceiling, ceiling);
        s.r[i] = clamp(s.r[i] * env, -ceiling, ceiling);
    }
}

pub fn master(s: &mut St, target_lufs: f32, ceiling: f32, glue: f32, sr: f32) {
    // remove DC and sub rumble
    filt_st(s, Bq::hp(sr, 24.0, 0.707));
    let l = loudness(s, sr);
    if l > -69.0 { s.gain(db(target_lufs - l)); }
    if glue > 0.0 {
        let d = 1.0 + glue;
        let nrm = tanh(d * 0.9);
        for v in s.l.iter_mut() { *v = tanh(*v * d * 0.9) / nrm * 0.95; }
        for v in s.r.iter_mut() { *v = tanh(*v * d * 0.9) / nrm * 0.95; }
    }
    for _ in 0..3 {
        limiter(s, ceiling, sr);
        let l = loudness(s, sr);
        if (l - target_lufs).abs_lt(0.5) || l < -69.0 { break; }
        s.gain(db(target_lufs - l));
    }
    limiter(s, ceiling, sr);
    let n = s.len();
    let fi = ((0.004 * sr) as usize).min(n / 4);
    for i in 0..fi { let k = i as f32 / fi as f32; s.l[i] *= k; s.r[i] *= k; }
    let fo = ((0.12 * sr) as usize).min(n / 3);
    for i in 0..fo { let k = (i as f32 / fo as f32) * (i as f32 / fo as f32); s.l[n - 1 - i] *= k; s.r[n - 1 - i] *= k; }
}
