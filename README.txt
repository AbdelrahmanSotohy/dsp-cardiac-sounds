CEN464 Group 8 - Interactive project walkthrough
=================================================

How to open
  Unzip, then double-click index.html. It runs offline in any modern browser
  (Chrome, Edge, Firefox, Safari). No internet or server needed.

Navigating
  Next / Back buttons at the bottom, the arrow keys, or the step list on the left.
  Dotted words open a short definition; the Glossary button lists them all.
  "Test your own" (red button, top right) opens a separate page: load a .wav
  (and its .tsv if you have one) and our detector runs on it in the browser.
  Three CirCor examples are built in.

What is inside
  index.html            all 19 steps, plus the Test your own view
  css/style.css         theme (ADU red #EE2737, navy #0C2340, black, white)
  js/app.js             navigation and the interactive labs
  js/dsp.js             FIR design, Welch PSD, STFT, S1/S2 detector, murmur detector
  js/charts.js          small SVG chart kit (no external libraries)
  data/recordings.js    6 development recordings (first 20 s): raw, FIR-filtered,
                        Hilbert envelope, annotations
  data/cycles.js        per-cycle dRMS, dZCR, dBER for every development, test and
                        location recording, plus the normal reference (mean, SD)
  data/s1s2grid.js      S1/S2 detector results for all 24 settings (development set)
  data/improved.js      per-cycle early-third dRMS, loudest-third dRMS and envelope
                        variation for every recording, plus the final detector's reference
  data/examples.js      three CirCor recordings with their .tsv for Test your own
  js/pcgdetect.js       detector used by Test your own (filter, S1/S2, final detector)
  js/owntest.js         Test your own page (file loading, plots, verdicts)
  figures/              the MATLAB figures from the project

Data provenance
  The data files were exported with a Python port of the MATLAB pipeline
  (loadPCG, firBandpass, cycleFeatures, detectS1S2, scoreS1S2). The port reproduces
  the MATLAB results exactly: 550 normal / 811 murmur development cycles,
  S1/S2 F1 72.4%.
  All other numbers on the site come from the team's MATLAB runs.

Final detector (steps 15-16)
  Early-third dRMS, loudest-third dRMS and envelope steadiness; cycle flagged if
  score > 0.00, murmur if at least 65% of cycles are flagged.
  Test set: 45/50 murmurs caught, 43/50 normals passed, balanced accuracy 0.88
  (development 0.883, cross-validated 0.889). Runs in demoGUI.m and Test your own.
