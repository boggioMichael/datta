//! Small math kit: libm bindings (provided by compiler_builtins on wasm, by the
//! system libm natively), a 2-vector, a PCG random generator and easing helpers.

unsafe extern "C" {
    fn sinf(x: f32) -> f32;
    fn cosf(x: f32) -> f32;
    fn atan2f(y: f32, x: f32) -> f32;
    fn expf(x: f32) -> f32;
    fn logf(x: f32) -> f32;
    fn powf(x: f32, y: f32) -> f32;
    fn sqrtf(x: f32) -> f32;
    fn floorf(x: f32) -> f32;
    fn ceilf(x: f32) -> f32;
    fn roundf(x: f32) -> f32;
    fn tanhf(x: f32) -> f32;
    fn fmodf(x: f32, y: f32) -> f32;
    fn log10f(x: f32) -> f32;
    fn asinf(x: f32) -> f32;
    fn tanf(x: f32) -> f32;
    #[link_name = "pow"] fn pow_f64(x: f64, y: f64) -> f64;
    #[link_name = "log10"] fn log10_f64(x: f64) -> f64;
}

#[inline] pub fn sin(x: f32) -> f32 { unsafe { sinf(x) } }
#[inline] pub fn cos(x: f32) -> f32 { unsafe { cosf(x) } }
#[inline] pub fn tan(x: f32) -> f32 { unsafe { tanf(x) } }
#[inline] pub fn atan2(y: f32, x: f32) -> f32 { unsafe { atan2f(y, x) } }
#[inline] pub fn exp(x: f32) -> f32 { unsafe { expf(x) } }
#[inline] pub fn ln(x: f32) -> f32 { unsafe { logf(x) } }
#[inline] pub fn log10(x: f32) -> f32 { unsafe { log10f(x) } }
#[inline] pub fn pow(x: f32, y: f32) -> f32 { unsafe { powf(x, y) } }
#[inline] pub fn sqrt(x: f32) -> f32 { unsafe { sqrtf(x) } }
#[inline] pub fn floor(x: f32) -> f32 { unsafe { floorf(x) } }
#[inline] pub fn ceil(x: f32) -> f32 { unsafe { ceilf(x) } }
#[inline] pub fn round(x: f32) -> f32 { unsafe { roundf(x) } }
#[inline] pub fn tanh(x: f32) -> f32 { unsafe { tanhf(x) } }
#[inline] pub fn fmod(x: f32, y: f32) -> f32 { unsafe { fmodf(x, y) } }
#[inline] pub fn asin(x: f32) -> f32 { unsafe { asinf(x.clamp(-1.0, 1.0)) } }
#[inline] pub fn log2f(x: f32) -> f32 { ln(x) * core::f32::consts::LOG2_E }
#[inline] pub fn libm_pow64(x: f64, y: f64) -> f64 { unsafe { pow_f64(x, y) } }
#[inline] pub fn log10_64(x: f64) -> f64 { unsafe { log10_f64(x) } }
#[inline] pub fn abs(x: f32) -> f32 { if x < 0.0 { -x } else { x } }
#[inline] pub fn clamp(x: f32, a: f32, b: f32) -> f32 { if x < a { a } else if x > b { b } else { x } }
#[inline] pub fn lerp(a: f32, b: f32, t: f32) -> f32 { a + (b - a) * t }
#[inline] pub fn smooth(t: f32) -> f32 { let t = clamp(t, 0.0, 1.0); t * t * (3.0 - 2.0 * t) }
#[inline] pub fn ease_out(t: f32) -> f32 { let t = clamp(t, 0.0, 1.0); 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t) }
#[inline] pub fn db(x: f32) -> f32 { pow(10.0, x / 20.0) }
/// Exponential approach factor for a time constant `tau` over `dt`.
#[inline] pub fn approach(dt: f32, tau: f32) -> f32 { if tau <= 0.0 { 1.0 } else { 1.0 - exp(-dt / tau) } }
pub const PI: f32 = core::f32::consts::PI;
pub const TAU: f32 = core::f32::consts::TAU;

