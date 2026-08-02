"""Asset pipeline core: spec -> prompt -> generate -> cutout -> pixelize -> rig -> pack.

Nothing in here imports the UI. Long-running work reports progress through
callbacks (`on_log`, `on_step`) rather than touching a widget, so the pipeline
can be driven by the NiceGUI app, a script, or a test with equal ease.
"""
