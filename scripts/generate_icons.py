"""Generate original Hear My Dot artwork with Pillow."""
from pathlib import Path
from math import sin, cos, radians
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'extension/icons'
SIZES = (16, 24, 32, 48, 128)
COLORS = {'disabled': '#525b6b', 'ready': '#10283f', 'active': '#005b57'}

def draw_icon(state, size):
    scale = 4
    image = Image.new('RGBA', (128 * scale, 128 * scale))
    d = ImageDraw.Draw(image)
    def box(coords): return tuple(round(c * scale) for c in coords)
    d.rounded_rectangle(box((2, 2, 126, 126)), radius=28 * scale, fill=COLORS[state])
    d.ellipse(box((21, 52, 45, 76)), fill='white')
    radii = (32,) if state == 'ready' else (32, 59)
    for r in radii:
        d.arc(box((33-r, 64-r, 33+r, 64+r)), -55, 55, fill='white', width=9 * scale)
    if state == 'disabled':
        d.line(box((25, 106, 104, 25)), fill=COLORS[state], width=20 * scale)
        d.line(box((25, 106, 104, 25)), fill='white', width=10 * scale)
    return image.resize((size, size), Image.Resampling.LANCZOS)

def svg(state):
    paths=[]
    for r in ((32,) if state == 'ready' else (32, 59)):
        x=33+r*cos(radians(55)); dy=r*sin(radians(55))
        paths.append(f'<path d="M{x:.3f} {64-dy:.3f} A{r} {r} 0 0 1 {x:.3f} {64+dy:.3f}" fill="none" stroke="white" stroke-width="9"/>')
    if state=='disabled':
        paths += [f'<path d="M25 106 L104 25" stroke="{COLORS[state]}" stroke-width="20"/>','<path d="M25 106 L104 25" stroke="white" stroke-width="10"/>']
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><title>Hear My Dot — {state}</title><rect x="2" y="2" width="124" height="124" rx="28" fill="{COLORS[state]}"/><circle cx="33" cy="64" r="12" fill="white"/>{"".join(paths)}</svg>\n'

OUT.mkdir(parents=True, exist_ok=True)
for state in COLORS:
    (OUT/f'{state}.svg').write_text(svg(state))
    for size in SIZES: draw_icon(state,size).save(OUT/f'{state}-{size}.png')
(OUT/'logo.svg').write_text(svg('active'))
canvas=Image.new('RGB',(1120,520),'#eef2f6'); d=ImageDraw.Draw(canvas)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
large=ImageFont.truetype(font,27); normal=ImageFont.truetype(font,17); small=ImageFont.truetype(font,14)
d.text((32,24),'Hear My Dot / Toolbar states',fill='#10283f',font=large)
d.text((32,65),'Original dot + sound waves. Static artwork preview, not a Chrome screenshot.',fill='#34445a',font=normal)
for i,(state,label,badge,note) in enumerate([
 ('disabled','Disabled','OFF','Focus disabled'),('ready','Ready','','Waiting for ChatGPT audio'),
 ('active','Prioritizing','ON','Priority mode is active'),('active','Quiet period','WAIT','Waiting to restore changes')]):
    x=24+i*274
    d.rounded_rectangle((x,112,x+256,484),radius=18,fill='white')
    canvas.paste(draw_icon(state,128),(x+64,138),draw_icon(state,128))
    d.text((x+18,287),label,fill='#10283f',font=large)
    d.text((x+18,333),note,fill='#34445a',font=small)
    d.text((x+18,374),'Actual toolbar sizes:',fill='#34445a',font=small)
    for n,size in enumerate((16,24,32)):
        icon=draw_icon(state,size);canvas.paste(icon,(x+20+n*66,410),icon)
        d.text((x+20+n*66,451),str(size),fill='#34445a',font=small)
    if badge:
        d.rounded_rectangle((x+148,240,x+221,270),radius=6,fill='#10283f')
        d.text((x+157,244),badge,fill='white',font=normal)
(ROOT/'preview').mkdir(exist_ok=True)
canvas.save(ROOT/'preview/toolbar-preview.png')

assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
header = Image.new('RGB', (1280, 320), '#10283f')
hd = ImageDraw.Draw(header)
icon = draw_icon('active', 176)
header.paste(icon, (64, 72), icon)
hd.text((286, 59), 'CHROME / SINGLE PROFILE', font=ImageFont.truetype(font, 19), fill='#92e0d1')
hd.text((280, 97), 'Hear My Dot', font=ImageFont.truetype(font, 66), fill='white')
hd.text((286, 188), 'Give ChatGPT audio room.', font=ImageFont.truetype(font, 27), fill='#e1eaf2')
hd.text((286, 239), 'YouTube  /  Podverse  /  Tab audio', font=ImageFont.truetype(font, 20), fill='#b6c8d8')
header.save(assets / 'readme-header.png')
logo = svg('active').replace('viewBox="0 0 128 128"', 'x="64" y="72" width="176" height="176" viewBox="0 0 128 128"')
(assets / 'readme-header.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 320" role="img" aria-label="Hear My Dot — Give ChatGPT audio room">
<rect width="1280" height="320" rx="24" fill="#10283f"/>{logo}
<g font-family="DejaVu Sans,Arial,sans-serif"><text x="286" y="80" font-size="19" fill="#92e0d1">CHROME / SINGLE PROFILE</text>
<text x="280" y="165" font-size="66" fill="white">Hear My Dot</text><text x="286" y="218" font-size="27" fill="#e1eaf2">Give ChatGPT audio room.</text>
<text x="286" y="261" font-size="20" fill="#b6c8d8">YouTube / Podverse / Tab audio</text></g></svg>''')
