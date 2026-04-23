#!/usr/bin/env python3
"""아이콘 PNG 생성 스크립트. `python _make_png.py`로 한 번만 실행.

icon-192.png, icon-512.png 생성.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(__file__)

def find_font(size):
    candidates = [
        r"C:\Windows\Fonts\malgunbd.ttf",      # 맑은 고딕 Bold
        r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\consolab.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def make_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 둥근 사각형 배경 (그라디언트 없이 검정)
    radius = int(size * 0.18)
    d.rounded_rectangle((0, 0, size-1, size-1), radius=radius, fill=(10, 5, 5, 255))

    # TAXI 지붕등
    top_w, top_h = int(size * 0.35), int(size * 0.095)
    top_x = (size - top_w) // 2
    top_y = int(size * 0.15)
    d.rounded_rectangle(
        (top_x, top_y, top_x + top_w, top_y + top_h),
        radius=int(top_h * 0.25), fill=(255, 204, 51, 255),
    )
    font_taxi = find_font(int(top_h * 0.72))
    text = "TAXI"
    bbox = d.textbbox((0, 0), text, font=font_taxi)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        (top_x + (top_w - tw) // 2 - bbox[0], top_y + (top_h - th) // 2 - bbox[1]),
        text, font=font_taxi, fill=(26, 26, 26, 255),
    )

    # 미터 창
    m_x = int(size * 0.10)
    m_y = int(size * 0.33)
    m_w = size - 2 * m_x
    m_h = int(size * 0.35)
    d.rounded_rectangle(
        (m_x, m_y, m_x + m_w, m_y + m_h),
        radius=int(size * 0.035), fill=(8, 0, 0, 255),
        outline=(58, 0, 0, 255), width=max(2, size // 160),
    )

    # LED 숫자 (글로우용으로 별도 레이어)
    led_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(led_layer)
    font_num = find_font(int(size * 0.22))
    num = "1,000"
    bbox = ld.textbbox((0, 0), num, font=font_num)
    nw, nh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    nx = m_x + (m_w - nw) // 2 - bbox[0]
    ny = m_y + (m_h - nh) // 2 - bbox[1] - int(size * 0.015)
    ld.text((nx, ny), num, font=font_num, fill=(255, 42, 42, 255))

    glow = led_layer.filter(ImageFilter.GaussianBlur(radius=max(3, size // 50)))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, led_layer)

    # WON 라벨
    d = ImageDraw.Draw(img)
    font_won = find_font(int(size * 0.04))
    won = "WON"
    bbox = d.textbbox((0, 0), won, font=font_won)
    ww, wh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        (m_x + (m_w - ww) // 2 - bbox[0], m_y + m_h - wh - int(size * 0.02) - bbox[1]),
        won, font=font_won, fill=(255, 128, 128, 255),
    )

    # 하트 (뽀뽀)
    heart_size = int(size * 0.14)
    hx, hy = size // 2, int(size * 0.835)
    # 두 원 + 삼각형으로 하트 모양
    r = heart_size // 2
    d.ellipse((hx - r - r//2, hy - r, hx + r - r//2, hy + r), fill=(255, 77, 138, 255))
    d.ellipse((hx - r + r//2, hy - r, hx + r + r//2, hy + r), fill=(255, 77, 138, 255))
    d.polygon([(hx - r, hy), (hx + r, hy), (hx, hy + int(r * 1.4))], fill=(255, 77, 138, 255))

    return img

def main():
    for size in (192, 512):
        img = make_icon(size)
        out = os.path.join(ROOT, f"icon-{size}.png")
        img.save(out, "PNG")
        print(f"  wrote {out}")

if __name__ == "__main__":
    main()
