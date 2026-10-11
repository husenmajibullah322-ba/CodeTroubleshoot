import cv2
import numpy as np


def decode_image(data):
    array = np.frombuffer(data, dtype=np.uint8).copy()
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image")
    return image


def resize_image(image, max_width=1800, max_height=1800):
    height, width = image.shape[:2]
    if width <= max_width and height <= max_height:
        return image
    scale = min(max_width / width, max_height / height)
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)


def to_grayscale(image):
    if image.ndim == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def crop_paper_borders(image):
    """Detects and crops outer desk/table borders if a clear document sheet is found."""
    height, width = image.shape[:2]
    if height < 120 or width < 120:
        return image

    scale = 400.0 / max(height, width)
    small_w = max(1, int(round(width * scale)))
    small_h = max(1, int(round(height * scale)))
    small = cv2.resize(image, (small_w, small_h), interpolation=cv2.INTER_AREA)
    gray_small = to_grayscale(small)
    blurred_small = cv2.GaussianBlur(gray_small, (7, 7), 0)

    _, thresh = cv2.threshold(blurred_small, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    white_ratio = np.mean(thresh == 255)
    if white_ratio < 0.25:
        thresh = cv2.bitwise_not(thresh)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image

    largest = max(contours, key=cv2.contourArea)
    area_ratio = cv2.contourArea(largest) / (small_w * small_h)

    # If paper occupies 30% to 96% of the frame, crop to bounding box
    if 0.30 <= area_ratio <= 0.96:
        x, y, w, h = cv2.boundingRect(largest)
        orig_x = int(round(x / scale))
        orig_y = int(round(y / scale))
        orig_w = int(round(w / scale))
        orig_h = int(round(h / scale))

        # 1.5% margin inset to cleanly remove desk edges
        inset_x = int(orig_w * 0.015)
        inset_y = int(orig_h * 0.015)
        x1 = max(0, orig_x + inset_x)
        y1 = max(0, orig_y + inset_y)
        x2 = min(width, orig_x + orig_w - inset_x)
        y2 = min(height, orig_y + orig_h - inset_y)

        if (x2 - x1) > width * 0.3 and (y2 - y1) > height * 0.3:
            return image[y1:y2, x1:x2]

    return image


def clean_borders_and_noise(binary):
    """Removes dark border bands, edge artifacts, and speckle noise."""
    height, width = binary.shape[:2]
    if height < 60 or width < 60:
        return binary

    # Work with foreground = white (255), background = black (0)
    fg = cv2.bitwise_not(binary)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)

    margin = max(4, int(min(height, width) * 0.02))
    clean_fg = np.zeros_like(fg)

    for i in range(1, num_labels):
        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]
        area = stats[i, cv2.CC_STAT_AREA]

        # 1. Remove tiny isolated speckle noise
        if area < 6:
            continue

        # 2. Filter out border bands and table fragments touching margins
        touches_top = y <= margin
        touches_bottom = (y + h) >= (height - margin)
        touches_left = x <= margin
        touches_right = (x + w) >= (width - margin)

        if touches_top or touches_bottom or touches_left or touches_right:
            # If it spans across a large dimension, it's a border/table artifact
            if w > width * 0.12 or h > height * 0.12 or area > (width * height * 0.015):
                continue
            # If it's directly touching the perimeter within 3px
            if y <= 3 or x <= 3 or (y + h) >= (height - 3) or (x + w) >= (width - 3):
                continue

        clean_fg[labels == i] = 255

    # Invert back: paper = 255, ink = 0
    cleaned = cv2.bitwise_not(clean_fg)

    # Whiten outer margin border cleanly
    border_px = max(2, min(10, int(min(height, width) * 0.01)))
    cleaned[:border_px, :] = 255
    cleaned[-border_px:, :] = 255
    cleaned[:, :border_px] = 255
    cleaned[:, -border_px:] = 255

    # 3. Connect micro-breaks in ink strokes for cleaner character contours
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    smoothed = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)

    return smoothed


def preprocess_image(image):
    # 1. Remove surrounding desk/table border if present
    cropped = crop_paper_borders(image)
    gray = to_grayscale(cropped)

    height, width = gray.shape[:2]
    min_dim = min(height, width)

    # 2. Background illumination normalization (removes phone shadows & lighting gradients)
    k_dilate = max(3, min(7, (min_dim // 40) * 2 + 1))
    dilated = cv2.dilate(gray, np.ones((k_dilate, k_dilate), np.uint8))

    k_bg = max(3, min(25, (min_dim // 20) * 2 + 1))
    bg = cv2.medianBlur(dilated, k_bg)

    diff = 255 - cv2.absdiff(gray, bg)
    norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)

    # 3. Enhance contrast with CLAHE for clear handwriting strokes
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(norm)

    # 4. Local Adaptive Thresholding (preserves fine pen ink on clean white background)
    block_size = max(3, min(31, (min_dim // 15) * 2 + 1))
    blur = cv2.GaussianBlur(enhanced, (3, 3), 0)
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 10
    )

    # Ensure paper background is white and ink is dark
    if np.mean(binary == 255) < 0.5:
        binary = cv2.bitwise_not(binary)

    # 5. Clean border artifacts, remove speckle noise, and smooth strokes
    final_clean = clean_borders_and_noise(binary)

    return final_clean
