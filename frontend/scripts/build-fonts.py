#!/usr/bin/env python3
"""Builds the committed document fonts (DD-P10-09, DD-P10-10). Not part of the build: run it only to change a font.

Usage: build-fonts.py <node_modules with @expo-google-fonts/{roboto@0.4.3,ibm-plex-sans@0.4.1,pt-serif@0.4.1}> <output dir>
Needs fonttools (4.68.0 was used). Only hinting is dropped: advances, kerning and ligatures stay, so metrics do not change.
"""
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FAMILIES = {
    'roboto': ('roboto', 'Roboto'),
    'ibm-plex-sans': ('ibm-plex-sans', 'IBMPlexSans'),
    'pt-serif': ('pt-serif', 'PTSerif'),
}
FACES = {'regular': '400Regular', 'italic': '400Regular_Italic', 'bold': '700Bold', 'bold-italic': '700Bold_Italic'}
# Latin, Latin Extended, Greek, Cyrillic, punctuation, currency, letterlike signs, arrows (NFR-07).
UNICODES = '0020-007E,00A0-024F,0370-03FF,0400-052F,1E00-1EFF,2000-206F,20A0-20BF,2100-214F,2190-2193,25A0,25AA,25CF,FB00-FB04'
FEATURES = 'kern,liga,mark,mkmk,ccmp,locl,rlig,calt,clig'


def main(source: Path, output: Path):
    for family, (package, stem) in FAMILIES.items():
        target = output / family
        target.mkdir(parents=True, exist_ok=True)
        root = source / '@expo-google-fonts' / package
        shutil.copy(root / 'LICENSE_FONT', target / 'OFL.txt')
        for face, weight in FACES.items():
            font = TTFont(root / weight / f'{stem}_{weight}.ttf')
            options = subset.Options(hinting=False, layout_features=FEATURES.split(','), name_IDs=[0, 1, 2, 3, 4, 5, 6, 13, 14], notdef_outline=True, glyph_names=False)
            subsetter = subset.Subsetter(options)
            subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
            subsetter.subset(font)
            # A fixed timestamp keeps the output reproducible.
            font['head'].modified = font['head'].created
            font.recalcTimestamp = False
            font.save(target / f'{face}.ttf')


if __name__ == '__main__':
    main(Path(sys.argv[1]), Path(sys.argv[2]))
