import time

import cv2

from app.preprocessing.image_ops import decode_image, preprocess_image, resize_image
from app.recognition.ocr import extract_text, prepare_for_ocr, tesseract_config
from app.utils.text import format_recognized_text


def run_pipeline(image_bytes):
    started = time.perf_counter()
    image = decode_image(image_bytes)
    resized = resize_image(image)
    preprocessed = preprocess_image(resized)
    ocr_input = prepare_for_ocr(resized, preprocessed)
    raw_text = extract_text(ocr_input, tesseract_config())
    text = format_recognized_text(raw_text)
    elapsed = (time.perf_counter() - started) * 1000
    encoded, buffer = cv2.imencode(".png", preprocessed)
    if not encoded:
        raise RuntimeError("Could not encode image")
    return {
        "text": text,
        "processing_ms": round(elapsed, 2),
        "processed_png": buffer.tobytes(),
    }
