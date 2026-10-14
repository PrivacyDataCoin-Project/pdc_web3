# Icon sources

`gen_icons.py` regenerates the PNG icons (16/32/48/128) with Pillow:

```bash
python3 -m venv .venv && .venv/bin/pip install Pillow
.venv/bin/python gen_icons.py
```

Design: dark rounded square (#05060d) with two interlocking hexagons
(#1e30f3 blue + #3bc7ff cyan) and a cyan center dot — matching the PDC
explorer visual identity.
