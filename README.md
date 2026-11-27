# DSP-Based Analysis and Characterization of Cardiac Sounds

**CEN464 · Group 8 · Section 101 · Fall 2026**

An interactive walkthrough of our project: detecting systolic heart murmurs in children's heart-sound recordings (phonocardiograms) using classical signal processing only, with no machine learning.

**Live site:** https://abdelrahmansotohy.github.io/dsp-cardiac-sounds/

## What's on the site

- **19 steps** covering the whole project: the data, the filter, S1/S2 detection, features, the spectrogram, the murmur detector and the final evaluation. Every step explains the decision we made and why.
- **Live charts** computed in the browser from our real results.
- **Test your own:** load any `.wav` recording (plus its `.tsv` annotation file if you have one) and our detector runs on it in your browser. Nothing is uploaded.

## Results

Tested once on 100 patients the detector had never seen (50 with a murmur, 50 without):

| Measure | Result |
|---|---|
| Murmurs caught (sensitivity) | 45 / 50 (0.90) |
| Healthy hearts passed (specificity) | 43 / 50 (0.86) |
| Balanced accuracy | **0.88** |
| Cross-validated balanced accuracy | 0.889 |

## The pipeline in short

1. FIR band-pass filter, 25–500 Hz, order 400
2. Hilbert-envelope S1/S2 detector (50 ms smoothing, threshold 0.2)
3. Per-heartbeat features, systole minus diastole: early-third ΔRMS, loudest-third ΔRMS, steady envelope
4. Each heartbeat is flagged if its average z-score is above 0
5. A recording is called a murmur if at least 65% of its heartbeats are flagged

## Running it

- **Online:** open the GitHub Pages link above.
- **Offline:** download the repository and double-click `index.html`. No server or internet needed.

## Team

- **Abdelrahman Mohamed Sotohy** (1091268) · [GitHub](https://github.com/AbdelrahmanSotohy) · [LinkedIn](https://www.linkedin.com/in/abdelrahman-sotohy-6986b8369/)
- **Abdelrahman Mohamed Mahmoud** (1093681)

**Faculty:** Dr. Ramsha Ahmed

## Thanks

A big thank you to **Abdelrahman Mohamed Mahmoud**, my teammate, for his work across the whole project and for building the original version of this website. This site is built on his design.

Thank you to **Dr. Ramsha Ahmed** for her guidance and feedback throughout CEN464, and for a project that let us take signal processing from theory to real clinical recordings.

## Data

Recordings and annotations come from the **CirCor DigiScope Phonocardiogram Dataset** (Oliveira et al., 2022), available on [PhysioNet](https://physionet.org/content/circor-heart-sound/). This is a course project, not a medical device.
