"""Run with: python -m unittest discover -s tests -p test_location.py"""

import asyncio
import struct
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image, TiffImagePlugin

from app.location import MAX_MEDIA_BYTES, extract_location


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def atom(kind, value):
    return struct.pack(">I4s", len(value) + 8, kind) + value


def video_with_legacy(text):
    value = struct.pack(">HH", len(text), 0) + text
    return atom(b"moov", atom(b"udta", atom(b"\xa9xyz", value)))


def image_with_gps(gps):
    exif = Image.Exif()
    exif[34853] = gps
    output = BytesIO()
    Image.new("RGB", (1, 1)).save(output, "JPEG", exif=exif)
    return output.getvalue()


class LocationTests(unittest.TestCase):
    def test_real_media_fixtures(self):
        for name in ("gps.jpg", "gps.png", "gps.webp", "gps-userdata.mp4",
                     "gps-keys.mp4", "gps-userdata.mov", "gps-keys.mov"):
            with self.subTest(name=name):
                result = extract_location((FIXTURES / name).read_bytes(), name)
                self.assertEqual(result["status"], "found", result)
                self.assertAlmostEqual(result["latitude"], -33.71, places=5)
                self.assertAlmostEqual(result["longitude"], 150.31, places=5)
                self.assertEqual(result["source"], "quicktime" if name.endswith((".mp4", ".mov")) else "exif")
        for name in ("no-gps.jpg", "no-gps.png", "no-gps.webp", "no-gps.mp4"):
            with self.subTest(name=name):
                result = extract_location((FIXTURES / name).read_bytes(), name)
                self.assertEqual(result["status"], "missing", result)
                self.assertIsNone(result["latitude"])
                self.assertIsNone(result["longitude"])

    def test_png_exif_after_pixel_chunks(self):
        data = (FIXTURES / "gps.png").read_bytes()
        offset, chunks, exif_chunk = 8, [], None
        while offset < len(data):
            size = struct.unpack_from(">I", data, offset)[0]
            chunk = data[offset:offset + size + 12]
            if chunk[4:8] == b"eXIf":
                exif_chunk = chunk
            else:
                chunks.append(chunk)
            offset += size + 12
        self.assertIsNotNone(exif_chunk)
        moved = data[:8] + b"".join(chunks[:-1]) + exif_chunk + chunks[-1]
        result = extract_location(moved, "late.png")
        self.assertEqual(result["status"], "found", result)
        self.assertAlmostEqual(result["latitude"], -33.71, places=5)

    def test_gps_validation_and_canonical_longitude(self):
        r = TiffImagePlugin.IFDRational
        gps = {1: "S", 2: (r(33), r(42), r(36)), 3: "W", 4: (r(176), r(0), r(0))}
        self.assertEqual(extract_location(image_with_gps(gps))["longitude"], -176)
        for changed in ({1: "invalid"}, {2: (r(33), r(60), r(0))},
                        {2: (r(33), r(0), r(1, 0))}, {4: (r(181), r(0), r(0))}):
            with self.subTest(changed=changed):
                self.assertEqual(extract_location(image_with_gps(gps | changed))["status"], "invalid")
        self.assertEqual(extract_location(image_with_gps({1: "S"}))["status"], "invalid")
        self.assertEqual(extract_location(image_with_gps(gps | {18: "TOKYO"}))["status"], "unsupported")

    def test_video_bounds_and_unknown_gps(self):
        for text in (b"+91.00000+150.31000/", b"-33.71000+181.00000/", b"nan+150.31/", b"-33.71"):
            with self.subTest(text=text):
                self.assertEqual(extract_location(video_with_legacy(text))["status"], "invalid")
        for data in (b"\0\0\0\1moov", struct.pack(">I4s", 100, b"moov") + b"bad",
                     atom(b"moov", b"truncated")):
            self.assertEqual(extract_location(data)["status"], "invalid")
        nested = b""
        for _ in range(11):
            nested = atom(b"moov", nested)
        self.assertEqual(extract_location(nested)["status"], "invalid")
        self.assertEqual(extract_location(atom(b"moov", atom(b"udta", atom(b"loci", b"GPS"))))["status"], "unsupported")
        self.assertEqual(extract_location(atom(b"moov", atom(b"free", b"-33.71000+150.31000/")))["status"], "missing")
        first = video_with_legacy(b"-33.71000+150.31000/")
        second = video_with_legacy(b"-34.00000+150.31000/")
        self.assertEqual(extract_location(first + second)["status"], "invalid")
        self.assertEqual(extract_location(b"not a video", "misnamed.mp4")["status"], "invalid")
        self.assertEqual(extract_location(b"GIF89a", "image.gif")["status"], "unsupported")

    def test_endpoint_does_not_load_model_and_bounds_reads(self):
        # Only metadata, FastAPI and the light chat/schema imports are needed.
        from app.main import media_location
        from fastapi import HTTPException, UploadFile
        file = UploadFile(file=BytesIO((FIXTURES / "gps.jpg").read_bytes()), filename="gps.jpg")
        result = asyncio.run(media_location(file))
        self.assertEqual(result["status"], "found")
        self.assertTrue(file.file.closed)
        too_large = UploadFile(file=BytesIO(b"x" * (MAX_MEDIA_BYTES + 1)), filename="large.mp4")
        with self.assertRaises(HTTPException) as error:
            asyncio.run(media_location(too_large))
        self.assertEqual(error.exception.status_code, 413)
        self.assertTrue(too_large.file.closed)

    def test_http_endpoint_and_local_cors(self):
        from fastapi.testclient import TestClient
        from app.main import app
        with TestClient(app) as client, patch("app.main.get_model", side_effect=AssertionError("Metadata must not load the vision model")):
            response = client.post("/v1/media/location", files={
                "file": ("gps.jpg", (FIXTURES / "gps.jpg").read_bytes(), "image/jpeg"),
            })
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["status"], "found")
            response = client.options("/v1/media/location", headers={
                "origin": "http://127.0.0.1:3001",
                "access-control-request-method": "POST",
                "access-control-request-headers": "content-type",
            })
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["access-control-allow-origin"], "http://127.0.0.1:3001")
            response = client.options("/v1/media/location", headers={
                "origin": "https://unapproved.example",
                "access-control-request-method": "POST",
            })
            self.assertNotIn("access-control-allow-origin", response.headers)

    def test_missing_model_returns_503_before_inference_import(self):
        from fastapi.testclient import TestClient
        from app.main import app
        with TestClient(app) as client, patch("app.main._MODEL", None), \
                patch("app.main._MODEL_PATH", FIXTURES / "absent-model.pt"), \
                patch.dict("sys.modules", {"app.inference": None}):
            for endpoint, name, content_type in (
                ("image", "gps.jpg", "image/jpeg"),
                ("video", "gps-userdata.mp4", "video/mp4"),
            ):
                with self.subTest(endpoint=endpoint):
                    response = client.post(f"/v1/assess/{endpoint}", files={
                        "file": (name, (FIXTURES / name).read_bytes(), content_type),
                    })
                    self.assertEqual(response.status_code, 503, response.text)
                    self.assertIn("Model not found", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
