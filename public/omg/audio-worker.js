/* OH MY GOD — sound worker. Runs a second instance of omg.wasm whose Rust sound
 * engine renders every OMG, effect and music loop as stereo PCM on request. */
'use strict';
let X = null;
let style = 0;
let GOD = 123, IAM = 211;
const isVoice = (id) => id <= GOD || id === IAM;
const queue = [];
let busy = false;

function renderNext() {
  if (busy || !X || !queue.length) return;
  busy = true;
  const job = queue.shift();
  try {
    if (job.style !== undefined && job.style !== style) { style = job.style; X.snd_style(style); }
    const frames = X.snd_render(job.id);
    const data = new Float32Array(X.memory.buffer, X.snd_out_ptr(), frames * 2).slice();
    postMessage({ type: 'sound', id: job.id, style, data }, [data.buffer]);
  } catch (e) {
    postMessage({ type: 'error', message: `render ${job.id}: ${e && e.message}` });
  }
  busy = false;
  setTimeout(renderNext, 0);
}

onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const { instance } = await WebAssembly.instantiate(m.wasm, {});
      X = instance.exports;
      X.snd_init(m.sampleRate);
      if (m.god) GOD = m.god;
      if (m.iam) IAM = m.iam;
      (m.clips || []).forEach((c, id) => {
        if (!c || !c.data || !c.data.length) return;
        const p = X.snd_clip_alloc(id, c.data.length);
        new Float32Array(X.memory.buffer, p, c.data.length).set(c.data);
        X.snd_clip_ready(id, c.sr);
      });
      postMessage({ type: 'ready' });
      renderNext();
    } else if (m.type === 'style') {
      style = m.style; if (X) X.snd_style(style);
      for (let i = queue.length - 1; i >= 0; i--) if (isVoice(queue[i].id)) queue[i].style = style;
    } else if (m.type === 'render') {
      // newest requests for voices first; keep one copy per id
      if (!queue.some((q) => q.id === m.id)) {
        if (m.urgent) queue.unshift({ id: m.id, style: m.style }); else queue.push({ id: m.id, style: m.style });
      }
      renderNext();
    }
  } catch (err) {
    postMessage({ type: 'error', message: String(err && err.message || err) });
  }
};
