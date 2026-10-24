"""Whisper check of the Hebrew narration, verse by verse: python3 score_he.py <dir of vNN.wav>
(each file one whole verse). Prints a consonant error rate per verse and overall."""
import json, os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asr, verses
d = sys.argv[1]
paths = [os.path.abspath(f'{d}/v{i:02d}.wav') for i in range(34)]
res = asr.asr(paths, 'he')
ref = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'genesis_he.json'), encoding='utf-8'))
def cons(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if 'א' <= c <= 'ת' or c in ' ־')
    s = s.replace('־', ' ').translate(str.maketrans('ךםןףץ', 'כמנפצ'))
    for c in 'ויאהע': s = s.replace(c, '')
    return re.sub(r'\s+', ' ', s).strip()
def ed(a, b):
    dd = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, dd[0] = dd[0], i
        for j in range(1, len(b) + 1):
            p, dd[j] = dd[j], min(dd[j] + 1, dd[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return dd[len(b)]
te = tn = 0
for i, p in enumerate(paths):
    h = res.get(p, '') or ''
    a, b = cons(' '.join(ref[i]['he'])), cons(re.sub(r'(.)\1{3,}', r'\1', h))
    e = ed(a, b); te += e; tn += len(a)
    print(f'{verses.V[i][0]} CER {e / max(1, len(a)):.2f}  {h[:110]}')
print('overall CER %.3f' % (te / tn))
