"""Kokoro v1.0 text-to-speech run with the pure-numpy ONNX interpreter in onnxnp.py.

Usage:  python3 kokoro_np.py MODEL_DIR OUT_DIR
MODEL_DIR is the unpacked kokoro-multi-lang-v1_0 folder from
https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models (Apache-2.0).
Writes one 24 kHz WAV per phrase in PHRASES; the game ships them as MP3 in public/omg/voice/.
Phrases are given as phonemes (misaki/espeak symbols from the model's tokens.txt) so no
phonemiser is needed.
"""
import os, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import onnxnp

NAMES = ('af_alloy,af_aoede,af_bella,af_heart,af_jessica,af_kore,af_nicole,af_nova,af_river,af_sarah,af_sky,'
         'am_adam,am_echo,am_eric,am_fenrir,am_liam,am_michael,am_onyx,am_puck,am_santa,'
         'bf_alice,bf_emma,bf_isabella,bf_lily,bm_daniel,bm_fable,bm_george,bm_lewis').split(',')

OMG = 'ˈO mI ɡˈɑd'
PHRASES = {  # name: (phonemes, voice, speed)
    'calm_am_puck': (OMG + '.', 'am_puck', 1.0),
    'calm_af_bella': (OMG + '.', 'af_bella', 1.05),
    'q_af_jessica': (OMG + '?!', 'af_jessica', 1.0),
    'excl_am_adam': (OMG + '!', 'am_adam', 1.0),
    'long_am_liam': ('ˈOː mˈIː ɡˈɑːd!', 'am_liam', 0.95),
    'double_am_echo': (OMG + ', ' + OMG + '!', 'am_echo', 1.1),
    'excl_am_fenrir': (OMG + '!', 'am_fenrir', 1.0),
    'sep_am_onyx': ('ˈO. mˈI. ɡˈɑd.', 'am_onyx', 0.85),
    'excl_bm_lewis': (OMG + '!', 'bm_lewis', 1.0),
    'excl_bm_daniel': (OMG + '!', 'bm_daniel', 1.0),
    'sep_bm_george': ('ˈO. mˈI. ɡˈɑd.', 'bm_george', 0.85),
    'long_am_michael': ('ˈOː mˈIː ɡˈɑːd!', 'am_michael', 0.9),
    'triple_am_liam': (', '.join([OMG] * 3) + '!', 'am_liam', 1.15),
    'excl_am_echo': (OMG + '!', 'am_echo', 1.0),
    'slow_bm_george': ('ˈO… mˈI… ɡˈɑd!', 'bm_george', 0.75),
    'houston_am_michael': ('hjˈustᵊn… ' + OMG + '.', 'am_michael', 0.95),
    'houston_am_adam': ('hjˈustᵊn, ' + OMG + '!', 'am_adam', 1.0),
    'houston_am_onyx': ('hjˈustᵊn… ' + OMG + '!', 'am_onyx', 0.9),
    'triple_af_jessica': (', '.join([OMG] * 3) + '!', 'af_jessica', 1.15),
    'slow_af_nicole': ('ˈO… mˈI… ɡˈɑd…', 'af_nicole', 0.75),
    'excl_am_eric': (OMG + '!', 'am_eric', 1.0),
    'whoa_am_adam': ('wˈO… ' + OMG + '!', 'am_adam', 1.0),
    'excl_am_michael': (OMG + '!', 'am_michael', 1.0),
    'long_af_jessica': ('ˈOː mˈIː ɡˈɑːd!', 'af_jessica', 0.95),
    'holy_am_eric': ('hˈOli… ' + OMG + '!', 'am_eric', 1.0),
    'gods_am_liam': ('ˈO mI ɡˈɑdz!', 'am_liam', 1.0),
    'gods_af_jessica': ('ˈO mI ɡˈɑdz!', 'af_jessica', 1.0),
    'gods_am_fenrir': ('ˈO mI ɡˈɑdz!', 'am_fenrir', 0.95),
    'gods_am_echo': ('ˈO mI ɡˈɑdz!', 'am_echo', 0.95),
    'gods_bm_george': ('ˈOː mˈIː ɡˈɑːdz!', 'bm_george', 0.85),
    'gods_am_onyx': ('ˈO mI ɡˈɑdz!', 'am_onyx', 0.9),
    'slow_am_onyx': ('ˈO… mˈI… ɡˈɑd.', 'am_onyx', 0.7),
    'iam_am_onyx': ('ˈI ˈæm ðˈæt ˈI ˈæm.', 'am_onyx', 0.75),
}

def main(model_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    graph, _ = onnxnp.load_model(os.path.join(model_dir, 'model.onnx'))
    tok = {}
    for line in open(os.path.join(model_dir, 'tokens.txt'), encoding='utf-8'):
        line = line.rstrip('\n')
        if line:
            sym, idx = line[:line.rfind(' ')], int(line[line.rfind(' ') + 1:])
            tok[sym] = idx
    voices = np.fromfile(os.path.join(model_dir, 'voices.bin'), dtype=np.float32).reshape(-1, 510, 1, 256)
    for name, (phon, voice, speed) in PHRASES.items():
        ids = [tok[c] for c in phon]
        feeds = {graph.inputs[0]: np.array([[0] + ids + [0]], dtype=np.int64),
                 graph.inputs[1]: voices[NAMES.index(voice)][len(ids)].astype(np.float32),
                 graph.inputs[2]: np.array([speed], dtype=np.float32)}
        audio = onnxnp.Runner(graph, seed=0).run(feeds)[graph.outputs[0]].reshape(-1)
        a = np.clip(audio, -1, 1)
        with wave.open(os.path.join(out_dir, name + '.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
            w.writeframes((a * 32767).astype('<i2').tobytes())
        print(name, f'{len(a) / 24000:.2f}s')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
