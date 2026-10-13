// Firefox's Picture-in-Picture toggle styles, ported from Firefox 156.0.1
// toolkit/themes/shared/media/pipToggle.css (MPL-2.0, header below). The
// shared and "NO EXPERIMENT" sections are verbatim except for three
// Gecko-only declarations; Chromium additions are at the end.
FirefoxPip.TOGGLE_CSS = String.raw`
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This CSS file is for the Picture-in-Picture toggle.
 *
 * The "experiment" class is used to enable styling for the VARIANT version
 * of the toggle for upcoming PiP Nimbus experiments.
 * @see Bug 1811314.
 *
 * To see each section of style changes, search "PIP STYLING" in this file.
 */

/* SHARED PIP STYLING */

.controlsOverlay[hidetoggle="true"].hovering > .pip-wrapper:not(.hovering) {
  /* If this isn't !important, it will fail to override the other opacity
   * rules, which are currently defined below this point in this file. */
  opacity: 0 !important;
}

.pip-wrapper {
  position: absolute;
  cursor: pointer;
  background: none;
  color: inherit;
  border: none;
  text-align: unset;
  top: calc(70% - 40px);
  opacity: 0;
  padding-inline: 0;
  transition: opacity 200ms;
  --pip-icon-size: 24px;
  --pip-icon-width-with-margins: calc(2 * var(--pip-toggle-margin) + var(--pip-icon-size));
  --pip-highlight-style: solid rgba(0, 254, 255, 1);
  --pip-highlight-width: 2px;
  --pip-toggle-distanceFromVideoEdge: 18px;
  --pip-toggle-focus-outline-offset: 1px;
  --pip-toggle-margin: 8px;
  --pip-border-radius-toggle: 4px;
  --pip-box-shadow-default: 0 0 4px rgba(255, 255, 255, 0.9);
  --pip-box-shadow-hover: 0 0 10px rgba(255, 255, 255, 0.7);
  --pip-expanded-height: 40px;
  --pip-expanded-min-width: 200px;
  --pip-expanded-max-width: max-content;
}

/* Adjust sizing of the regular toggle wrapper to correctly show the
 * focus outline when navigating via keyboard. */
.pip-wrapper[has-used],
.pip-wrapper[small-video] {
  height: var(--pip-icon-width-with-margins);
  width: var(--pip-icon-width-with-margins);
  border-radius: var(--pip-border-radius-toggle);
  margin-right: calc(var(--pip-icon-width-with-margins) * -1);
}

.pip-wrapper[policy="hidden"] {
  display: none;
}

.pip-wrapper[policy="top"] {
  top: 0%;
  translate: var(--pip-toggle-translate-x);
}

.pip-wrapper[policy="one-quarter"] {
  top: 25%;
}

.pip-wrapper[policy="middle"] {
  top: 50%;
}

.pip-wrapper[policy="three-quarters"] {
  top: 75%;
}

.pip-wrapper[policy="bottom"] {
  top: 100%;
  translate: var(--pip-toggle-translate-x) -100%;
}

.pip-wrapper[medium-video] > .pip-expanded > .pip-icon-label > .pip-label {
  font-size: 13px;
}

.pip-wrapper[medium-video] > .pip-expanded {
  font-size: 11px;
}

.pip-wrapper[position="right"] {
  /* move from the right by total width of pip toggle so that it is at least visible in the video element */
  right: calc(var(--pip-icon-width-with-margins) + var(--pip-toggle-distanceFromVideoEdge));
}

/* Re-position the first-time toggle such that it will always be the same distance away from the right edge
 * of the video, even if the label and/or message string(s) are long. */
.pip-wrapper[position="right"] > .pip-expanded {
  translate: calc(-100% + var(--pip-icon-width-with-margins));
  transform-origin: right;
}

.pip-wrapper[position="left"] {
  left: var(--pip-toggle-distanceFromVideoEdge);
}

.pip-expanded,
.pip-small,
.pip-icon,
.pip-explainer {
  position: absolute;
  left: 0;
  top: 0;
}

.pip-wrapper > .pip-expanded {
  display: flex;
  opacity: 0;
  align-items: center;
  scale: 0.33 1;
  font-size: 14px;
}

.pip-wrapper:not([small-video], [has-used]) > .pip-small {
  opacity: 0;
  transition: opacity 200ms;
}

.pip-wrapper:not([small-video], [has-used]) > .pip-expanded {
  opacity: 1;
  scale: 1;
  pointer-events: none;
}

.pip-wrapper:not([small-video], [has-used]).hovering > .pip-expanded {
  pointer-events: auto;
}

.pip-icon {
  top: 8px;
  left: 8px;
  pointer-events: none;
  background-position: center, center;
  background-repeat: no-repeat;
  background-size: var(--pip-icon-size) var(--pip-icon-size);
  fill: currentColor;
  height: var(--pip-icon-size);
  width: var(--pip-icon-size);
}

.videocontrols[localedir="rtl"] .pip-icon {
  transform: scaleX(-1);
}

.pip-wrapper[position="left"] > .pip-expanded > .pip-icon-label > .pip-label {
  margin-left: var(--pip-icon-width-with-margins);
  margin-right: var(--pip-toggle-margin);
}

.pip-small {
  width: 40px;
  height: 40px;
}

.pip-wrapper[position="left"] > .pip-expanded > .pip-icon-label > .pip-icon {
  display: none;
}

.pip-wrapper:is([small-video], [has-used]) > .pip-expanded,
.pip-wrapper[position="right"]:not([small-video], [has-used]) > .pip-icon {
  display: none;
}

.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label > .pip-icon {
  position: relative;
  top: 0;
  left: 0;
  display: inline-block;
}

.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label {
  display: flex;
  flex-direction: row;
  align-content: center;
}

.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label > .pip-icon,
.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label > .pip-label {
  margin-block: auto;
}

.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label > .pip-icon {
  margin-inline: var(--pip-toggle-margin);
}

.pip-wrapper[position="right"] > .pip-expanded > .pip-icon-label > .pip-label {
  margin-right: var(--pip-toggle-margin);
}

@media (prefers-reduced-motion) {
  .pip-wrapper,
  .pip-expanded,
  .pip-small,
  .pip-explainer {
    /* Transition changes in other rules may override this one if reduced motion is preferred.
     * Make sure this one always takes priority. */
    transition: none !important;
  }
}

/* NO EXPERIMENT - PIP STYLING */

.controlsOverlay:not(.experiment).hovering > .pip-wrapper:not(:focus-visible) {
  opacity: 0.8;
}

.controlsOverlay:not(.experiment).hovering > .pip-wrapper.hovering {
  opacity: 1;
}

/* If the PiP toggle is keyboard focused, always show it at 100% opacity */
.pip-wrapper:not([policy="hidden"], .experiment):focus-visible {
  opacity: 1;
}

/* If showing the expanded PiP toggle, don't outline the
 * parent wrapper element - the expanded toggle handles its
 * own outline. This also affects the regular toggle for small-videos. */
.pip-wrapper:not([policy="hidden"], [has-used], .experiment):focus-visible {
  outline: none;
}

/* Override outline set by ua.css for the regular toggle. */
.pip-wrapper[has-used]:not([policy="hidden"], .experiment):focus-visible {
  outline: var(--control-focus-outline);
}

.pip-wrapper:not(.experiment) > .pip-small {
  background-color: rgba(12, 12, 13, 0.65);
  box-shadow: 0 4px 4px rgba(12, 12, 13, 0.25);
  border-radius: var(--pip-border-radius-toggle);
}

.pip-wrapper:not(.experiment) > .pip-expanded,
.pip-wrapper:not(.experiment) > .pip-small {
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-sizing: border-box;
}

/* If first-time toggle is visible and then switched to the regular toggle for smaller videos,
 * maintain the border shown on the first-time toggle. */
.pip-wrapper:not([has-used], .experiment) > .pip-small {
  border: var(--pip-highlight-width) var(--pip-highlight-style);
}

.pip-wrapper:not(.experiment) > .pip-expanded {
  border: var(--pip-highlight-width) var(--pip-highlight-style);
  transition:
    opacity 250ms,
    scale 200ms;
  height: var(--pip-expanded-height);
  background-color: rgba(12, 12, 13, 0.9);
  box-shadow: 0 4px 4px rgba(12, 12, 13, 0.25);
  width: var(--pip-expanded-max-width);
  min-width: var(--pip-expanded-min-width);
  border-radius: 8px;
}

.pip-wrapper:not(.experiment).hovering > .pip-expanded {
  box-shadow: none;
  border: var(--pip-highlight-width) var(--pip-highlight-style);
  /* Remove bottom border but keep text centred with padding. */
  border-bottom: none;
  padding-bottom: var(--pip-highlight-width);
}

.pip-wrapper:not([small-video], [has-used], .experiment).hovering > .pip-expanded {
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

/* Toggle message only appears for CONTROL variant. */
.pip-wrapper:not(.experiment) > .pip-expanded > .pip-explainer {
  padding: 6px 16px 8px 8px;
  translate: 0;
  transition:
    opacity 250ms,
    translate 190ms;
  transition-timing-function: cubic-bezier(0.07, 0.95, 0, 1);
  background: rgba(12, 12, 13, 0.65);
  border-bottom-right-radius: 8px;
  border-bottom-left-radius: 8px;
  border: var(--pip-highlight-width) var(--pip-highlight-style);
  border-top: 0;
  box-shadow: 0 4px 4px rgba(12, 12, 13, 0.25);
  opacity: 0;
  margin-inline: calc(-1 * var(--pip-highlight-width));
  width: calc(100% - 24px);
  word-break: break-word;
  pointer-events: none;
  user-select: none;
}

.videocontrols[localedir="rtl"] .pip-wrapper:not(.experiment) > .pip-explainer {
  text-align: right;
  direction: rtl;
}

.pip-wrapper:not(.experiment).hovering > .pip-expanded > .pip-explainer {
  pointer-events: auto;
  opacity: 1;
  translate: 0 calc(40px - var(--pip-highlight-width));
}

/* CHROMIUM ADDITIONS (firefox-pip-chrome) */

/* Stand-in for Firefox's .videocontrols / .controlsOverlay: a box laid over
 * the hovered video's client rect. */
.controlsOverlay {
  position: absolute;
  display: block;
  color: #fff;
  font: normal normal normal 100% / normal sans-serif;
  direction: ltr;
  text-align: left;
  writing-mode: horizontal-tb;
  user-select: none;
  pointer-events: none;
}

/* Undo Chromium's <button> UA styles that Firefox's -moz-appearance:none and
 * button font cover. */
.pip-wrapper {
  appearance: none;
  margin: 0;
  padding: 0;
  font: inherit;
  font-family: system-ui, sans-serif;
  line-height: normal;
}

/* Firefox hit-tests the toggle geometrically; here it receives real events,
 * but only while the video is hovered. */
.controlsOverlay.hovering > .pip-wrapper,
.controlsOverlay.hovering > .pip-wrapper > .pip-expanded {
  pointer-events: auto;
}

/* Inline SVG replaces Firefox's background-image icon. */
.pip-icon > svg {
  display: block;
  width: 100%;
  height: 100%;
}
`;
