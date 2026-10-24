"""English phrases (JPS 1917) with Kokoro through the sherpa-onnx CLI: python3 gen_en.py [outdir]
Voice: am_onyx (speaker 17), a little slower than normal."""
import concurrent.futures as cf, glob, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import verses
T = os.environ.get('OMG_TTS_DIR', os.path.expanduser('~/tts')); M = T + '/kokoro-multi-lang-v1_0'
SH = sorted(glob.glob(T + '/sherpa-onnx-v*-linux-x64-shared'))[-1]
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work', 'en')
os.makedirs(OUT, exist_ok=True)
SID = int(os.environ.get('SID', 17)); LS = os.environ.get('LS', '1.2')
def tts_text(s):
    s = s.replace('[', '').replace(']', '').replace('‘', '').replace('’', '').replace('—', ',')
    s = s.replace('sea-monsters', 'sea monsters').replace('fruit-tree', 'fruit tree').strip()
    if s and s[-1] not in '.;:,!?': s += '.'
    return s
def job(args):
    name, text = args
    out = f'{OUT}/{name}.wav'
    if os.path.exists(out): return name, 'cached'
    cmd = [SH + '/bin/sherpa-onnx-offline-tts', f'--kokoro-model={M}/model.onnx', f'--kokoro-voices={M}/voices.bin',
           f'--kokoro-tokens={M}/tokens.txt', f'--kokoro-data-dir={M}/espeak-ng-data', f'--kokoro-lexicon={M}/lexicon-us-en.txt,{M}/lexicon-zh.txt',
           '--num-threads=2', f'--sid={SID}', f'--kokoro-length-scale={LS}', f'--output-filename={out}', text]
    r = subprocess.run(cmd, capture_output=True, text=True, env={'LD_LIBRARY_PATH': SH + '/lib'})
    return name, 'ok' if os.path.exists(out) else r.stderr[-300:]
jobs = [(f'v{vi:02d}p{pi}', tts_text(p)) for vi, (ref, he, ph, en) in enumerate(verses.V) for pi, p in enumerate(en)]
with cf.ThreadPoolExecutor(4) as ex:
    for name, st in ex.map(job, jobs):
        if st not in ('ok', 'cached'): print(name, st)
print(len(jobs), 'phrases in', OUT)
