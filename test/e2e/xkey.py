# Sends a real Alt+P to the X server (XTest), so Chromium's extension
# command handling sees it. Playwright's synthesized keys never reach it.
from Xlib import X, XK, display
from Xlib.ext import xtest

d = display.Display()
alt = d.keysym_to_keycode(XK.string_to_keysym('Alt_L'))
p = d.keysym_to_keycode(XK.string_to_keysym('p'))
xtest.fake_input(d, X.KeyPress, alt)
xtest.fake_input(d, X.KeyPress, p)
xtest.fake_input(d, X.KeyRelease, p)
xtest.fake_input(d, X.KeyRelease, alt)
d.sync()
