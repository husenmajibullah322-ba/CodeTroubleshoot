import os

import pytesseract


def configure_tesseract():
    command = os.environ.get("TESSERACT_CMD")
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
        return
    default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(default):
        pytesseract.pytesseract.tesseract_cmd = default


def tesseract_config():
    psm = os.environ.get("TESSERACT_PSM", "4")
    return f"--oem 3 --psm {psm} -c preserve_interword_spaces=1"


def prepare_for_ocr(original, preprocessed):
    return preprocessed


def extract_text(image, config):
    configure_tesseract()
    return pytesseract.image_to_string(image, lang="eng", config=config)
