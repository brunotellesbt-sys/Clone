"""Build paintable 2D layers for the 17 aircraft absent from the APK's layer set.

The masks use the regenerated, gear-up sprites. Optional livery shapes are
reprojected from the A320 layer art supplied in apk_contents.zip (and already
present byte-for-byte in public/aircraft2d). This keeps the same paint system
and patterns as the imported models instead of drawing a generic SVG stripe.

Requires Pillow, NumPy and SciPy, as do the existing skyline mask scripts.
Run from the repository root after replacing the 17 source sprites.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path('.claude/skills/skyline-mask-audit/scripts').resolve()))
import maskcore as mc

ROOT = Path('public')
SPRITES = ROOT / 'sprites'
OUT = ROOT / 'aircraft2d'
DEFAULT_SIZE = (1536, 1024)
PASSENGERS = ['an148', 'an158', 'il96', 'sj100', 'tu204']
FREIGHTERS = ['atr72f', 'b737f', 'a321f', 'b752f', 'tu204f', 'b763f',
              'a332f', 'il96f', 'b748f', 'an124', 'an225', 'belugaxl']
IDS = PASSENGERS + FREIGHTERS

# Nacelles visible on the near wing, in final 1536x1024 sprite pixels.
# These bounds are intentionally conservative: the photo finish retains the
# nacelle rims while the color mask stays off the wing and cargo door.
ENGINES = {
    'an148': [(415, 478, 635, 618)], 'an158': [(410, 472, 635, 603)],
    'il96': [(465, 520, 630, 600), (590, 522, 755, 605)],
    'sj100': [(495, 585, 730, 705)], 'tu204': [(505, 534, 710, 638)],
    'atr72f': [(515, 480, 805, 575)],
    'b737f': [(460, 515, 665, 665)], 'a321f': [(525, 520, 720, 635)],
    'b752f': [(510, 520, 710, 650)], 'tu204f': [(510, 515, 715, 645)],
    'b763f': [(525, 515, 740, 640)], 'a332f': [(520, 540, 740, 680)],
    'il96f': [(470, 510, 625, 620), (600, 510, 765, 620)],
    'b748f': [(510, 530, 700, 665), (730, 520, 900, 645)],
    'an124': [(485, 500, 630, 630), (630, 500, 800, 630)],
    'an225': [(430, 495, 565, 610), (560, 495, 700, 610), (690, 495, 835, 610)],
    'belugaxl': [(470, 565, 710, 690)],
}
BODY_TOP = {'b748f': 430, 'belugaxl': 335, 'an124': 435, 'an225': 450}
TAIL_START = {'an148': 1110, 'an158': 1110, 'il96': 1170, 'sj100': 1160,
              'tu204': 1180, 'atr72f': 1120, 'an124': 1200,
              'an225': 1280, 'belugaxl': 1250, 'b748f': 1130}

# Shapes actually provided by the user's APK. Reproject onto each new body or
# tail mask; the SVG renderer tints them with any color chosen in the editor.
PATTERNS = {
    'tail': ['br_tail', 'nh_stripe_1', 'swoosh_tail', 'triangle_5'],
    'fuselage': ['br_stripe', 'br_belly', 'nh_stripe_1', 'tui_wave_2',
                 'oz_curve_1', 'triangle_1', 'double_line'],
}
REFERENCE = json.loads((OUT / 'models' / 'airbusa320.json').read_text(encoding='utf8'))
REF_BODY = tuple(REFERENCE['bodyBox'])
REF_TAIL = tuple(REFERENCE['tailBox'])


def alpha_file(path: Path, mask: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((mask.astype(np.uint8) * 255), 'L').save(path)


def layer(aid: str, name: str, order: int, mask: np.ndarray, size: tuple, *, pattern=False,
          sector='fuselage', details=False) -> dict:
    rel = f'generated/{aid}/{name}.png'
    target = OUT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    if not details:
        rgba = np.full((size[1], size[0], 4), 255, dtype=np.uint8)
        rgba[:, :, 3] = mask.astype(np.uint8) * 255
        Image.fromarray(rgba, 'RGBA').save(target)
    box = Image.fromarray(mask.astype(np.uint8) * 255, 'L').getbbox()
    return {'id': f'{order}_{name}', 'name': name, 'order': order,
            'variant': '', 'option': False, 'pattern': pattern, 'sector': sector,
            'file': rel, 'small': rel, 'size': list(size), 'box': list(box) if box else None}


def reproject(source: Image.Image, source_box: tuple, target_box: tuple, size: tuple,
              clip: np.ndarray) -> np.ndarray:
    out = Image.new('L', size, 0)
    x0, y0, x1, y1 = target_box
    resized = source.crop(source_box).resize((x1-x0, y1-y0), Image.Resampling.BILINEAR)
    out.paste(resized, (x0, y0))
    return (np.asarray(out) > 80) & clip


def make(aid: str) -> None:
    folder = 'aircraft' if aid in PASSENGERS else 'freighters'
    path = SPRITES / folder / f'{aid}.png'
    source = Image.open(path)
    photo = source.convert('RGB')
    size = photo.size
    assert size == DEFAULT_SIZE, (aid, size)
    rgb = np.asarray(photo)
    plane = ndimage.binary_fill_holes(
        np.asarray(source.getchannel('A')) > 8 if source.mode == 'RGBA' else mc.silhueta(str(path)))
    yy, xx = np.indices(plane.shape)
    bbox = Image.fromarray(plane.astype(np.uint8) * 255, 'L').getbbox()
    assert bbox
    body_sample = [np.where(plane[:, x])[0] for x in range(180, 320, 5)]
    body_top = BODY_TOP.get(aid, int(np.median([ys.min() for ys in body_sample if len(ys)])))
    body_bottom = int(np.median([ys.max() for ys in body_sample if len(ys)]))
    tail_start = TAIL_START.get(aid, 1130)
    tail = plane & (xx >= tail_start) & (yy < body_top + 20)
    tail = ndimage.binary_closing(tail, iterations=2)
    engine_draw = Image.new('L', size, 0)
    pen = ImageDraw.Draw(engine_draw)
    for bounds in ENGINES[aid]:
        pen.ellipse(bounds, fill=255)
    engine = (np.asarray(engine_draw) > 0) & plane
    body = plane & (yy >= body_top - 12) & (yy <= body_bottom + 10) & ~tail & ~engine
    body = ndimage.binary_closing(body, iterations=1)
    tail_box = Image.fromarray(tail.astype(np.uint8) * 255, 'L').getbbox()
    body_box = Image.fromarray(body.astype(np.uint8) * 255, 'L').getbbox()
    assert tail_box and body_box, aid
    layers = [layer(aid, 'tail', 0, tail, size, sector='tail')]
    order = 1
    for sector, names, clip, ref_box, target_box in [
        ('tail', PATTERNS['tail'], tail, REF_TAIL, tail_box),
        ('fuselage', PATTERNS['fuselage'], body, REF_BODY, body_box),
    ]:
        if sector == 'fuselage':
            layers.append(layer(aid, 'fuselage', order, body, size))
            order += 1
        for name in names:
            original = next(x for x in REFERENCE['layers'] if x['name'] == name
                            and x['pattern'] and x['sector'] == sector)
            src = Image.open(OUT / original['file']).convert('RGBA').getchannel('A')
            transferred = reproject(src, ref_box, target_box, size, clip)
            layers.append(layer(aid, name, order, transferred, size,
                                pattern=True, sector=sector))
            order += 1
    layers.append(layer(aid, 'engine', order, engine, size))
    order += 1

    # Outside paintable pieces, preserve the exact plane photo. Inside them,
    # retain cockpit glazing, windows, cargo door seams and panel shading while
    # letting the company color show through. The original pixels are the
    # surface finish; no generic stripe or artificial wheel is composited.
    luma = rgb.astype(np.int16).mean(axis=2)
    finish = np.dstack((rgb, np.where(
        plane & ~(body | tail | engine), 255,
        np.where(plane, np.clip((255 - luma) * 2.1, 0, 230), 0)
    ).astype(np.uint8)))
    finish_path = OUT / f'generated/{aid}/finish.png'
    Image.fromarray(finish.astype(np.uint8), 'RGBA').save(finish_path)
    layers.append(layer(aid, 'finish', order, plane, size, details=True))
    (OUT / 'models' / f'generated_{aid}.json').write_text(json.dumps({
        'id': f'generated_{aid}', 'name': aid, 'size': list(size),
        'bodyBox': list(body_box), 'tailBox': list(tail_box), 'layers': layers,
    }, separators=(',', ':')), encoding='utf8')

    mc.salvar_mask(plane, str(SPRITES / 'planemasks' / f'{aid}.png'))
    for folder_name, part in [('fuselagemasks', body), ('tailmasks', tail),
                              ('enginemasks', engine), ('gearmasks', np.zeros_like(plane))]:
        alpha_file(SPRITES / folder_name / f'{aid}.png', part)
    print(f'{aid}: {len(layers)} paint layers, body={body_box}, tail={tail_box}')


if __name__ == '__main__':
    for aid in IDS:
        make(aid)
