"""Create tiny synthetic, decodable media; no personal camera files are used.

Requires the existing Pillow/numpy/OpenCV service dependencies. Run this file
to regenerate fixtures. GPS is fixed at -33.71000, 150.31000 (WGS84).
"""

import struct
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, TiffImagePlugin


HERE = Path(__file__).resolve().parent


def atom(kind, payload):
    return struct.pack(">I4s", len(payload) + 8, kind) + payload


def attach_metadata(video, metadata):
    offset = 0
    while offset < len(video):
        size, kind = struct.unpack_from(">I4s", video, offset)
        if kind == b"moov":
            # OpenCV emits moov after mdat, so appending metadata changes no
            # media offsets and the original sample tables remain valid.
            assert offset + size == len(video)
            return video[:offset] + atom(kind, video[offset + 8:offset + size] + metadata)
        offset += size
    raise AssertionError("Fixture encoder did not produce a movie container")


def generate():
    exif = Image.Exif()
    rational = TiffImagePlugin.IFDRational
    exif[34853] = {
        1: "S", 2: (rational(33), rational(42), rational(36)),
        3: "E", 4: (rational(150), rational(18), rational(36)),
        18: "WGS-84",
    }
    image = Image.new("RGB", (16, 16), "orange")
    for fmt, extension in (("JPEG", "jpg"), ("PNG", "png"), ("WEBP", "webp")):
        image.save(HERE / f"gps.{extension}", format=fmt, exif=exif)
        image.save(HERE / f"no-gps.{extension}", format=fmt)

    with tempfile.TemporaryDirectory(dir=HERE) as temporary:
        path = Path(temporary) / "synthetic.mp4"
        writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), 5, (32, 32))
        assert writer.isOpened()
        for color in (70, 150, 220):
            writer.write(np.full((32, 32, 3), color, dtype=np.uint8))
        writer.release()
        video = path.read_bytes()
    (HERE / "no-gps.mp4").write_bytes(video)
    coordinate = b"-33.71000+150.31000+100.000/"
    legacy = atom(b"udta", atom(b"\xa9xyz", struct.pack(">HH", len(coordinate), 0) + coordinate))
    (HERE / "gps-userdata.mp4").write_bytes(attach_metadata(video, legacy))
    key = atom(b"mdta", b"com.apple.quicktime.location.ISO6709")
    keys = atom(b"keys", b"\0" * 4 + struct.pack(">I", 1) + key)
    data = atom(b"data", struct.pack(">II", 1, 0) + coordinate)
    item_list = atom(b"ilst", atom(struct.pack(">I", 1), data))
    metadata = atom(b"meta", b"\0" * 4 + keys + item_list)
    (HERE / "gps-keys.mp4").write_bytes(attach_metadata(video, metadata))
    # QuickTime-brand MOV with the same playable MPEG-4 Visual samples.
    size = struct.unpack_from(">I", video)[0]
    # Size/offset tables are based on the original ftyp length; keep its size.
    old_payload = video[8:size]
    mov = atom(b"ftyp", b"qt  " + old_payload[4:]) + video[size:]
    (HERE / "gps-keys.mov").write_bytes(attach_metadata(mov, metadata))
    (HERE / "gps-userdata.mov").write_bytes(attach_metadata(mov, legacy))


if __name__ == "__main__":
    generate()
