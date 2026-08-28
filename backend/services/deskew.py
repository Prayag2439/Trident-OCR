import cv2
import numpy as np
from PIL import Image

def deskew_image(image: Image.Image) -> tuple[Image.Image, float]:
    """
    Detects skew angle in scanned documents using OpenCV and rotates the image back.
    Returns (corrected_image, detected_angle_in_degrees).
    """
    try:
        np_img = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
        
        # Invert colors and threshold
        blur = cv2.GaussianBlur(gray, (9, 9), 0)
        thresh = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        
        # Dilate text to form solid line blocks
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 5))
        dilate = cv2.dilate(thresh, kernel, iterations=2)
        
        # Find contours of dilated blocks
        contours, _ = cv2.findContours(dilate, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        
        angles = []
        for c in contours:
            if cv2.contourArea(c) < 500:
                continue
            min_rect = cv2.minAreaRect(c)
            angle = min_rect[-1]
            
            # Format angle to [-45, 45] range
            if angle < -45:
                angle = 90 + angle
            elif angle > 45:
                angle = angle - 90
            
            angles.append(angle)
            
        if not angles:
            return image, 0.0
            
        median_angle = float(np.median(angles))
        
        # Only rotate if the angle is significant and within reasonable scanner skew (< 30 deg)
        if abs(median_angle) < 0.5 or abs(median_angle) > 30.0:
            return image, 0.0
            
        (h, w) = np_img.shape[:2]
        center = (w // 2, h // 2)
        rot_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(
            np_img, rot_matrix, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255)
        )
        
        return Image.fromarray(rotated), median_angle
    except Exception as e:
        # If any computer vision failure occurs, gracefully fallback to original
        return image, 0.0
