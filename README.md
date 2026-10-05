# MediAssist AI

MediAssist AI is a React and Flask healthcare decision-support prototype. It supports structured symptom screening, skin-image screening, chest X-ray finding screening, explainable AI, nearby-care lookup, and patient-approved doctor follow-up. It is not a diagnostic device and does not replace qualified clinical assessment.

## Architecture

```text
Patient portal (React) ──> Supabase Auth / Storage / PostgreSQL
       │                              │
       ├─ symptoms ───────────────────┤
       └─ skin or X-ray upload ───────┘
       │
       └───────────> Flask AI service
                 ┌────────────────────┼─────────────────────┐
                 │                    │                     │
          XGBoost + Tree SHAP  DenseNet + Grad-CAM  MobileNetV2 + Grad-CAM
                 │                    │                     │
                 └──────── decision-support tier + disclaimer ┘

Doctor portal (React) ──> Patient ID access request ──> Patient approval
                              │
                              └──> Records, doctor-authored notes, and reports
```

The three clinical model families are trained on different, unpaired datasets and
label spaces. Consequently, MediAssist does **not** claim feature-level or
probability-level multimodal learning. If outputs from multiple
modalities are supplied for the same case, `/api/cases/synthesize` performs an auditable
**decision-level case synthesis**: it retains every source finding and selects the
most urgent reported tier. It returns neither a combined diagnosis nor a fused
probability.

## Included models and verified artifacts

- Symptom model: `models/symptoms/xgboost_model.pkl`, with its paired 131-feature vocabulary and label encoder. The API creates vectors in the checked-in vocabulary order and explains the selected class with XGBoost native Tree SHAP values.
- Chest X-ray model: `models/chest_xray/mediassist_phase2_best.keras`. Its archive declares a 224×224 RGB input and 14 sigmoid observations. The labels are defined in `backend/ai/chest_predictor.py` in the model-output order.
- Skin model: `models/skin_disease/skin_disease_model.keras`. Its archive declares a 224×224 RGB MobileNetV2 backbone and a 7-class softmax head. Despite earlier project wording, this is **not** an EfficientNet artifact. The class map is in `backend/ai/skin_class_names.py`.

The model archives were inspected structurally. Runtime inference still requires a functioning local Python environment with the dependencies below.

## Features

- Public landing page at `/` with project overview, workflow, safety information, and login/registration links. Authentication lives at `/login` and `/register`.

- Text symptoms → XGBoost prediction → real Tree SHAP feature contributions.
- Voice audio endpoint → local Whisper transcription → vocabulary-normalised symptoms → XGBoost + SHAP.
- Chest X-ray → DenseNet findings → class-targeted Grad-CAM overlay.
- Skin image → MobileNetV2 classification → class-targeted Grad-CAM overlay.
- Decision-support tiers: `CRITICAL`, `HIGH_URGENCY`, `MODERATE`, `MILD`, `UNCERTAIN`, and `OBSERVATIONAL`.
- Patient submissions, doctor-authored notes, and saved reports stored in Supabase.
- Permission-based nearby healthcare-facility search through OpenStreetMap.

## Setup (Windows)

Prerequisites: Node.js 20+ and a supported 64-bit Python release. The committed virtual environment is machine-specific; create a new one rather than relying on it.

```powershell
py -3.10 -m venv backend\venv
backend\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
cd backend\ai
python server.py
```

In another terminal:

```powershell
npm install
npm run dev
```

Create `.env.local` at the project root with the public Supabase values:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

For a new database, apply `supabase/schema.sql` and then the SQL files in `supabase/migrations/` in filename order. For an existing database, apply only migrations not yet run. The latest migration below supersedes the temporary retirement migration if that was applied.

### Patient ID doctor connection (no DOC code)

