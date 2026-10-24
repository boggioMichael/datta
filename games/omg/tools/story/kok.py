"""Kokoro v1.0 through onnxruntime, phonemes in (IPA from the model's own token set).
Models: $OMG_TTS_DIR/kokoro-multi-lang-v1_0 (the sherpa-onnx Kokoro multi-language release)."""
import os, sys, wave, numpy as np, onnxruntime as ort
M = os.path.join(os.environ.get('OMG_TTS_DIR', os.path.expanduser('~/tts')), 'kokoro-multi-lang-v1_0')
TOK = {}
for line in open(M + '/tokens.txt', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line: continue
    sym, idx = line[:line.rfind(' ')], int(line[line.rfind(' ') + 1:])
    TOK[sym] = idx
VOICES = np.fromfile(M + '/voices.bin', dtype=np.float32).reshape(54, 510, 1, 256)
NAMES = 'af_alloy,af_aoede,af_bella,af_heart,af_jessica,af_kore,af_nicole,af_nova,af_river,af_sarah,af_sky,am_adam,am_echo,am_eric,am_fenrir,am_liam,am_michael,am_onyx,am_puck,am_santa,bf_alice,bf_emma,bf_isabella,bf_lily,bm_daniel,bm_fable,bm_george,bm_lewis,ef_dora,em_alex,ff_siwis,hf_alpha,hf_beta,hm_omega,hm_psi,if_sara,im_nicola,jf_alpha,jf_gongitsune,jf_nezumi,jf_tebukuro,jm_kumo,pf_dora,pm_alex,pm_santa,zf_xiaobei,zf_xiaoni,zf_xiaoxiao,zf_xiaoyi,zm_yunjian,zm_yunxi,zm_yunxia,zm_yunyang,em_santa'.split(',')
_sess = None
def sess():
    global _sess
    if _sess is None:
        o = ort.SessionOptions(); o.intra_op_num_threads = 4
        _sess = ort.InferenceSession(M + '/model.onnx', o, providers=['CPUExecutionProvider'])
    return _sess
def ids(phon):
    phon = phon.replace('g', 'ɡ')
    out = []
    for ch in phon:
        if ch not in TOK: raise KeyError('no token for %r in %r' % (ch, phon))
        out.append(TOK[ch])
    return out
def synth(phon, voice, speed=1.0):
    t = ids(phon)
    if len(t) > 500: raise ValueError('too long: %d' % len(t))
    style = VOICES[NAMES.index(voice)][len(t)]
    out = sess().run(None, {'tokens': np.array([[0] + t + [0]], dtype=np.int64), 'style': style.astype(np.float32), 'speed': np.array([speed], dtype=np.float32)})
    return out[0].reshape(-1)
def write(path, a, sr=24000):
    a = np.clip(a, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((a * 32767).astype('<i2').tobytes())
