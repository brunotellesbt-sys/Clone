"""Realign the five passenger aircraft sector masks after replacing their sprites.

The regenerated side profiles keep the same canvas size but move individual
parts independently. A single whole-aircraft affine transform would leave the
wing and landing gear on the background. These boxes were measured on the new
1536x1024 sprites; child sectors follow their parent part's transform.

Run after generating planemasks with silhueta_batch.py. Original sector masks
come from the pre-regeneration commit so rerunning this script is safe.
Requires Pillow, NumPy and SciPy, the image stack used by the mask tooling.
"""

from io import BytesIO
from pathlib import Path
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, str(Path(".claude/skills/skyline-mask-audit/scripts").resolve()))
import maskcore as mc


ROOT = Path("public/sprites")
SOURCE_REF = "d52e478"
MODELS = {
    "an148": {
        "wing": (490, 425, 980, 518), "engine": (430, 488, 675, 609),
        "gear": (115, 612, 766, 707), "tail": (1100, 220, 1520, 490),
        "window": (302, 507, 975, 543), "cockpit": (77, 492, 184, 530),
    },
    "an158": {
        "wing": (475, 435, 925, 506), "engine": (416, 487, 625, 591),
        "gear": (91, 584, 758, 654), "tail": (1090, 242, 1531, 476),
        "window": (251, 502, 1122, 540), "cockpit": (69, 487, 137, 528),
    },
    "il96": {
        "wing": (467, 472, 1144, 573), "engine": (500, 516, 851, 617),
        "gear": (153, 562, 861, 650), "tail": (1140, 183, 1518, 455),
        "window": (207, 469, 1150, 513), "cockpit": (38, 465, 93, 505),
    },
    "sj100": {
        "wing": (615, 397, 1114, 598), "engine": (502, 555, 728, 669),
        "gear": (143, 580, 824, 692), "tail": (1180, 168, 1519, 470),
        "window": (294, 475, 1114, 521), "cockpit": (73, 465, 170, 519),
    },
    "tu204": {
        "wing": (620, 374, 1120, 591), "engine": (503, 542, 717, 633),
        "gear": (137, 568, 838, 660), "tail": (1195, 212, 1520, 457),
        "window": (218, 477, 1204, 519), "cockpit": (52, 472, 107, 516),
    },
}
GROUPS = {
    "wing": ("wingmasks", "wingletmasks", "leadingedgemasks", "wingtopmasks", "trailingedgemasks"),
    "engine": ("enginemasks", "enginecowlmasks"),
    "gear": ("gearmasks", "gearstrutmasks", "tyremasks"),
    "tail": ("tailmasks",),
    "window": ("windowmasks",),
    "cockpit": ("cockpitmasks",),
}
OFFSETS = {"sj100": {"tail": (6, -10)}, "tu204": {"tail": (2, 2), "cockpit": (-3, -4)}}


def source_mask(folder: str, aid: str) -> Image.Image:
    path = f"public/sprites/{folder}/{aid}.png"
    data = subprocess.run(
        ["git", "show", f"{SOURCE_REF}:{path}"], capture_output=True, check=True
    ).stdout
    return Image.open(BytesIO(data)).convert("L")


def box(mask: Image.Image) -> tuple[int, int, int, int]:
    result = mask.point(lambda p: 255 if p > 127 else 0).getbbox()
    if result is None:
        raise ValueError("empty parent mask")
    return result


def transform(mask: Image.Image, source: tuple[int, int, int, int], target: tuple[int, int, int, int]) -> Image.Image:
    x0, y0, x1, y1 = target
    canvas = Image.new("L", mask.size, 0)
    crop = mask.crop(source)
    resized = crop.resize((x1 - x0, y1 - y0), Image.Resampling.BILINEAR)
    canvas.paste(resized, (x0, y0))
    return canvas


def windows_from_photo(aid: str, bounds: tuple[int, int, int, int], plane: np.ndarray) -> np.ndarray:
    """Keep the *visible* dark cabin panes in the new render, not old panes."""
    photo = np.asarray(Image.open(ROOT / "aircraft" / f"{aid}.png").convert("L"))
    x0, y0, x1, y1 = bounds
    crop = photo[y0:y1, x0:x1] < 170
    labels, _ = ndimage.label(crop)
    accepted = np.zeros_like(crop)
    for label, sl in enumerate(ndimage.find_objects(labels), 1):
        if sl is None:
            continue
        height = sl[0].stop - sl[0].start
        width = sl[1].stop - sl[1].start
        area = int((labels[sl] == label).sum())
        if 4 <= width <= 25 and 5 <= height <= 30 and area >= 15:
            accepted[sl] |= labels[sl] == label
    accepted = ndimage.binary_dilation(accepted, iterations=1)
    result = np.zeros_like(plane, dtype=np.uint8)
    result[y0:y1, x0:x1] = np.where(accepted, 255, 0).astype(np.uint8)
    return np.where(plane, result, 0).astype(np.uint8)


