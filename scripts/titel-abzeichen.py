#!/usr/bin/env python3
"""Stellt die gemalten Titel-Abzeichen kreisrund frei (transparente Ecken) und legt sie unter
web/public/titel/<Titel-ID>.png ab.

Aufruf aus dem Projektordner: python3 scripts/titel-abzeichen.py <Ordner mit den Quell-PNGs>
Quelle: quadratische PNGs, Medaillon mittig, Ecken außerhalb des Kreises (fast) schwarz.
Die Abzeichen stammen aus einem Bildgenerator. Braucht Pillow.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ZIEL = Path(__file__).resolve().parent.parent / "web" / "public" / "titel"
GROESSE = 192
UEBERABTASTUNG = 4
# Ein Pixel nach innen, damit kein dunkler Saum vom Hintergrund bleibt.
EINZUG = 1

# Dateiname der Quelle auf die Titel-ID im Code (src/weekly/titles.ts).
TITEL = {
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


def kreis(bild: Image.Image) -> tuple[int, int, int, int]:
    """Begrenzung des Medaillons: alle Pixel, die deutlich heller als der schwarze Hintergrund sind."""
    hell = bild.convert("L").point(lambda v: 255 if v > 40 else 0)
    box = hell.getbbox()
    if box is None:
        raise ValueError("kein Medaillon gefunden")
    return box


def freistellen(bild: Image.Image) -> Image.Image:
    links, oben, rechts, unten = kreis(bild)
    seite = max(rechts - links, unten - oben)
    mitte_x, mitte_y = (links + rechts) / 2, (oben + unten) / 2
    halb = seite / 2
    ausschnitt = bild.convert("RGBA").crop(
        (round(mitte_x - halb), round(mitte_y - halb), round(mitte_x + halb), round(mitte_y + halb))
    )
    ausschnitt = ausschnitt.resize((GROESSE, GROESSE), Image.LANCZOS)
    gross = GROESSE * UEBERABTASTUNG
    maske = Image.new("L", (gross, gross), 0)
    rand = EINZUG * UEBERABTASTUNG
    ImageDraw.Draw(maske).ellipse((rand, rand, gross - 1 - rand, gross - 1 - rand), fill=255)
    ausschnitt.putalpha(maske.resize((GROESSE, GROESSE), Image.LANCZOS))
    return ausschnitt


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Aufruf: python3 scripts/titel-abzeichen.py <Ordner mit den Quell-PNGs>")
    quelle = Path(sys.argv[1])
    ZIEL.mkdir(parents=True, exist_ok=True)
    for datei, titel_id in TITEL.items():
        pfad = quelle / f"{datei}.png"
        if not pfad.exists():
            print(f"fehlt: {pfad}")
            continue
        ergebnis = freistellen(Image.open(pfad))
        ergebnis.save(ZIEL / f"{titel_id}.png", optimize=True)
        print(f"{titel_id}.png  ({ergebnis.width} x {ergebnis.height})")


if __name__ == "__main__":
    main()
