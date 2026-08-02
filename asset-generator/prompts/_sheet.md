Sheet layout (most important requirement): this image is a sprite sheet. The square image is divided into a {{rows}}x{{cols}} grid of {{frames}} equal cells of exactly the same size, each holding one animation frame. Frame order is reading order: left to right, then top to bottom. There are NO visible grid lines, NO cell borders, NO separators, NO frame numbers, NO labels — the background is one continuous flat color across the entire image.

Frame consistency (critical): every frame shows the EXACT SAME subject. Identical proportions, identical height, identical width, identical colors, identical details. The subject sits at the same position within its cell in every frame and occupies the same amount of space in every frame. Do not redraw, restyle, re-light or re-scale the subject between frames — think of it as one drawing nudged, not {{frames}} separate drawings. Anything that is not part of the motion described below must be pixel-for-pixel unchanged, including the silhouette of the hair.

Animation: {{motion}}

The motion is SMALL and reads as a loop: the last frame must lead naturally back into the first. Nothing moves except what the motion above describes.