Apply `supabase/migrations/20261005010000_patient_id_doctor_connection.sql` in Supabase SQL Editor after the consultation tables have been created by the earlier migrations. If you have **not** run `20261005000000_retire_doctor_consultations.sql`, you may skip that temporary retirement file and run this latest migration directly. If you already ran it, this latest migration restores the doctor flow. New and existing doctor-role accounts do not use a DOC code.

The patient screens symptoms or images first. For `CRITICAL`, `HIGH_URGENCY`, `MODERATE`, or `UNCERTAIN` results, nearby care search is available. The patient visits a doctor and gives their Patient ID. In the doctor portal, the doctor enters that ID to request access; **the ID alone never opens records**. The patient sees the account name and approves or declines the request in their own portal. Once approved, the doctor can review submissions, save AI reports, and write follow-up, checkup, or report notes that the patient can read. The patient can revoke access, and the doctor can complete the visit. The app does not verify that a doctor-role account belongs to a licensed clinician; the notes are not an e-prescription or appointment-booking feature. Do not use real patient data without identity/licence checks, privacy controls, and clinical validation.

The patient portal has an emergency-warning checklist before symptom analysis. It is deliberately not a complete triage questionnaire: an emergency warning means seek urgent care immediately, without waiting for the model. The app does not contact emergency services.

Nearby care search offers separate hospital and doctor/clinic views. Each starts at 3 km and expands to 5 km only when the patient chooses. Distances are straight-line GPS estimates, not road travel distances. OpenStreetMap listings are incomplete and do not verify a clinician's licence, availability, or appointment.

### Evaluate the urgent-alert cutoff before changing it

The current 0.40/0.50 values remain **unvalidated engineering thresholds**. To audit alert behaviour, prepare a separate clinician-labelled CSV with columns `modality,predicted_condition,model_score,true_urgent` (`true_urgent` is `0` or `1`; use `symptoms` or `skin` modality). The case-level predictions and labels must come from an independent set, not the training set. Then run:

```powershell
cd backend\ai
python evaluate_urgency_thresholds.py path\to\independent_cases.csv
python -m unittest test_evaluate_urgency_thresholds.py
```

The script compares candidate urgent-alert cutoffs and prints true/false positives, true/false negatives, sensitivity, specificity, and precision. Review false negatives with qualified clinicians and evaluate each modality and relevant population separately before selecting a cutoff. This simple audit does not assess chest-X-ray multi-label logic, calibrate model scores, or establish clinical safety. Do not describe an evaluated threshold as clinically validated without a suitable study and expert review.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Service health and advertised modules |
| GET | `/api/models/status` | Runtime readiness check |
| GET | `/api/ai/symptoms` | Exact symptom vocabulary |
| POST | `/api/predict/symptoms` | Text/selected-symptom prediction and SHAP |
| POST | `/api/predict/voice` | Audio transcription plus symptom prediction |
| POST | `/api/transcribe` | Audio transcription only |
| POST | `/api/predict/chest-xray` | Chest X-ray prediction and Grad-CAM |
| POST | `/api/predict/skin` | Skin-image prediction and Grad-CAM |
| POST | `/api/cases/synthesize` | Decision-level summary of completed modality outputs |
| GET | `/api/nearby-doctors` | OpenStreetMap lookup with `lat`, `lon`, and `kind=hospital` or `kind=doctor` (doctor offices/clinics) |

## Testing and limitations

`npm run build` validates the production React build. Backend test files are under `backend/ai/test_phase*.py` and must be run only after installing a compatible Python environment and all ML dependencies.

The backend intentionally reports model-loading and XAI errors rather than fabricating a result. Image heatmaps are generated in temporary runtime storage. The current patient dashboard uses browser speech-to-text for dictation; the Flask Whisper API is available for an audio-upload client and should be connected before claiming end-user Whisper recording support.

## Medical disclaimer

MediAssist AI provides AI-based screening decision support only, not a confirmed diagnosis. Model scores are not calibrated disease probabilities. A qualified healthcare professional must correlate any result with history, examination, vital signs, and appropriate tests. For severe, worsening, or concerning symptoms, seek urgent professional care.
