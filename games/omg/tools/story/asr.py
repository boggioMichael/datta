"""Transcribe WAV files with Whisper turbo (sherpa-onnx): a check that the narration is intelligible.
Needs $OMG_TTS_DIR/sherpa-onnx-*-linux-x64-shared and $OMG_TTS_DIR/sherpa-onnx-whisper-turbo."""
import glob, os, re, subprocess, sys
T = os.environ.get('OMG_TTS_DIR', os.path.expanduser('~/tts'))
W = T + '/sherpa-onnx-whisper-turbo'
SH = sorted(glob.glob(T + '/sherpa-onnx-v*-linux-x64-shared'))[-1]
def asr(paths, lang='he'):
    out = {}
    cmd = [SH + '/bin/sherpa-onnx-offline', f'--whisper-encoder={W}/turbo-encoder.int8.onnx', f'--whisper-decoder={W}/turbo-decoder.int8.onnx',
           f'--tokens={W}/turbo-tokens.txt', f'--whisper-language={lang}', '--whisper-task=transcribe', '--num-threads=4'] + list(paths)
    r = subprocess.run(cmd, capture_output=True, text=True, env={'LD_LIBRARY_PATH': SH + '/lib'})
    cur = None
    for line in (r.stdout + r.stderr).splitlines():
        line = line.strip()
        if line in paths: cur = line; continue
        m = re.search(r'"text": "([^"]*)"', line)
        if m and cur: out[cur] = m.group(1).strip(); cur = None
    return out
if __name__ == '__main__':
    res = asr(sys.argv[2:], sys.argv[1])
    for p in sys.argv[2:]: print(os.path.basename(p), '→', res.get(p))
