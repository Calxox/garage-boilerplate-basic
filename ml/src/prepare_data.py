"""
Fetch and lay out the baseline training data.

Pulls the public CAIR fire-detection image dataset and arranges it as
data/fire and data/nofire. Kept as a script rather than committing 136MB of
images, so the repo stays small and the dataset stays reproducible.

Requires `unar` (or `unrar`) on PATH for the .rar archives:
    macOS:  brew install unar
    Ubuntu: sudo apt-get install -y unar

Usage:
    python src/prepare_data.py --output data
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_URL = "https://github.com/cair/Fire-Detection-Image-Dataset.git"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Archive name -> destination class folder.
ARCHIVE_CLASS_MAP = {
    "Fire images": "fire",
    "Normal Images 1": "nofire",
    "Normal Images 2": "nofire",
    "Normal Images 3": "nofire",
    "Normal Images 4": "nofire",
    "Normal Images 5": "nofire",
}


def _extractor() -> list[str]:
    """Return the archive-extraction command available on this machine."""
    if shutil.which("unar"):
        return ["unar", "-q", "-f"]
    if shutil.which("unrar"):
        return ["unrar", "x", "-y"]
    raise RuntimeError(
        "Need 'unar' or 'unrar' on PATH to extract the dataset archives.\n"
        "  macOS:  brew install unar\n"
        "  Ubuntu: sudo apt-get install -y unar"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Download and lay out the baseline dataset")
    parser.add_argument("--output", default="data", help="destination directory")
    parser.add_argument("--keep-temp", action="store_true", help="keep the cloned repo for inspection")
    args = parser.parse_args()

    extract_cmd = _extractor()
    out_dir = Path(args.output)
    for cls in set(ARCHIVE_CLASS_MAP.values()):
        (out_dir / cls).mkdir(parents=True, exist_ok=True)

    tmp_dir = Path(tempfile.mkdtemp(prefix="firedata_"))
    clone_dir = tmp_dir / "repo"

    try:
        print(f"cloning {REPO_URL} ...")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(clone_dir)],
            check=True, capture_output=True,
        )

        extract_dir = tmp_dir / "extracted"
        extract_dir.mkdir(parents=True, exist_ok=True)

        for archive in sorted(clone_dir.glob("*.rar")):
            stem = archive.stem
            if stem not in ARCHIVE_CLASS_MAP:
                print(f"  skipping unrecognised archive: {archive.name}")
                continue
            print(f"  extracting {archive.name} -> {ARCHIVE_CLASS_MAP[stem]}/")
            cmd = extract_cmd + ([str(archive), "-o", str(extract_dir)]
                                 if extract_cmd[0] == "unar"
                                 else [str(archive), str(extract_dir) + "/"])
            subprocess.run(cmd, check=True, capture_output=True)

        counts: dict[str, int] = {}
        for stem, cls in ARCHIVE_CLASS_MAP.items():
            src = extract_dir / stem
            if not src.is_dir():
                continue
            for f in src.rglob("*"):
                if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
                    shutil.copy2(f, out_dir / cls / f.name)
                    counts[cls] = counts.get(cls, 0) + 1

        if not counts:
            print("ERROR: no images were extracted", file=sys.stderr)
            return 1

        print("\ndone:")
        for cls in sorted(counts):
            print(f"  {out_dir / cls}: {counts[cls]} images")
        return 0

    except subprocess.CalledProcessError as exc:
        print(f"ERROR: command failed: {exc.cmd}", file=sys.stderr)
        print((exc.stderr or b"").decode()[:500], file=sys.stderr)
        return 1
    finally:
        if args.keep_temp:
            print(f"(kept temp dir: {tmp_dir})")
        else:
            shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
