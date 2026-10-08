"""Read optional capture coordinates without loading the vision model.

Images: Pillow EXIF GPS in JPEG, PNG and WebP. Videos: static decimal-degree
ISO 6709 in QuickTime UserData/ItemList ©xyz or mdta location.ISO6709 keys.
ponytail: timed GPS, XMP-only GPS and proprietary video tracks require a full
metadata reader such as ExifTool if those formats become product requirements.
"""

from __future__ import annotations

import math
import re
import struct
import warnings
from io import BytesIO

from PIL import Image, UnidentifiedImageError

MAX_MEDIA_BYTES = 25 * 1024 * 1024
_FALLBACK = "Choose a suggested place, enter coordinates, or use your current location."
_ISO6709 = re.compile(
    r"([+-]\d{2}(?:\.\d+)?)([+-]\d{3}(?:\.\d+)?)(?:[+-]\d+(?:\.\d+)?)?/?"
)
_GPS_KEY = b"com.apple.quicktime.location.ISO6709"
_CONTAINERS = {b"moov", b"trak", b"mdia", b"udta"}
_VIDEO_START = {b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip"}
_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


class InvalidMetadata(ValueError):
    pass


def _result(status, detail, lat=None, lng=None, source=None):
    return {"status": status, "latitude": lat, "longitude": lng,
            "source": source, "detail": detail}


def _coordinate_pair(lat, lng):
    if not (math.isfinite(lat) and math.isfinite(lng) and
            -90 <= lat <= 90 and -180 <= lng <= 180):
        raise InvalidMetadata("Coordinates are not finite decimal degrees in range.")
    return lat, lng


def _dms(values, reference, positive, negative, limit):
    if isinstance(reference, bytes):
        reference = reference.decode("ascii")
    if not isinstance(reference, str) or reference.strip("\x00 ").upper() not in (positive, negative):
        raise InvalidMetadata("GPS hemisphere reference is missing or invalid.")
    if len(values) != 3:
        raise InvalidMetadata("GPS degrees, minutes and seconds are incomplete.")
    degrees, minutes, seconds = (float(value) for value in values)
    if not (all(math.isfinite(value) for value in (degrees, minutes, seconds)) and
            0 <= degrees <= limit and 0 <= minutes < 60 and 0 <= seconds < 60):
        raise InvalidMetadata("GPS rational values are invalid.")
    value = degrees + minutes / 60 + seconds / 3600
    if value > limit:
        raise InvalidMetadata("GPS coordinate exceeds its allowed range.")
    return -value if reference.strip("\x00 ").upper() == negative else value


def _image_location(data):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in _IMAGE_FORMATS:
                    return _result("unsupported", "Use JPEG, PNG, WebP, MP4 or MOV. " + _FALLBACK)
                raw_exif = image.info.get("exif", b"")
                if image.format == "PNG":
                    # eXIf may follow IDAT. Read chunks, not a decompressed
                    # pixel raster (Pillow getexif() loads PNG without early GPS).
                    offset = 8
                    while offset + 12 <= len(data):
                        size = struct.unpack_from(">I", data, offset)[0]
                        if size > len(data) - offset - 12:
                            raise InvalidMetadata("PNG chunk exceeds the file.")
                        if data[offset + 4:offset + 8] == b"eXIf":
                            raw_exif = data[offset + 8:offset + 8 + size]
                        offset += size + 12
                image.verify()
        with warnings.catch_warnings():
            warnings.simplefilter("error", UserWarning)
            exif = Image.Exif()
            exif.load(raw_exif)
            gps = exif.get_ifd(34853)
        if not gps:
            return _result("missing", "This image has no readable EXIF GPS coordinates. " + _FALLBACK)
        if not all(tag in gps for tag in (1, 2, 3, 4)):
            raise InvalidMetadata("The EXIF GPS coordinate pair is incomplete.")
        if gps.get(9) in ("V", b"V"):
            raise InvalidMetadata("The camera marked this GPS measurement invalid.")
        datum = gps.get(18)
        if datum and str(datum).upper().replace("-", "").replace(" ", "").strip("\x00") != "WGS84":
            return _result("unsupported", "GPS datum is not WGS84. " + _FALLBACK)
        lat = _dms(gps[2], gps[1], "N", "S", 90)
        lng = _dms(gps[4], gps[3], "E", "W", 180)
        lat, lng = _coordinate_pair(lat, lng)
        return _result("found", "Capture coordinates found. Confirm that they identify the incident.", lat, lng, "exif")
    except UnidentifiedImageError:
        return _result("invalid", "The image could not be read. " + _FALLBACK)
    except (InvalidMetadata, OSError, ValueError, TypeError, IndexError,
            KeyError, ZeroDivisionError, OverflowError, UnicodeError,
            RuntimeError, struct.error, UserWarning,
            Image.DecompressionBombError, Image.DecompressionBombWarning):
        return _result("invalid", "The image or its EXIF GPS metadata is malformed. " + _FALLBACK)


def _boxes(data, start, end, budget):
    """Yield validated ISO BMFF atoms; media payload is never interpreted as GPS."""
    while start < end:
        budget[0] += 1
        if budget[0] > 10000 or end - start < 8:
            raise InvalidMetadata("Too many atoms or a truncated atom header.")
        size, kind = struct.unpack_from(">I4s", data, start)
        header = 8
        if size == 1:
            if end - start < 16:
                raise InvalidMetadata("Truncated extended atom header.")
            size = struct.unpack_from(">Q", data, start + 8)[0]
            header = 16
        elif size == 0:
            size = end - start
        if size < header or size > end - start:
            raise InvalidMetadata("Atom extends outside its parent.")
        yield kind, start + header, start + size
        start += size


def _text(data, start, end):
    if end - start > 4096:
        raise InvalidMetadata("Location value is too long.")
    return data[start:end].decode("utf-8").strip("\x00 \r\n")


def _data_text(data, start, end, budget):
    texts = []
    for kind, payload, finish in _boxes(data, start, end, budget):
        if kind == b"data":
            if finish - payload < 8 or struct.unpack_from(">I", data, payload)[0] != 1:
                raise InvalidMetadata("Location item is not UTF-8 text.")
            texts.append(_text(data, payload + 8, finish))
    if not texts:
        raise InvalidMetadata("Location item has no data atom.")
    return texts


def _meta(data, start, end, budget):
    # ISO meta is a FullBox; older QuickTime meta may omit its version/flags.
    if end - start >= 4 and data[start:start + 4] == b"\0\0\0\0":
        start += 4
    entries = list(_boxes(data, start, end, budget))
    location_indexes = set()
    for kind, payload, finish in entries:
        if kind != b"keys":
            continue
        if finish - payload < 8:
            raise InvalidMetadata("Truncated metadata keys.")
        count = struct.unpack_from(">I", data, payload + 4)[0]
        if count > 1024:
            raise InvalidMetadata("Too many metadata keys.")
        keys = list(_boxes(data, payload + 8, finish, budget))
        if len(keys) != count:
            raise InvalidMetadata("Metadata key count does not match.")
        for index, (namespace, value, value_end) in enumerate(keys, 1):
            if namespace == b"mdta" and data[value:value_end] == _GPS_KEY:
                location_indexes.add(index)
    texts = []
    for kind, payload, finish in entries:
        if kind != b"ilst":
            continue
        for item, value, value_end in _boxes(data, payload, finish, budget):
            if item in (b"\xa9xyz", b"@xyz") or int.from_bytes(item, "big") in location_indexes:
                texts.extend(_data_text(data, value, value_end, budget))
    return texts


def _video_location(data):
    texts = []
    unsupported = False
    saw_movie = False
    budget = [0]

    def walk(start, end, depth=0, parent=None):
        nonlocal unsupported, saw_movie
        if depth > 8:
            raise InvalidMetadata("Metadata nesting exceeds the supported limit.")
        for kind, payload, finish in _boxes(data, start, end, budget):
            if kind == b"ftyp" and finish - payload >= 4:
                if data[payload:payload + 4] in (b"heic", b"heix", b"hevc", b"mif1", b"avif", b"avis"):
                    unsupported = True
            elif kind in _CONTAINERS:
                saw_movie |= kind == b"moov"
                walk(payload, finish, depth + 1, kind)
            elif kind == b"meta":
                texts.extend(_meta(data, payload, finish, budget))
            elif parent == b"udta" and kind in (b"\xa9xyz", b"@xyz"):
                # Legacy UserData text has two-byte length + two-byte language.
                if finish - payload < 4:
                    raise InvalidMetadata("Truncated legacy location value.")
                length = struct.unpack_from(">H", data, payload)[0]
                if length > finish - payload - 4:
                    raise InvalidMetadata("Legacy location length exceeds its atom.")
                texts.append(_text(data, payload + 4, payload + 4 + length))
            elif kind in (b"loci", b"gps0", b"gps ", b"GPS_"):
                unsupported = True

    try:
        walk(0, len(data))
        if not saw_movie:
            return _result("unsupported", "No supported MP4/MOV movie metadata container. " + _FALLBACK)
        coordinates = []
        for text in texts:
            match = _ISO6709.fullmatch(text)
            if not match:
                raise InvalidMetadata("Location tag is not supported decimal-degree ISO6709.")
            coordinates.append(_coordinate_pair(float(match[1]), float(match[2])))
        if coordinates:
            lat, lng = coordinates[0]
            if any(abs(lat - other_lat) > 0.00001 or abs(lng - other_lng) > 0.00001
                   for other_lat, other_lng in coordinates[1:]):
                raise InvalidMetadata("Location metadata tags disagree.")
            return _result("found", "Capture coordinates found. Confirm that they identify the incident.", lat, lng, "quicktime")
        if unsupported:
            return _result("unsupported", "This file uses location metadata outside the supported static GPS formats. " + _FALLBACK)
        return _result("missing", "No supported static GPS coordinates found. Timed/proprietary GPS tracks are not decoded. " + _FALLBACK)
    except (InvalidMetadata, struct.error, UnicodeError, ValueError, OverflowError):
        return _result("invalid", "The video container or location metadata is malformed. " + _FALLBACK)


def extract_location(data: bytes, filename: str = "") -> dict:
    """Return capture coordinates in WGS84 decimal degrees, never infer a place."""
    if not data or len(data) > MAX_MEDIA_BYTES:
        return _result("invalid", "Choose a non-empty media file no larger than 25 MB. " + _FALLBACK)
    if (data.startswith((b"\xff\xd8", b"\x89PNG\r\n\x1a\n")) or
            data.startswith(b"RIFF") and data[8:12] == b"WEBP"):
        return _image_location(data)
    if len(data) >= 8 and data[4:8] in _VIDEO_START:
        return _video_location(data)
    if filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov")):
        return _result("invalid", "The file does not match a supported media container. " + _FALLBACK)
    return _result("unsupported", "Use JPEG, PNG, WebP, MP4 or MOV. " + _FALLBACK)