#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub struct V2 { pub x: f32, pub y: f32 }
impl V2 {
    #[inline] pub const fn new(x: f32, y: f32) -> V2 { V2 { x, y } }
    #[inline] pub fn len(self) -> f32 { sqrt(self.x * self.x + self.y * self.y) }
    #[inline] pub fn len2(self) -> f32 { self.x * self.x + self.y * self.y }
    #[inline] pub fn dot(self, o: V2) -> f32 { self.x * o.x + self.y * o.y }
    #[inline] pub fn norm(self) -> V2 { let l = self.len(); if l > 1e-9 { V2::new(self.x / l, self.y / l) } else { V2::new(0.0, 0.0) } }
    #[inline] pub fn rot(self, a: f32) -> V2 { let (s, c) = (sin(a), cos(a)); V2::new(self.x * c - self.y * s, self.x * s + self.y * c) }
    #[inline] pub fn perp(self) -> V2 { V2::new(-self.y, self.x) }
}
impl core::ops::Add for V2 { type Output = V2; #[inline] fn add(self, o: V2) -> V2 { V2::new(self.x + o.x, self.y + o.y) } }
impl core::ops::Sub for V2 { type Output = V2; #[inline] fn sub(self, o: V2) -> V2 { V2::new(self.x - o.x, self.y - o.y) } }
impl core::ops::Mul<f32> for V2 { type Output = V2; #[inline] fn mul(self, k: f32) -> V2 { V2::new(self.x * k, self.y * k) } }
impl core::ops::AddAssign for V2 { #[inline] fn add_assign(&mut self, o: V2) { self.x += o.x; self.y += o.y; } }
impl core::ops::SubAssign for V2 { #[inline] fn sub_assign(&mut self, o: V2) { self.x -= o.x; self.y -= o.y; } }
impl core::ops::Neg for V2 { type Output = V2; #[inline] fn neg(self) -> V2 { V2::new(-self.x, -self.y) } }

/// PCG-XSH-RR 32-bit generator.
#[derive(Clone)]
pub struct Rng { state: u64, inc: u64 }
impl Rng {
    pub fn new(seed: u64) -> Rng {
        let mut r = Rng { state: 0, inc: (seed << 1) | 1 };
        r.next_u32(); r.state = r.state.wrapping_add(0x853c_49e6_748f_ea9b ^ seed); r.next_u32(); r
    }
    pub fn next_u32(&mut self) -> u32 {
        let old = self.state;
        self.state = old.wrapping_mul(6364136223846793005).wrapping_add(self.inc);
        let xs = (((old >> 18) ^ old) >> 27) as u32;
        let rot = (old >> 59) as u32;
        xs.rotate_right(rot)
    }
    /// Uniform in [0, 1).
    #[inline] pub fn f(&mut self) -> f32 { (self.next_u32() >> 8) as f32 * (1.0 / 16_777_216.0) }
    /// Uniform in [a, b).
    #[inline] pub fn range(&mut self, a: f32, b: f32) -> f32 { a + (b - a) * self.f() }
    /// Uniform in [-1, 1).
    #[inline] pub fn sym(&mut self) -> f32 { self.f() * 2.0 - 1.0 }
    #[inline] pub fn below(&mut self, n: u32) -> u32 { if n == 0 { 0 } else { self.next_u32() % n } }
    #[inline] pub fn chance(&mut self, p: f32) -> bool { self.f() < p }
    /// Approximately normal (sum of uniforms).
    pub fn gauss(&mut self) -> f32 { (self.f() + self.f() + self.f() + self.f() - 2.0) * 1.732 }
}

/// 0xRRGGBB → (r, g, b) in 0..1
#[inline] pub fn rgb(c: u32) -> (f32, f32, f32) {
    (((c >> 16) & 255) as f32 / 255.0, ((c >> 8) & 255) as f32 / 255.0, (c & 255) as f32 / 255.0)
}
pub fn mix_rgb(a: (f32, f32, f32), b: (f32, f32, f32), t: f32) -> (f32, f32, f32) {
    (lerp(a.0, b.0, t), lerp(a.1, b.1, t), lerp(a.2, b.2, t))
}
pub fn hsl(h: f32, s: f32, l: f32) -> (f32, f32, f32) {
    let h = fmod(fmod(h, 1.0) + 1.0, 1.0);
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let f = |t: f32| {
        let t = if t < 0.0 { t + 1.0 } else if t > 1.0 { t - 1.0 } else { t };
        if t < 1.0 / 6.0 { p + (q - p) * 6.0 * t } else if t < 0.5 { q } else if t < 2.0 / 3.0 { p + (q - p) * (2.0 / 3.0 - t) * 6.0 } else { p }
    };
    (f(h + 1.0 / 3.0), f(h), f(h - 1.0 / 3.0))
}
