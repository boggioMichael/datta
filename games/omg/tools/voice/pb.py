# Minimal protobuf wire-format reader for ONNX ModelProto (no external deps).
import struct

def read_varint(b, i):
    shift = 0; result = 0
    while True:
        c = b[i]; i += 1
        result |= (c & 0x7f) << shift
        if not (c & 0x80): return result, i
        shift += 7

def fields(b, start=0, end=None):
    """Yield (field_number, wire_type, value) where value is int or memoryview slice."""
    i = start; end = len(b) if end is None else end
    while i < end:
        key, i = read_varint(b, i)
        fn, wt = key >> 3, key & 7
        if wt == 0:
            v, i = read_varint(b, i); yield fn, wt, v
        elif wt == 1:
            yield fn, wt, b[i:i+8]; i += 8
        elif wt == 2:
            ln, i = read_varint(b, i); yield fn, wt, b[i:i+ln]; i += ln
        elif wt == 5:
            yield fn, wt, b[i:i+4]; i += 4
        else:
            raise ValueError(f"wire type {wt} at {i}")
