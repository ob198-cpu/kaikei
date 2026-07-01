Bundled local OCR runtime for the receipt screen.

Files:
- tesseract.min.js and worker.min.js: tesseract.js browser bundle.
- core/: tesseract.js-core WebAssembly runtime files.
- lang-data/: Japanese and English traineddata files.

Purpose:
The app loads these files from the same site origin so receipt OCR can run in
the user's browser without CDN OCR services or external AI uploads.

Source packages:
- tesseract.js
- tesseract.js-core
- @tesseract.js-data/jpn
- @tesseract.js-data/eng
