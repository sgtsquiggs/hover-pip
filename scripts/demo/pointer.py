# Drives the real X pointer over XTest, so the recording shows the cursor and
# Chromium sees genuine hovers. One command per stdin line, "ok" after each:
#   move X Y MS   ease to (X, Y) in screen pixels over MS milliseconds
#   click         left button
#   scroll N      N wheel notches, down if positive
import math
import sys
import time

from Xlib import X, display
from Xlib.ext import xtest

d = display.Display()
root = d.screen().root


def warp(x, y):
    xtest.fake_input(d, X.MotionNotify, x=round(x), y=round(y))
    d.sync()


def move(x, y, ms):
    p = root.query_pointer()
    x0, y0 = p.root_x, p.root_y
    steps = max(1, round(ms / 16))
    for i in range(1, steps + 1):
        t = i / steps
        e = 0.5 - math.cos(math.pi * t) / 2
        warp(x0 + (x - x0) * e, y0 + (y - y0) * e)
        time.sleep(ms / 1000 / steps)


def button(n):
    xtest.fake_input(d, X.ButtonPress, n)
    xtest.fake_input(d, X.ButtonRelease, n)
    d.sync()


for line in sys.stdin:
    cmd, *args = line.split()
    if cmd == 'move':
        move(float(args[0]), float(args[1]), float(args[2]))
    elif cmd == 'click':
        button(1)
    elif cmd == 'scroll':
        n = int(args[0])
        for _ in range(abs(n)):
            button(5 if n > 0 else 4)
            time.sleep(0.06)
    print('ok', flush=True)
