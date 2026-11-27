#!/usr/bin/env python3
"""Crops the painted title badges to a circle (transparent corners) and stores them as
web/public/titel/<title id>.png.

Run from the project folder: python3 scripts/title-badges.py <folder with the source PNGs>
Source: square PNGs, medallion centered, corners outside the circle (almost) black.
The badges come from an image generator. Requires Pillow.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

TARGET = Path(__file__).resolve().parent.parent / "web" / "public" / "titel"
SIZE = 192
SUPERSAMPLING = 4
# One pixel inwards so no dark fringe from the background remains.
INSET = 1

# Source file name to the title id in the code (src/weekly/titles.ts).
TITLES = {
    "nachteule": "nachteule",
    "frueher-vogel": "frueher-vogel",
    "stammgast": "stammgast",
    "dauerlaeufer": "dauerlaeufer",
    "pechvogel": "pechvogel",
    "schaffe-schaffe": "schaffe-schaffe",
    "kellerkind": "kellerkind",
    "kaepsele": "kaepsele",
    "schleimer-vom-dienst": "schleimer",
    "verlorener-sohn": "verlorener-sohn",
    "tausendsassa": "tausendsassa",
    "frisch-eingekleidet": "frisch-eingekleidet",
}


def circle_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    """Bounds of the medallion: all pixels clearly brighter than the black background."""
    bright = image.convert("L").point(lambda v: 255 if v > 40 else 0)
    box = bright.getbbox()
    if box is None:
        raise ValueError("no medallion found")
    return box


def crop_circle(image: Image.Image) -> Image.Image:
    left, top, right, bottom = circle_bounds(image)
    side = max(right - left, bottom - top)
    center_x, center_y = (left + right) / 2, (top + bottom) / 2
    half = side / 2
    cutout = image.convert("RGBA").crop(
        (round(center_x - half), round(center_y - half), round(center_x + half), round(center_y + half))
    )
    cutout = cutout.resize((SIZE, SIZE), Image.LANCZOS)
    large = SIZE * SUPERSAMPLING
    mask = Image.new("L", (large, large), 0)
    margin = INSET * SUPERSAMPLING
    ImageDraw.Draw(mask).ellipse((margin, margin, large - 1 - margin, large - 1 - margin), fill=255)
    cutout.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
    return cutout


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python3 scripts/title-badges.py <folder with the source PNGs>")
    source = Path(sys.argv[1])
    TARGET.mkdir(parents=True, exist_ok=True)
    for file_name, title_id in TITLES.items():
        path = source / f"{file_name}.png"
        if not path.exists():
            print(f"missing: {path}")
            continue
        result = crop_circle(Image.open(path))
        result.save(TARGET / f"{title_id}.png", optimize=True)
        print(f"{title_id}.png  ({result.width} x {result.height})")


if __name__ == "__main__":
    main()
