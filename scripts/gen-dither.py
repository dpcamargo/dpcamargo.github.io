#!/usr/bin/env python3
"""Generate static/images/dither.png: an alpha mask of dithered blobs.

The site paints it as a CSS mask over a --dither-ink colour, so one image
recolours per palette. Standard library only; the output is deterministic.

    python3 scripts/gen-dither.py [output.png]
"""
import random
import struct
import sys
import zlib

WIDTH, HEIGHT = 480, 270   # CSS draws it at 4x or more with image-rendering: pixelated
CELL = 96                  # size of the biggest blobs, in pixels
OCTAVES = 3
SEED = 7

# 8x8 Bayer matrix: the classic ordered-dither threshold pattern
BAYER = [
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
]


def smoothstep(t):
    return t * t * (3 - 2 * t)


def value_noise(rng, width, height, cell):
    """One octave of smooth random values in 0..1."""
    grid_w, grid_h = width // cell + 2, height // cell + 2
    grid = [[rng.random() for _ in range(grid_w)] for _ in range(grid_h)]
    rows = []
    for y in range(height):
        gy, fy = divmod(y / cell, 1)
        gy = int(gy)
        fy = smoothstep(fy)
        row = []
        for x in range(width):
            gx, fx = divmod(x / cell, 1)
            gx = int(gx)
            fx = smoothstep(fx)
            top = grid[gy][gx] * (1 - fx) + grid[gy][gx + 1] * fx
            bottom = grid[gy + 1][gx] * (1 - fx) + grid[gy + 1][gx + 1] * fx
            row.append(top * (1 - fy) + bottom * fy)
        rows.append(row)
    return rows


def field(rng):
    """Several octaves of noise summed into one 0..1 field."""
    total = [[0.0] * WIDTH for _ in range(HEIGHT)]
    amplitude, norm = 1.0, 0.0
    for octave in range(OCTAVES):
        layer = value_noise(rng, WIDTH, HEIGHT, max(4, CELL // (2 ** octave)))
        for y in range(HEIGHT):
            for x in range(WIDTH):
                total[y][x] += layer[y][x] * amplitude
        norm += amplitude
        amplitude /= 2
    return [[value / norm for value in row] for row in total]


def png_chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, rows):
    """Grey+alpha PNG: black pixels, alpha 255 where a dot is drawn."""
    raw = b"".join(b"\x00" + b"".join(b"\x00\xff" if on else b"\x00\x00" for on in row) for row in rows)
    with open(path, "wb") as out:
        out.write(b"\x89PNG\r\n\x1a\n")
        out.write(png_chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 4, 0, 0, 0)))
        out.write(png_chunk(b"IDAT", zlib.compress(raw, 9)))
        out.write(png_chunk(b"IEND", b""))


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "static/images/dither.png"
    noise = field(random.Random(SEED))
    rows = []
    for y in range(HEIGHT):
        row = []
        for x in range(WIDTH):
            # Stretch the middle of the noise range so blobs have a solid core and a fading, dithered edge
            density = min(1.0, max(0.0, (noise[y][x] - 0.42) / 0.22))
            row.append(density > (BAYER[y % 8][x % 8] + 0.5) / 64)
        rows.append(row)
    write_png(path, rows)
    filled = sum(map(sum, rows)) / (WIDTH * HEIGHT)
    print(f"wrote {path}: {WIDTH}x{HEIGHT}, {filled:.0%} filled")


if __name__ == "__main__":
    main()