def main() -> None:
    for aid, targets in MODELS.items():
        plane = np.asarray(Image.open(ROOT / "planemasks" / f"{aid}.png").convert("L"))
        plane_bool = plane > 127
        strict_silhouette = mc.silhueta(str(ROOT / "aircraft" / f"{aid}.png"))
        sector_boundary = ndimage.binary_erosion(strict_silhouette, iterations=1)
        parts: dict[str, np.ndarray] = {}
        for group, folders in GROUPS.items():
            parent_path = ROOT / folders[0] / f"{aid}.png"
            if not parent_path.exists():
                continue
            parent = source_mask(folders[0], aid)
            source = box(parent)
            for folder in folders:
                path = ROOT / folder / f"{aid}.png"
                if not path.exists():
                    continue
                original = source_mask(folder, aid)
                moved = np.asarray(transform(original, source, targets[group]))
                dx, dy = OFFSETS.get(aid, {}).get(group, (0, 0))
                if dx or dy:
                    moved = ndimage.shift(moved, (dy, dx), order=0, mode="constant", cval=0)
                # Every sector must lie on the new sprite; keep its antialiasing.
                moved = np.where(sector_boundary, moved, 0).astype(np.uint8)
                parts[folder] = moved > 127
                Image.fromarray(moved, "L").save(path)

        # This regenerated Il-96 has a plain tip. Its old winglet sector had
        # no matching feature; the Tu-204's tall winglet needs a new outline.
        if aid == "il96":
            parts.pop("wingletmasks", None)
            (ROOT / "wingletmasks" / f"{aid}.png").unlink(missing_ok=True)
        if aid == "tu204":
            winglet = Image.new("L", (plane.shape[1], plane.shape[0]), 0)
            ImageDraw.Draw(winglet).polygon(
                [(1010, 487), (1037, 457), (1072, 399), (1114, 375), (1102, 425), (1064, 477)],
                fill=255,
            )
            clipped = np.asarray(winglet) > 127
            clipped &= sector_boundary
            parts["wingletmasks"] = clipped
            Image.fromarray(np.where(clipped, 255, 0).astype(np.uint8), "L").save(
                ROOT / "wingletmasks" / f"{aid}.png"
            )

        windows = windows_from_photo(aid, targets["window"], plane_bool)
        parts["windowmasks"] = windows > 127
        Image.fromarray(windows, "L").save(ROOT / "windowmasks" / f"{aid}.png")

        # The new render places engines in front of the wing. Keep the sector
        # partition disjoint so wing paint never covers a nacelle or a wheel.
        gear = parts.get("gearmasks", np.zeros_like(plane_bool))
        engine = parts.get("enginemasks", np.zeros_like(plane_bool)) & ~gear
        parts["enginemasks"] = engine
        Image.fromarray(np.where(engine, 255, 0).astype(np.uint8), "L").save(
            ROOT / "enginemasks" / f"{aid}.png"
        )
        for folder in ("wingmasks", "leadingedgemasks", "wingtopmasks", "trailingedgemasks", "wingletmasks"):
            if folder not in parts:
                continue
            clean = parts[folder] & ~engine & ~gear
            if folder != "wingletmasks" and "wingletmasks" in parts:
                clean &= ~parts["wingletmasks"]
            parts[folder] = clean
            Image.fromarray(np.where(clean, 255, 0).astype(np.uint8), "L").save(
                ROOT / folder / f"{aid}.png"
            )

        # Rebuild the broad body sector from the new silhouette. The body is
        # used to clip cheatlines; excluding the wing/engines stops color spill.
        occupied = np.zeros_like(plane_bool)
        for folder in (
            "wingmasks", "wingletmasks", "leadingedgemasks", "wingtopmasks", "trailingedgemasks",
            "enginemasks", "gearmasks", "tailmasks",
        ):
            if folder in parts:
                occupied |= parts[folder]
        body = np.where(sector_boundary & ~occupied, 255, 0).astype(np.uint8)
        Image.fromarray(body, "L").save(ROOT / "fuselagemasks" / f"{aid}.png")
        print(f"{aid}: aligned {len(parts)} sectors")


if __name__ == "__main__":
    main()
