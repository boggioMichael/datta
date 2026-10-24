"""Hebrew phrases with Kokoro from hand-written IPA: python3 gen_he.py [outdir] [voice]
Kokoro has no Hebrew voice; a Spanish one reads the IPA of a modern Israeli reading well,
with a few fixes found by checking every verse with Whisper (score_he.py):
- no glottal stops: the model turns ʔ into a t;
- the r of (ha)arets as a long uvular ʁʁ, or it vanishes;
- tohu va-vohu with a soft b, which the Spanish voice turns into a v-like β;
- "let there be light" read by a Hindi voice, the only one whose h survives in "yehi or" (the Spanish one says
  "yeshi" or "yechi"), a little slower and pitched up to meet the main voice (shift.json, read by plan.py);
- "between water and water" with ben and maim, which the Spanish voice keeps."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kok, verses
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get('OMG_NARR_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work')), 'he')
VOICE = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('HEV', 'em_alex')
SPEED = float(os.environ.get('HES', '0.85'))
os.makedirs(OUT, exist_ok=True)
# (verse, phrase) → (IPA, speed, voice or None for the main one) where the plain reading isn't understood
OVERRIDE = {
    (2, 0): ('vajˈomeɾ elohˈim: jehˈi ˈoɾ!', 0.8, 'hm_omega'),
    (2, 1): ('vajhˈi ˈoɾ.', 0.8, 'hm_omega'),
    (5, 1): ('vihˈi mavdˈil bˈen mˈaim lamˈaim.', 0.85, None),
}
# semitones that bring another voice to the main voice's pitch (median F0 126 Hz against 137 Hz)
MATCH = {'hm_omega': 1.4}
def fix(p):
    p = p.replace('ɾ', 'r').replace('ʦ', 'ts').replace('ʔ', '')
    p = p.replace('vavˈohu', 'vabˈohu')
    p = re.sub(r'(ˈ?[ae])rets', r'\1ʁʁets', p)
    return p
if __name__ == '__main__':
    n, shift = 0, {}
    for vi, (ref, he, ph, en) in enumerate(verses.V):
        for pi, p in enumerate(ph):
            name = f'v{vi:02d}p{pi}.wav'
            ipa, sp, voice = OVERRIDE.get((vi, pi), (fix(p), SPEED, None))
            if voice and voice != VOICE: shift[name] = MATCH.get(voice, 0.0)
            f = f'{OUT}/{name}'
            if os.path.exists(f): continue
            kok.write(f, kok.synth(ipa, voice or VOICE, sp)); n += 1
    json.dump(shift, open(f'{OUT}/shift.json', 'w'))
    print('wrote', n, 'phrases to', OUT, 'with', VOICE)
