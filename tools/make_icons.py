"""Draw the app icons (icons/icon-192.png, icons/icon-512.png) with the standard library only.

The design matches icons/icon.svg: a mint briefcase with a violet clasp on dark navy.
Run once: python tools/make_icons.py
"""

import struct
import zlib
from pathlib import Path

BG = (0x09, 0x0D, 0x1A)
FG = (0x3E, 0xE6, 0xA8)
CLASP = (0x8B, 0x7B, 0xFF)


def pixel(x, y):
    """Colour at (x, y) in a 64x64 design space (floats)."""
    if 28 <= x <= 36 and 27 <= y <= 37:          # clasp
        return CLASP
    if 8 <= x <= 56 and 30 <= y <= 34:           # seam
        return BG
    if 8 <= x <= 56 and 18 <= y <= 52:           # body
        return FG
    handle_outer = 22 <= x <= 42 and 10 <= y <= 20
    handle_inner = 26 <= x <= 38 and 14 <= y <= 20
    if handle_outer and not handle_inner:        # handle
        return FG
    return BG


def png(size):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            row += bytes(pixel((px + .5) * 64 / size, (py + .5) * 64 / size))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", raw) + chunk(b"IEND", b""))


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "icons"
    for size in (192, 512):
        (out / f"icon-{size}.png").write_bytes(png(size))
        print(f"wrote icons/icon-{size}.png")
