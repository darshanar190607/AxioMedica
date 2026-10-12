# Clinical Kinematic Accuracy & Agreement Validation Report
**Standard:** Digital Goniometer (±0.5°) vs BlazePose + MetricEngine

**Total Paired Frames Analyzed:** 300 angle checkpoints across 20 trials  
**Total Repetitions Evaluated:** 216 ground-truth repetitions

## 1. Executive Summary
| Metric | Target Criteria | Observed Value | Status |
| :--- | :--- | :--- | :--- |
| **Mean Absolute Error (MAE)** | $\le 4.5^\circ$ | **1.81^\circ** | **PASS ✓** |
| **Root Mean Square Error (RMSE)** | $\le 5.5^\circ$ | **2.37^\circ** | **PASS ✓** |
| **Bland-Altman Systematic Bias (\bar{d})** | $[-2.0^\circ, +2.0^\circ]$ | **+0.76^\circ** | **PASS ✓** |
| **95% Limits of Agreement (LoA)** | $[-6.5^\circ, +6.5^\circ]$ | **[-3.64^\circ, +5.17^\circ]** | **PASS ✓** |
| **Pearson Correlation ($r$)** | $\ge 0.95$ | **0.9913** | **PASS ✓** |
| **Repetition Counting Accuracy** | $\ge 95.0\%$ | **99.54\%** (Recall: 99.5%) | **PASS ✓** |

## 2. Bland-Altman Agreement Data
- **Mean Difference (Bias):** `+0.76°` (minimal soft-tissue overestimation)
- **Standard Deviation of Differences ($s_d$):** `2.25°`
- **Lower Limit of Agreement (Bias - 1.96·SD):** `-3.64°`
- **Upper Limit of Agreement (Bias + 1.96·SD):** `+5.17°`
- **95% of all camera-derived angle estimates fall within `±4.41°` of clinical goniometry.**

## 3. Repetition Counting Performance
| Total True Reps | Detected Reps | False Negatives | False Positives | Precision | Sensitivity / Recall | Rep Accuracy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 216 | 215 | 1 | 0 | 100.0% | 99.5% | **99.54%** |

## 4. Test Matrix Environmental Robustness Breakdown
| Environmental Dimension | Level | Samples | MAE (deg) | RMSE (deg) | Bias (deg) | 95% LoA (deg) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lighting** | bright | 165 | 1.62° | 2.1° | +0.64° | [-3.29°, +4.57°] |
| **Lighting** | dim | 135 | 2.04° | 2.67° | +0.92° | [-4.00°, +5.84°] |
| **Camera Distance** | 1.8m | 165 | 1.51° | 1.96° | +0.59° | [-3.09°, +4.26°] |
| **Camera Distance** | 1.0m | 60 | 2.02° | 2.54° | +1.04° | [-3.54°, +5.63°] |
| **Camera Distance** | 2.8m | 75 | 2.31° | 2.98° | +0.93° | [-4.65°, +6.51°] |
| **Clothing** | tight | 180 | 1.58° | 2.09° | +0.63° | [-3.29°, +4.55°] |
| **Clothing** | loose | 120 | 2.16° | 2.74° | +0.97° | [-4.07°, +6.01°] |
| **Phone Model** | Pixel 8 | 90 | 1.71° | 2.13° | +0.58° | [-3.45°, +4.62°] |
| **Phone Model** | Samsung S23 | 75 | 1.56° | 2.06° | +0.57° | [-3.34°, +4.48°] |
| **Phone Model** | iPhone 14 | 60 | 1.68° | 2.26° | +0.77° | [-3.43°, +4.97°] |
| **Phone Model** | Budget Android (Helio G99) | 75 | 2.28° | 2.95° | +1.17° | [-4.18°, +6.52°] |

## 5. Detailed 20-Trial Recording Log
| Trial ID | Exercise | Lighting | Distance | Clothing | Phone Model | True | Detected | Rep Acc | Angle MAE | Angle Bias |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `trial_01` | Heel Raise | bright | 1.8m | tight | Pixel 8 | 10 | 10 | 100.0% | 0.97° | +0.06° |
| `trial_02` | Heel Raise | bright | 1.8m | tight | Samsung S23 | 12 | 12 | 100.0% | 0.88° | +0.28° |
| `trial_03` | Heel Raise | bright | 1.8m | loose | iPhone 14 | 10 | 10 | 100.0% | 1.74° | +1.23° |
| `trial_04` | Ankle Pump | bright | 1.0m | tight | Pixel 8 | 15 | 15 | 100.0% | 1.18° | +0.67° |
| `trial_05` | Ankle Pump | bright | 2.8m | tight | Samsung S23 | 10 | 10 | 100.0% | 1.8° | +0.99° |
| `trial_06` | Heel Raise | dim | 1.8m | tight | Pixel 8 | 10 | 10 | 100.0% | 1.55° | +1.15° |
| `trial_07` | Heel Raise | dim | 1.8m | loose | iPhone 14 | 10 | 10 | 100.0% | 1.69° | +0.75° |
| `trial_08` | Ankle Pump | dim | 1.0m | tight | Budget Android (Helio G99) | 12 | 12 | 100.0% | 2.69° | +1.82° |
| `trial_09` | Heel Raise | dim | 2.8m | loose | Budget Android (Helio G99) | 8 | 7 | 87.5% | 3.21° | +1.97° |
| `trial_10` | Ankle Pump | bright | 1.8m | loose | Budget Android (Helio G99) | 10 | 10 | 100.0% | 2.21° | +0.71° |
| `trial_11` | Heel Raise | bright | 1.0m | loose | Pixel 8 | 10 | 10 | 100.0% | 2.37° | +0.69° |
| `trial_12` | Heel Raise | bright | 2.8m | tight | iPhone 14 | 12 | 12 | 100.0% | 2.34° | +0.86° |
| `trial_13` | Ankle Pump | dim | 1.8m | tight | Samsung S23 | 15 | 15 | 100.0% | 1.17° | -0.07° |
| `trial_14` | Ankle Pump | dim | 2.8m | tight | Pixel 8 | 10 | 10 | 100.0% | 2.08° | +0.17° |
| `trial_15` | Heel Raise | bright | 1.8m | tight | iPhone 14 | 10 | 10 | 100.0% | 0.93° | +0.24° |
| `trial_16` | Heel Raise | bright | 1.8m | tight | Budget Android (Helio G99) | 10 | 10 | 100.0% | 1.35° | +0.61° |
| `trial_17` | Heel Raise | dim | 1.0m | loose | Samsung S23 | 10 | 10 | 100.0% | 1.85° | +0.99° |
| `trial_18` | Ankle Pump | dim | 1.8m | loose | Pixel 8 | 12 | 12 | 100.0% | 2.11° | +0.75° |
| `trial_19` | Ankle Pump | bright | 2.8m | loose | Samsung S23 | 10 | 10 | 100.0% | 2.11° | +0.67° |
| `trial_20` | Ankle Pump | dim | 1.8m | tight | Budget Android (Helio G99) | 10 | 10 | 100.0% | 1.97° | +0.74° |

---
*Note: Zero raw video buffers or PII were stored. All evaluations were executed on anonymized 2D/3D joint telemetry.*