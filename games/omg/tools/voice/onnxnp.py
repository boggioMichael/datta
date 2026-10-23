# A small pure-numpy ONNX interpreter (opset ~14), written for running a TTS
# model offline without native runtimes. Only the ops needed are implemented.
import math, mmap, struct, sys
from collections import ChainMap
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from pb import fields, read_varint

DT = {1: np.float32, 2: np.uint8, 3: np.int8, 4: np.uint16, 5: np.int16, 6: np.int32, 7: np.int64,
      9: np.bool_, 10: np.float16, 11: np.float64, 12: np.uint32, 13: np.uint64}

def s64(v):
    return v - (1 << 64) if v >= (1 << 63) else v

def packed_varints(buf):
    out = []; i = 0; b = bytes(buf)
    while i < len(b):
        v, i = read_varint(b, i); out.append(s64(v))
    return out

# ---------------------------------------------------------------- parsing
def parse_tensor(buf):
    dims = []; dtype = 1; raw = None; floats = []; i32 = []; i64 = []; dbl = []; name = ''; strings = []
    for fn, wt, v in fields(buf):
        if fn == 1:
            if wt == 2: dims += packed_varints(v)
            else: dims.append(s64(v))
        elif fn == 2: dtype = v
        elif fn == 4:
            if wt == 2: floats += list(struct.unpack('<%df' % (len(v) // 4), bytes(v)))
            else: floats.append(struct.unpack('<f', bytes(v))[0])
        elif fn == 5:
            if wt == 2: i32 += packed_varints(v)
            else: i32.append(s64(v))
        elif fn == 6: strings.append(bytes(v))
        elif fn == 7:
            if wt == 2: i64 += packed_varints(v)
            else: i64.append(s64(v))
        elif fn == 8: name = bytes(v).decode()
        elif fn == 9: raw = v
        elif fn == 10:
            if wt == 2: dbl += list(struct.unpack('<%dd' % (len(v) // 8), bytes(v)))
            else: dbl.append(struct.unpack('<d', bytes(v))[0])
        elif fn in (13, 14):
            raise NotImplementedError('external data')
    npdt = DT[dtype]
    if raw is not None:
        arr = np.frombuffer(raw, dtype=npdt).copy()
    elif dtype == 1: arr = np.array(floats, dtype=np.float32)
    elif dtype == 11: arr = np.array(dbl, dtype=np.float64)
    elif dtype == 7: arr = np.array(i64, dtype=np.int64)
    elif dtype == 10: arr = np.array(i32, dtype=np.uint16).view(np.float16)
    elif dtype in (2, 3, 4, 5, 6, 9): arr = np.array(i32).astype(npdt)
    else: raise NotImplementedError('tensor dtype %d' % dtype)
    return name, arr.reshape(dims) if dims else arr.reshape(())

class Node:
    __slots__ = ('op', 'inputs', 'outputs', 'attrs', 'name', 'domain')

class Graph:
    def __init__(self):
        self.nodes = []; self.inits = {}; self.inputs = []; self.outputs = []

def parse_attr(buf):
    name = None; typ = None; val = {}
    for fn, wt, v in fields(buf):
        if fn == 1: name = bytes(v).decode()
        elif fn == 20: typ = v
        elif fn == 2: val['f'] = struct.unpack('<f', bytes(v))[0]
        elif fn == 3: val['i'] = s64(v)
        elif fn == 4: val['s'] = bytes(v).decode(errors='replace')
        elif fn == 5: val['t'] = parse_tensor(v)[1]
        elif fn == 6: val['g'] = parse_graph(v)
        elif fn == 7:
            if wt == 2: val.setdefault('floats', []).extend(struct.unpack('<%df' % (len(v) // 4), bytes(v)))
            else: val.setdefault('floats', []).append(struct.unpack('<f', bytes(v))[0])
        elif fn == 8:
            if wt == 2: val.setdefault('ints', []).extend(packed_varints(v))
            else: val.setdefault('ints', []).append(s64(v))
        elif fn == 9: val.setdefault('strings', []).append(bytes(v).decode(errors='replace'))
        elif fn == 10: val.setdefault('tensors', []).append(parse_tensor(v)[1])
        elif fn == 11: val.setdefault('graphs', []).append(parse_graph(v))
    kind = {1: 'f', 2: 'i', 3: 's', 4: 't', 5: 'g', 6: 'floats', 7: 'ints', 8: 'strings', 9: 'tensors', 10: 'graphs'}.get(typ)
    if kind is None:
        kind = next(iter(val)) if val else None
    if kind in ('floats', 'ints', 'strings', 'tensors', 'graphs'):
        return name, val.get(kind, [])
    return name, val.get(kind)

def parse_graph(buf):
    g = Graph()
    for fn, wt, v in fields(buf):
        if fn == 1:
            n = Node(); n.inputs = []; n.outputs = []; n.attrs = {}; n.name = ''; n.domain = ''; n.op = None
            for f2, w2, v2 in fields(v):
                if f2 == 1: n.inputs.append(bytes(v2).decode())
                elif f2 == 2: n.outputs.append(bytes(v2).decode())
                elif f2 == 3: n.name = bytes(v2).decode()
                elif f2 == 4: n.op = bytes(v2).decode()
                elif f2 == 7: n.domain = bytes(v2).decode()
                elif f2 == 5:
                    k, val = parse_attr(v2); n.attrs[k] = val
            g.nodes.append(n)
        elif fn == 5:
            name, arr = parse_tensor(v); g.inits[name] = arr
        elif fn == 11:
            for f2, w2, v2 in fields(v):
                if f2 == 1: g.inputs.append(bytes(v2).decode())
        elif fn == 12:
            for f2, w2, v2 in fields(v):
                if f2 == 1: g.outputs.append(bytes(v2).decode())
    return g

def load_model(path):
    with open(path, 'rb') as f:
        data = f.read()
    mv = memoryview(data)
    meta = {}; graph = None
    for fn, wt, v in fields(mv):
        if fn == 7: graph = parse_graph(v)
        elif fn == 14:
            kv = {}
            for f2, w2, v2 in fields(v): kv[f2] = bytes(v2).decode(errors='replace')
            meta[kv.get(1)] = kv.get(2)
    return graph, meta

# ---------------------------------------------------------------- ops
def _axis(a, r): return a + r if a < 0 else a

def op_conv(X, W, B, at):
    nsp = X.ndim - 2
    group = at.get('group', 1)
    K = W.shape[2:]
    strides = at.get('strides') or [1] * nsp
    dil = at.get('dilations') or [1] * nsp
    pads = at.get('pads') or [0] * (2 * nsp)
    ap = at.get('auto_pad', 'NOTSET')
    if ap not in (None, 'NOTSET', 'VALID'):
        pads = []
        pb, pe = [], []
        for d in range(nsp):
            L = X.shape[2 + d]; out = -(-L // strides[d]); need = max(0, (out - 1) * strides[d] + (K[d] - 1) * dil[d] + 1 - L)
            if ap == 'SAME_UPPER': pb.append(need // 2); pe.append(need - need // 2)
            else: pe.append(need // 2); pb.append(need - need // 2)
        pads = pb + pe
    padw = [(0, 0), (0, 0)] + [(pads[d], pads[d + nsp]) for d in range(nsp)]
    Xp = np.pad(X, padw) if any(pads) else X
    win = [(K[d] - 1) * dil[d] + 1 for d in range(nsp)]
    v = sliding_window_view(Xp, win, axis=tuple(range(2, 2 + nsp)))
    sl = [slice(None), slice(None)] + [slice(None, None, strides[d]) for d in range(nsp)] + [slice(None, None, dil[d]) for d in range(nsp)]
    v = v[tuple(sl)]  # N, C, *out, *K
    N, C = X.shape[:2]; Cout = W.shape[0]; G = group; Cg = C // G; Og = Cout // G
    outsp = v.shape[2:2 + nsp]
    if G == 1:
        # N, *out, C, *K
        perm = (0,) + tuple(range(2, 2 + nsp)) + (1,) + tuple(range(2 + nsp, 2 + 2 * nsp))
        cols = v.transpose(perm).reshape(N, int(np.prod(outsp)), C * int(np.prod(K)))
        Y = cols @ W.reshape(Cout, -1).T  # N, P, Cout
        Y = Y.transpose(0, 2, 1).reshape((N, Cout) + tuple(outsp))
    else:
        vv = v.reshape((N, G, Cg) + tuple(outsp) + tuple(K))
        Wg = W.reshape((G, Og, Cg) + tuple(K))
        if nsp == 1:
            Y = np.einsum('ngclk,gock->ngol', vv, Wg, optimize=True)
        else:
            Y = np.einsum('ngchwab,gocab->ngohw', vv, Wg, optimize=True)
        Y = Y.reshape((N, Cout) + tuple(outsp))
    if B is not None:
        Y = Y + B.reshape((1, -1) + (1,) * nsp)
    return Y.astype(X.dtype, copy=False)

def op_convtranspose(X, W, B, at):
    nsp = X.ndim - 2
    assert nsp == 1, 'only 1D ConvTranspose'
    group = at.get('group', 1)
    K = W.shape[2]
    s = (at.get('strides') or [1])[0]
    d = (at.get('dilations') or [1])[0]
    pads = at.get('pads') or [0, 0]
    opad = (at.get('output_padding') or [0])[0]
    N, C, L = X.shape; G = group; Cg = C // G; Og = W.shape[1]; Cout = Og * G
    full = s * (L - 1) + (K - 1) * d + 1
    Y = np.zeros((N, G, Og, full + opad), dtype=np.float32)
    Xg = X.reshape(N, G, Cg, L)
    Wg = W.reshape(G, Cg, Og, K)
    for k in range(K):
        contrib = np.einsum('ngcl,gco->ngol', Xg, Wg[:, :, :, k], optimize=True)
        Y[:, :, :, k * d: k * d + s * (L - 1) + 1: s] += contrib
    Y = Y.reshape(N, Cout, full + opad)
    if 'output_shape' in at and at['output_shape']:
        tot = full + opad - at['output_shape'][-1]
        pads = [tot // 2, tot - tot // 2]
    Y = Y[:, :, pads[0]: Y.shape[2] - pads[1]]
    if B is not None: Y = Y + B.reshape(1, -1, 1)
    return Y.astype(np.float32)

def sigmoid(x):
    return (0.5 * (1.0 + np.tanh(0.5 * x))).astype(x.dtype, copy=False)

def op_lstm(ins, at):
    X, W, R = ins[0], ins[1], ins[2]
    B = ins[3] if len(ins) > 3 else None
    seq_lens = ins[4] if len(ins) > 4 else None
    h0 = ins[5] if len(ins) > 5 else None
    c0 = ins[6] if len(ins) > 6 else None
    P = ins[7] if len(ins) > 7 else None
    assert at.get('layout', 0) == 0
    direction = at.get('direction', 'forward')
    H = at['hidden_size']
    T, Bt, _ = X.shape
    nd = W.shape[0]
    clip = at.get('clip')
    acts = at.get('activations')
    assert not acts or [a.lower() for a in acts[:3]] == ['sigmoid', 'tanh', 'tanh']
    assert not at.get('input_forget', 0)
    Ys = np.zeros((T, nd, Bt, H), dtype=np.float32)
    Yh = np.zeros((nd, Bt, H), dtype=np.float32); Yc = np.zeros((nd, Bt, H), dtype=np.float32)
    lens = np.full(Bt, T, dtype=np.int64) if seq_lens is None else seq_lens.astype(np.int64)
    for di in range(nd):
        rev = (direction == 'reverse') or (direction == 'bidirectional' and di == 1)
        Wd, Rd = W[di], R[di]
        bias = (B[di][:4 * H] + B[di][4 * H:]) if B is not None else np.zeros(4 * H, np.float32)
        p = P[di] if P is not None else None
        h = h0[di].copy() if h0 is not None else np.zeros((Bt, H), np.float32)
        c = c0[di].copy() if c0 is not None else np.zeros((Bt, H), np.float32)
        XW = X @ Wd.T + bias  # T, B, 4H
        for b in range(Bt):
            Lb = int(lens[b])
            hb = h[b:b + 1]; cb = c[b:b + 1]
            order = range(Lb - 1, -1, -1) if rev else range(Lb)
            for t in order:
                g = XW[t, b:b + 1] + hb @ Rd.T
                if clip: g = np.clip(g, -clip, clip)
                gi, go, gf, gc = g[:, :H], g[:, H:2 * H], g[:, 2 * H:3 * H], g[:, 3 * H:]
                if p is not None:
                    gi = gi + p[:H] * cb; gf = gf + p[2 * H:] * cb
                i_ = sigmoid(gi); f_ = sigmoid(gf); ct = np.tanh(gc)
                cb = f_ * cb + i_ * ct
                if p is not None: go = go + p[H:2 * H] * cb
                o_ = sigmoid(go)
                hb = o_ * np.tanh(cb)
                Ys[t, di, b] = hb[0]
            Yh[di, b] = hb[0]; Yc[di, b] = cb[0]
    return [Ys, Yh, Yc]

def op_resize(X, roi, scales, sizes, at):
    mode = at.get('mode', 'nearest')
    ctm = at.get('coordinate_transformation_mode', 'half_pixel')
    nm = at.get('nearest_mode', 'round_prefer_floor')
    r = X.ndim
    if sizes is not None and sizes.size:
        out_shape = [int(v) for v in sizes]
        sc = [out_shape[i] / X.shape[i] for i in range(r)]
    else:
        sc = [float(v) for v in scales]
        out_shape = [int(math.floor(X.shape[i] * sc[i])) for i in range(r)]
    Y = X
    for ax in range(r):
        inL = X.shape[ax]; outL = out_shape[ax]
        if inL == outL and sc[ax] == 1.0: continue
        o = np.arange(outL, dtype=np.float64)
        s = sc[ax]
        if ctm == 'asymmetric': xo = o / s
        elif ctm == 'half_pixel': xo = (o + 0.5) / s - 0.5
        elif ctm == 'pytorch_half_pixel': xo = (o + 0.5) / s - 0.5 if outL > 1 else np.zeros_like(o)
        elif ctm == 'align_corners': xo = o * (inL - 1) / (outL - 1) if outL > 1 else np.zeros_like(o)
        elif ctm == 'tf_half_pixel_for_nn': xo = (o + 0.5) / s
        else: raise NotImplementedError(ctm)
        if mode == 'nearest':
            if nm == 'floor': idx = np.floor(xo)
            elif nm == 'ceil': idx = np.ceil(xo)
            elif nm == 'round_prefer_ceil': idx = np.floor(xo + 0.5)
            else: idx = np.ceil(xo - 0.5)
            idx = np.clip(idx, 0, inL - 1).astype(np.int64)
            Y = np.take(Y, idx, axis=ax)
        elif mode == 'linear':
            xo = np.clip(xo, 0, inL - 1)
            i0 = np.floor(xo).astype(np.int64); i1 = np.minimum(i0 + 1, inL - 1); w = (xo - i0).astype(np.float32)
            shp = [1] * r; shp[ax] = outL; w = w.reshape(shp)
            Y = np.take(Y, i0, axis=ax) * (1 - w) + np.take(Y, i1, axis=ax) * w
        else: raise NotImplementedError(mode)
    return Y.astype(X.dtype, copy=False)

def op_slice(data, starts, ends, axes, steps):
    r = data.ndim
    axes = list(range(len(starts))) if axes is None else [_axis(int(a), r) for a in axes]
    steps = [1] * len(starts) if steps is None else [int(s) for s in steps]
    sl = [slice(None)] * r
    for st, en, ax, sp in zip(starts, ends, axes, steps):
        st = int(st); en = int(en); dim = data.shape[ax]
        if st < 0: st += dim
        if en < 0: en += dim
        if sp > 0:
            st = min(max(st, 0), dim); en = min(max(en, 0), dim)
            sl[ax] = slice(st, en, sp)
        else:
            st = min(max(st, -1), dim - 1); en = min(max(en, -1), dim - 1)
            sl[ax] = slice(st, en if en >= 0 else None, sp) if st >= 0 else slice(0, 0)
    return data[tuple(sl)]

def int_div(a, b):
    q = np.abs(a) // np.abs(b)
    return (q * np.sign(a) * np.sign(b)).astype(a.dtype)

class Runner:
    def __init__(self, graph, seed=0):
        self.g = graph
        self.rng = np.random.default_rng(seed)

    def run(self, feeds):
        return self.run_graph(self.g, feeds, {}, top=True)

    def run_graph(self, g, feeds, outer, top=False):
        env = dict(g.inits); env.update(feeds)
        # last use for freeing (top-level only)
        last = {}
        if top:
            for i, n in enumerate(g.nodes):
                for x in n.inputs: last[x] = i
                for a in n.attrs.values():
                    if isinstance(a, Graph): self._mark_sub(a, i, last)
                    elif isinstance(a, list) and a and isinstance(a[0], Graph):
                        for sg in a: self._mark_sub(sg, i, last)
            for o in g.outputs: last[o] = 10 ** 9
        def get(name):
            if name == '': return None
            if name in env: return env[name]
            return outer[name]
        for i, n in enumerate(g.nodes):
            ins = [get(x) for x in n.inputs]
            try:
                outs = self.exec(n, ins, env, outer)
            except Exception as e:
                shapes = [None if v is None else (getattr(v, 'shape', type(v).__name__), getattr(v, 'dtype', '')) for v in ins]
                raise RuntimeError(f'node {i} {n.op} {n.name} inputs {n.inputs} shapes {shapes}: {e}') from e
            if not isinstance(outs, (list, tuple)): outs = [outs]
            for name, val in zip(n.outputs, outs):
                if name: env[name] = val
            if top:
                for x in n.inputs:
                    if x and last.get(x) == i and x not in g.inits: env.pop(x, None)
        return {o: get(o) for o in g.outputs}

    def _mark_sub(self, sg, i, last):
        for n in sg.nodes:
            for x in n.inputs: last[x] = max(last.get(x, -1), i)
            for a in n.attrs.values():
                if isinstance(a, Graph): self._mark_sub(a, i, last)
                elif isinstance(a, list) and a and isinstance(a[0], Graph):
                    for s2 in a: self._mark_sub(s2, i, last)
        for o in sg.outputs: last[o] = max(last.get(o, -1), i)

    def exec(self, n, ins, env, outer):
        op = n.op; at = n.attrs
        f = getattr(self, 'op_' + op, None)
        if f is None: raise NotImplementedError(op)
        return f(ins, at, env, outer)

    # elementwise / simple
    def op_Constant(self, ins, at, env, outer):
        if 'value' in at: return at['value']
        if 'value_float' in at: return np.array(at['value_float'], np.float32)
        if 'value_floats' in at: return np.array(at['value_floats'], np.float32)
        if 'value_int' in at: return np.array(at['value_int'], np.int64)
        if 'value_ints' in at: return np.array(at['value_ints'], np.int64)
        raise NotImplementedError('Constant attr ' + str(list(at)))
    def op_Identity(self, ins, at, e, o): return ins[0]
    def op_Add(self, ins, at, e, o): return np.add(ins[0], ins[1])
    def op_Sub(self, ins, at, e, o): return np.subtract(ins[0], ins[1])
    def op_Mul(self, ins, at, e, o): return np.multiply(ins[0], ins[1])
    def op_Div(self, ins, at, e, o):
        a, b = ins
        if np.issubdtype(np.asarray(a).dtype, np.integer): return int_div(np.asarray(a), np.asarray(b))
        return np.divide(a, b)
    def op_Pow(self, ins, at, e, o):
        a, b = ins
        r = np.power(a.astype(np.float64) if a.dtype != np.float64 else a, b)
        return r.astype(a.dtype)
    def op_Sqrt(self, ins, at, e, o): return np.sqrt(ins[0])
    def op_Reciprocal(self, ins, at, e, o): return (1.0 / ins[0]).astype(ins[0].dtype)
    def op_Sin(self, ins, at, e, o): return np.sin(ins[0])
    def op_Cos(self, ins, at, e, o): return np.cos(ins[0])
    def op_Atan(self, ins, at, e, o): return np.arctan(ins[0])
    def op_Exp(self, ins, at, e, o): return np.exp(ins[0])
    def op_Tanh(self, ins, at, e, o): return np.tanh(ins[0])
    def op_Sigmoid(self, ins, at, e, o): return sigmoid(ins[0])
    def op_Floor(self, ins, at, e, o): return np.floor(ins[0])
    def op_Round(self, ins, at, e, o): return np.round(ins[0])
    def op_LeakyRelu(self, ins, at, e, o):
        a = at.get('alpha', 0.01); x = ins[0]
        return np.where(x >= 0, x, x * np.float32(a)).astype(x.dtype)
    def op_Clip(self, ins, at, e, o):
        x = ins[0]
        lo = ins[1] if len(ins) > 1 and ins[1] is not None else at.get('min')
        hi = ins[2] if len(ins) > 2 and ins[2] is not None else at.get('max')
        if lo is not None: x = np.maximum(x, lo)
        if hi is not None: x = np.minimum(x, hi)
        return x.astype(ins[0].dtype)
    def op_Equal(self, ins, at, e, o): return np.equal(ins[0], ins[1])
    def op_Greater(self, ins, at, e, o): return np.greater(ins[0], ins[1])
    def op_Less(self, ins, at, e, o): return np.less(ins[0], ins[1])
    def op_GreaterOrEqual(self, ins, at, e, o): return np.greater_equal(ins[0], ins[1])
    def op_And(self, ins, at, e, o): return np.logical_and(ins[0], ins[1])
    def op_Not(self, ins, at, e, o): return np.logical_not(ins[0])
    def op_Where(self, ins, at, e, o): return np.where(ins[0], ins[1], ins[2])
    def op_Cast(self, ins, at, e, o):
        dt = DT[at['to']]
        x = np.asarray(ins[0])
        if dt == np.bool_: return x != 0
        return x.astype(dt)
    # shape ops
    def op_Shape(self, ins, at, e, o):
        s = np.array(ins[0].shape, dtype=np.int64)
        st = at.get('start', 0); en = at.get('end')
        return s[st:en] if en is not None else s[st:]
    def op_Reshape(self, ins, at, e, o):
        x, shp = ins
        shp = [int(v) for v in shp]
        if not at.get('allowzero', 0):
            shp = [x.shape[i] if v == 0 else v for i, v in enumerate(shp)]
        return x.reshape(shp)
    def op_Flatten(self, ins, at, e, o):
        x = ins[0]; ax = _axis(at.get('axis', 1), x.ndim)
        return x.reshape(int(np.prod(x.shape[:ax])), -1)
    def op_Unsqueeze(self, ins, at, e, o):
        x = ins[0]
        axes = [int(a) for a in (ins[1] if len(ins) > 1 and ins[1] is not None else at['axes'])]
        r = x.ndim + len(axes)
        axes = sorted(_axis(a, r) for a in axes)
        for a in axes: x = np.expand_dims(x, a)
        return x
    def op_Squeeze(self, ins, at, e, o):
        x = ins[0]
        axes = ins[1] if len(ins) > 1 and ins[1] is not None else at.get('axes')
        if axes is None: return np.squeeze(x)
        return np.squeeze(x, axis=tuple(_axis(int(a), x.ndim) for a in axes))
    def op_Transpose(self, ins, at, e, o):
        p = at.get('perm')
        return np.transpose(ins[0], p) if p else np.transpose(ins[0])
    def op_Concat(self, ins, at, e, o):
        xs = [np.asarray(x) for x in ins if x is not None]
        return np.concatenate(xs, axis=at['axis'])
    def op_Gather(self, ins, at, e, o):
        x, idx = ins; ax = _axis(at.get('axis', 0), x.ndim)
        idx = np.asarray(idx).astype(np.int64)
        idx = np.where(idx < 0, idx + x.shape[ax], idx)
        return np.take(x, idx, axis=ax)
    def op_GatherElements(self, ins, at, e, o):
        x, idx = ins; ax = _axis(at.get('axis', 0), x.ndim)
        idx = np.where(idx < 0, idx + x.shape[ax], idx).astype(np.int64)
        return np.take_along_axis(x, idx, axis=ax)
    def op_Slice(self, ins, at, e, o):
        data = ins[0]
        if len(ins) >= 3:
            return op_slice(data, ins[1], ins[2], ins[3] if len(ins) > 3 else None, ins[4] if len(ins) > 4 else None)
        return op_slice(data, at['starts'], at['ends'], at.get('axes'), None)
    def op_Expand(self, ins, at, e, o):
        x, shp = ins
        out = np.broadcast_shapes(x.shape, tuple(int(v) for v in shp))
        return np.broadcast_to(x, out).copy()
    def op_ConstantOfShape(self, ins, at, e, o):
        v = at.get('value')
        shp = tuple(int(s) for s in ins[0])
        if v is None: return np.zeros(shp, np.float32)
        return np.full(shp, v.reshape(-1)[0], dtype=v.dtype)
    def op_Range(self, ins, at, e, o):
        s, l, d = [np.asarray(v).reshape(()) for v in ins]
        n = max(int(math.ceil((float(l) - float(s)) / float(d))), 0)
        return (s + np.arange(n, dtype=s.dtype) * d).astype(s.dtype)
    def op_Pad(self, ins, at, e, o):
        x = ins[0]
        pads = [int(v) for v in (ins[1] if len(ins) > 1 and ins[1] is not None else at['pads'])]
        cv = ins[2] if len(ins) > 2 and ins[2] is not None else np.array(at.get('value', 0.0))
        mode = at.get('mode', 'constant')
        r = x.ndim
        # handle negative pads (crop)
        sl = []
        pw = []
        for i in range(r):
            b, e2 = pads[i], pads[i + r]
            sl.append(slice(-b if b < 0 else 0, x.shape[i] + e2 if e2 < 0 else None))
            pw.append((max(b, 0), max(e2, 0)))
        x = x[tuple(sl)]
        if mode == 'constant': return np.pad(x, pw, mode='constant', constant_values=np.asarray(cv).reshape(-1)[0] if np.asarray(cv).size else 0)
        if mode == 'reflect': return np.pad(x, pw, mode='reflect')
        if mode == 'edge': return np.pad(x, pw, mode='edge')
        raise NotImplementedError(mode)
    # reductions
    def _red(self, f, ins, at, axes_from_input=False):
        x = ins[0]
        if axes_from_input:
            axes = ins[1] if len(ins) > 1 and ins[1] is not None else None
            if axes is not None and np.asarray(axes).size == 0: axes = None
            if axes is None and at.get('noop_with_empty_axes', 0): return x
        else:
            axes = at.get('axes')
        kd = bool(at.get('keepdims', 1))
        ax = None if axes is None else tuple(_axis(int(a), x.ndim) for a in axes)
        return f(x, axis=ax, keepdims=kd)
    def op_ReduceMean(self, ins, at, e, o):
        if len(ins) > 1: return self._red(np.mean, ins, at, True).astype(ins[0].dtype)
        return self._red(np.mean, ins, at).astype(ins[0].dtype)
    def op_ReduceMax(self, ins, at, e, o): return self._red(np.max, ins, at, len(ins) > 1)
    def op_ReduceProd(self, ins, at, e, o): return self._red(np.prod, ins, at, len(ins) > 1).astype(ins[0].dtype)
    def op_ReduceSum(self, ins, at, e, o): return self._red(np.sum, ins, at, True).astype(ins[0].dtype)
    def op_CumSum(self, ins, at, e, o):
        x, ax = ins; ax = _axis(int(np.asarray(ax).reshape(-1)[0]), x.ndim)
        rev = at.get('reverse', 0); exc = at.get('exclusive', 0)
        y = np.flip(x, ax) if rev else x
        c = np.cumsum(y, axis=ax, dtype=x.dtype)
        if exc:
            c = c - y
        return np.flip(c, ax) if rev else c
    def op_Softmax(self, ins, at, e, o):
        x = ins[0]; ax = at.get('axis', -1)
        m = np.max(x, axis=ax, keepdims=True); ex = np.exp(x - m)
        return (ex / np.sum(ex, axis=ax, keepdims=True)).astype(x.dtype)
    def op_TopK(self, ins, at, e, o):
        x, k = ins; k = int(np.asarray(k).reshape(-1)[0]); ax = _axis(at.get('axis', -1), x.ndim)
        largest = at.get('largest', 1)
        key = -x if largest else x
        idx = np.argsort(key, axis=ax, kind='stable')
        idx = np.take(idx, np.arange(k), axis=ax)
        return [np.take_along_axis(x, idx, axis=ax), idx.astype(np.int64)]
    # linear algebra / nn
    def op_MatMul(self, ins, at, e, o): return np.matmul(ins[0], ins[1])
    def op_Gemm(self, ins, at, e, o):
        A, B = ins[0], ins[1]; C = ins[2] if len(ins) > 2 else None
        if at.get('transA', 0): A = A.T
        if at.get('transB', 0): B = B.T
        Y = at.get('alpha', 1.0) * (A @ B)
        if C is not None: Y = Y + at.get('beta', 1.0) * C
        return Y.astype(np.float32)
    def op_Conv(self, ins, at, e, o): return op_conv(ins[0], ins[1], ins[2] if len(ins) > 2 else None, at)
    def op_ConvTranspose(self, ins, at, e, o): return op_convtranspose(ins[0], ins[1], ins[2] if len(ins) > 2 else None, at)
    def op_InstanceNormalization(self, ins, at, e, o):
        x, sc, b = ins; eps = at.get('epsilon', 1e-5)
        ax = tuple(range(2, x.ndim))
        m = x.mean(axis=ax, keepdims=True); v = ((x - m) ** 2).mean(axis=ax, keepdims=True)
        shp = (1, -1) + (1,) * (x.ndim - 2)
        return ((x - m) / np.sqrt(v + eps) * sc.reshape(shp) + b.reshape(shp)).astype(x.dtype)
    def op_LSTM(self, ins, at, e, o): return op_lstm(ins, at)
    def op_Resize(self, ins, at, e, o):
        return op_resize(ins[0], ins[1] if len(ins) > 1 else None, ins[2] if len(ins) > 2 else None, ins[3] if len(ins) > 3 else None, at)
    def op_ScatterND(self, ins, at, e, o):
        data, idx, upd = ins
        assert at.get('reduction', 'none') == 'none'
        out = data.copy(); k = idx.shape[-1]
        idx2 = idx.reshape(-1, k)
        upd2 = upd.reshape((-1,) + data.shape[k:])
        for j in range(idx2.shape[0]):
            out[tuple(idx2[j])] = upd2[j]
        return out
    def op_ScatterElements(self, ins, at, e, o):
        data, idx, upd = ins; ax = _axis(at.get('axis', 0), data.ndim)
        assert at.get('reduction', 'none') == 'none'
        out = data.copy()
        idx = np.where(idx < 0, idx + data.shape[ax], idx)
        np.put_along_axis(out, idx, upd, axis=ax)
        return out
    def op_RandomNormalLike(self, ins, at, e, o):
        x = ins[0]
        dt = DT[at['dtype']] if 'dtype' in at else x.dtype
        return self.rng.normal(at.get('mean', 0.0), at.get('scale', 1.0), size=x.shape).astype(dt)
    def op_RandomUniformLike(self, ins, at, e, o):
        x = ins[0]
        dt = DT[at['dtype']] if 'dtype' in at else x.dtype
        return self.rng.uniform(at.get('low', 0.0), at.get('high', 1.0), size=x.shape).astype(dt)
    # sequences / control flow
    def op_SequenceEmpty(self, ins, at, e, o): return [[]]
    def op_SequenceInsert(self, ins, at, e, o):
        seq = list(ins[0]); t = ins[1]
        if len(ins) > 2 and ins[2] is not None:
            p = int(np.asarray(ins[2]).reshape(-1)[0]); seq.insert(p if p >= 0 else p + len(seq), t)
        else: seq.append(t)
        return [seq]
    def op_SequenceAt(self, ins, at, e, o):
        p = int(np.asarray(ins[1]).reshape(-1)[0]); return ins[0][p]
    def op_SplitToSequence(self, ins, at, e, o):
        x = ins[0]; ax = _axis(at.get('axis', 0), x.ndim); kd = at.get('keepdims', 1)
        split = ins[1] if len(ins) > 1 else None
        if split is None:
            parts = [np.take(x, [i], axis=ax) for i in range(x.shape[ax])]
            if not kd: parts = [np.squeeze(p, ax) for p in parts]
            return [parts]
        split = np.asarray(split)
        if split.ndim == 0:
            n = int(split); idx = list(range(n, x.shape[ax], n))
        else:
            idx = list(np.cumsum(split)[:-1])
        return [list(np.split(x, idx, axis=ax))]
    def op_ConcatFromSequence(self, ins, at, e, o):
        seq = ins[0]; ax = at['axis']
        if at.get('new_axis', 0): return np.stack(seq, axis=ax)
        return np.concatenate(seq, axis=ax)
    def op_If(self, ins, at, env, outer):
        cond = bool(np.asarray(ins[0]).reshape(-1)[0])
        g = at['then_branch'] if cond else at['else_branch']
        scope = ChainMap(env, outer)
        res = self.run_graph(g, {}, scope)
        return [res[k] for k in g.outputs]
    def op_Loop(self, ins, at, env, outer):
        body = at['body']
        M = ins[0]; cond = ins[1]; carried = list(ins[2:])
        M = None if M is None else int(np.asarray(M).reshape(-1)[0])
        c = True if cond is None else bool(np.asarray(cond).reshape(-1)[0])
        scope = ChainMap(env, outer)
        nc = len(carried); scans = None
        i = 0
        while (M is None or i < M) and c:
            feeds = {body.inputs[0]: np.array(i, np.int64), body.inputs[1]: np.array(c)}
            for k in range(nc): feeds[body.inputs[2 + k]] = carried[k]
            res = self.run_graph(body, feeds, scope)
            outs = [res[k] for k in body.outputs]
            c = bool(np.asarray(outs[0]).reshape(-1)[0])
            carried = outs[1:1 + nc]
            sc = outs[1 + nc:]
            if scans is None: scans = [[] for _ in sc]
            for k, v in enumerate(sc): scans[k].append(v)
            i += 1
        nscan = len(body.outputs) - 1 - nc
        if scans is None: scans = [[] for _ in range(nscan)]
        return carried + [np.stack(s) if s else np.zeros((0,), np.float32) for s in scans]
