"""Hebrew phrases with Kokoro from hand-written IPA: python3 gen_he.py [outdir] [voice]
Kokoro has no Hebrew voice; a Spanish one reads the IPA of a modern Israeli reading well,
with a few fixes found by checking every verse with Whisper (score_he.py):
- no glottal stops: the model turns ʔ into a t;
- the r of (ha)arets as a long uvular ʁʁ, or it vanishes;
- tohu va-vohu with a soft b, which the Spanish voice turns into a v-like β;
- "let there be light" slower, with long vowels."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kok, verses
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('OMG_NARR_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')), 'he')
VOICE = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('HEV', 'em_alex')
SPEED = float(os.environ.get('HES', '0.85'))
os.makedirs(OUT, exist_ok=True)
# (verse, phrase) → (IPA, speed) where the plain reading isn't understood
OVERRIDE = {
    (2, 0): ('vajˈomer elohˈim: jehˈiː ˈoːr!', 0.78),
    (2, 1): ('vajhˈiː ˈoːr.', 0.78),
}
def fix(p):
    p = p.replace('ɾ', 'r').replace('ʦ', 'ts').replace('ʔ', '')
    p = p.replace('vavˈohu', 'vabˈohu')
    p = re.sub(r'(ˈ?[ae])rets', r'\1ʁʁets', p)
    return p
if __name__ == '__main__':
    n = 0
    for vi, (ref, he, ph, en) in enumerate(verses.V):
        for pi, p in enumerate(ph):
            f = f'{OUT}/v{vi:02d}p{pi}.wav'
            if os.path.exists(f): continue
            ipa, sp = OVERRIDE.get((vi, pi), (fix(p), SPEED))
            kok.write(f, kok.synth(ipa, VOICE, sp)); n += 1
    print('wrote', n, 'phrases to', OUT, 'with', VOICE)
