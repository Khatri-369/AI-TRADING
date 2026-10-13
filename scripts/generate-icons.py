import math
from PIL import Image, ImageDraw

def draw_tradexa_icon(size, is_maskable=False):
    # Base canvas
    img = Image.new('RGBA', (size, size), (9, 13, 22, 255)) # #090d16
    draw = ImageDraw.Draw(img)

    scale = size / 512.0
    center = size / 2.0

    # In maskable icons, keep content inside 80% circle (radius ~ 0.40 * size)
    # In regular icons, can use ~90% of canvas
    content_scale = 0.78 if is_maskable else 0.90

    # Background gradient / subtle rounded container
    pad = (size - (size * content_scale)) / 2.0
    r = 32 * scale if not is_maskable else 0

    if not is_maskable:
        # Subtle radial glow & rounded squircle background
        for i in range(12):
            alpha = int(18 - i * 1.5)
            glow_pad = pad - i * 2 * scale
            draw.rounded_rectangle(
                [glow_pad, glow_pad, size - glow_pad, size - glow_pad],
                radius=42 * scale,
                fill=(16, 185, 129, max(0, alpha))
            )
        draw.rounded_rectangle(
            [pad, pad, size - pad, size - pad],
            radius=40 * scale,
            fill=(13, 20, 36, 255),
            outline=(30, 48, 80, 255),
            width=int(2 * scale)
        )

    # Financial Chart / Breakout chevron & 'T' monogram
    # Candlestick bars in background
    bars = [
        # (center_x_rel, y_low_rel, y_high_rel, y_open_rel, y_close_rel, color)
        (-110, -30, 110, 20, 80, (59, 130, 246, 180)),    # blue bar
        (-50,  -70, 70,  -40, 40, (16, 185, 129, 220)),   # green bar
        (10,   -120, 20, -90, -10, (16, 185, 129, 240)),  # green bar
        (70,   -100, 40, -70, 10,  (6, 182, 212, 220)),   # cyan bar
        (130,  -150, -20,-130, -50,(16, 185, 129, 255)),  # strong breakout green bar
    ]

    for bx, wick_top, wick_bot, body_top, body_bot, col in bars:
        cx = center + bx * scale * content_scale
        w_top = center + wick_top * scale * content_scale
        w_bot = center + wick_bot * scale * content_scale
        b_top = center + body_top * scale * content_scale
        b_bot = center + body_bot * scale * content_scale
        bar_w = 14 * scale * content_scale
        wick_w = max(2, int(3 * scale * content_scale))

        # Wick
        draw.line([(cx, w_top), (cx, w_bot)], fill=col, width=wick_w)
        # Body
        draw.rounded_rectangle(
            [cx - bar_w, min(b_top, b_bot), cx + bar_w, max(b_top, b_bot)],
            radius=3 * scale,
            fill=col
        )

    # Stylized Glowing Upward Trendline / Arrow
    trend_points = [
        (center - 130 * scale * content_scale, center + 70 * scale * content_scale),
        (center - 60 * scale * content_scale, center + 20 * scale * content_scale),
        (center + 10 * scale * content_scale, center - 40 * scale * content_scale),
        (center + 80 * scale * content_scale, center - 20 * scale * content_scale),
        (center + 145 * scale * content_scale, center - 125 * scale * content_scale),
    ]

    # Glow under trendline
    for w in [16, 10, 6]:
        alpha = 40 if w > 10 else 100
        draw.line(trend_points, fill=(6, 182, 212, alpha), width=int(w * scale * content_scale), joint='curve')

    # Sharp electric cyan & emerald trendline
    draw.line(trend_points, fill=(16, 185, 129, 255), width=int(5 * scale * content_scale), joint='curve')

    # Arrow head at the end of trendline
    ax, ay = trend_points[-1]
    arrow_size = 18 * scale * content_scale
    arrow_poly = [
        (ax, ay),
        (ax - arrow_size * 1.5, ay + arrow_size * 0.4),
        (ax - arrow_size * 0.8, ay + arrow_size * 1.1),
    ]
    draw.polygon(arrow_poly, fill=(16, 185, 129, 255))

    # Center-bottom badge: 'TRADEXA' sleek pill emblem
    badge_w = 90 * scale * content_scale
    badge_h = 24 * scale * content_scale
    badge_y = center + 120 * scale * content_scale
    draw.rounded_rectangle(
        [center - badge_w, badge_y - badge_h, center + badge_w, badge_y + badge_h],
        radius=12 * scale,
        fill=(15, 23, 42, 230),
        outline=(16, 185, 129, 180),
        width=int(2 * scale)
    )

    # Stylized letter 'T' inside badge / center
    # Top horizontal bar of 'T'
    t_y = badge_y - 8 * scale * content_scale
    draw.line(
        [(center - 35 * scale * content_scale, t_y), (center + 35 * scale * content_scale, t_y)],
        fill=(255, 255, 255, 255),
        width=int(4 * scale * content_scale)
    )
    # Vertical stem of 'T'
    draw.line(
        [(center, t_y), (center, badge_y + 9 * scale * content_scale)],
        fill=(16, 185, 129, 255),
        width=int(4 * scale * content_scale)
    )

    return img

# Generate icons
for size, is_maskable, filename in [
    (192, False, 'public/icons/tradexa-192.png'),
    (512, False, 'public/icons/tradexa-512.png'),
    (512, True,  'public/icons/tradexa-maskable-512.png'),
    (192, False, 'public/icons/markets-192.png'),
    (512, False, 'public/icons/markets-512.png'),
]:
    icon = draw_tradexa_icon(size, is_maskable)
    icon.save(filename, 'PNG')
    print(f'Generated {filename} ({size}x{size}, maskable={is_maskable})')
