import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  loadPatientReports,
  saveAiReport,
} from "../lib/aiReports";
import { useNavigate } from "react-router-dom";
import "../doctor-dashboard.css";
import SeverityBadge from "../components/SeverityBadge";
import ShapViewer from "../components/ShapViewer";
import GradCamViewer from "../components/GradCamViewer";
import { useLanguage } from "../i18n";

function Icon({ name, size = 20 }) {
  const icons = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),

    patients: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
        <path d="M16 4a3 3 0 0 1 0 6" />
        <path d="M18 14c2 .7 3 2.2 3 4" />
      </>
    ),

    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),

    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),

    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),

    lungs: (
      <>
        <path d="M12 5v15" />
        <path d="M12 11c-2-4-5-7-7-7-1 4-2 9 0 12 1 2 4 2 7-1" />
        <path d="M12 11c2-4 5-7 7-7 1 4 2 9 0 12-1 2-4 2-7-1" />
      </>
    ),

    activity: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),

    ai: (
      <>
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <path d="m5.6 5.6 2.1 2.1" />
        <path d="m16.3 16.3 2.1 2.1" />
        <path d="m18.4 5.6-2.1 2.1" />
        <path d="m7.7 16.3-2.1 2.1" />
        <circle cx="12" cy="12" r="4" />
      </>
    ),

    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),

    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

function DoctorDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [patientCode, setPatientCode] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");

  const [doctor, setDoctor] = useState(null);
  const [patient, setPatient] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [consultationRequest, setConsultationRequest] = useState(null);
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [consultationMode, setConsultationMode] = useState("in_person");
  const [noteType, setNoteType] = useState("follow_up");

  const [selectedSubmission, setSelectedSubmission] =
    useState(null);

  const [aiResult, setAiResult] = useState(null);
  const [activeReportId, setActiveReportId] = useState(null);

  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDoctor = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/");
      return null;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, user_code, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "doctor") {
      navigate("/");
      return null;
    }

    setDoctor(profile);

    return profile;
  };

  const updateConsultationStatus = async (nextStatus) => {
    if (!consultationRequest) return;
    const { error: statusError } = await supabase.rpc("set_consultation_status", {
      request_id: consultationRequest.id,
      next_status: nextStatus,
    });
    if (statusError) return setError(statusError.message);
    setConsultationRequest((current) => ({ ...current, status: nextStatus }));
    if (nextStatus === "completed") {
      setPatient(null);
      setSubmissions([]);
      setSavedReports([]);
      setConsultationRequest(null);
      setSelectedSubmission(null);
      setAiResult(null);
    }
    setMessage(`Consultation marked ${nextStatus}.`);
  };

  const searchPatient = async () => {
    setError("");
    setMessage("");
    setPatient(null);
    setSubmissions([]);
    setSavedReports([]);
    setConsultationRequest(null);
    setFollowUpPlan("");
    setSelectedSubmission(null);
    setAiResult(null);
    setActiveReportId(null);

    const code = patientCode.trim().toUpperCase();

    if (!code) {
      setError("Enter a patient ID.");
      return;
    }

    try {
      setSearching(true);

      const currentDoctor = doctor || await getDoctor();

      if (!currentDoctor) return;

      const {
        data,
        error: searchError,
      } = await supabase.rpc(
        "doctor_find_patient",
        {
          search_patient_code: code,
        }
      );

      if (searchError) {
        throw searchError;
      }

      if (!data || data.length === 0) {
        const { error: requestError } = await supabase.rpc("request_patient_connection", {
          search_patient_code: code,
        });
        if (requestError?.message?.includes("already pending or active")) {
          setMessage("A request is already pending. Ask the patient to approve it, then search this Patient ID again.");
          return;
        }
        if (requestError) throw requestError;
        setMessage("Access request sent. Ask the patient to approve it in their portal, then search this Patient ID again.");
        return;
      }

      const foundPatient = data[0];

      setPatient(foundPatient);

      const {
        data: patientSubmissions,
        error: submissionError,
      } = await supabase.rpc(
        "doctor_get_patient_submissions",
        {
          target_patient_id: foundPatient.id,
        }
      );

      if (submissionError) {
        throw submissionError;
      }

      setSubmissions(patientSubmissions || []);
      const { data: requests, error: requestError } = await supabase
        .from("consultation_requests")
        .select("id, decision_tier, status, created_at")
        .eq("patient_id", foundPatient.id)
        .eq("doctor_id", currentDoctor.id)
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1);
      if (requestError) throw requestError;
      setConsultationRequest(requests?.[0] || null);
      setSavedReports(
        await loadPatientReports(foundPatient.id)
      );

      setMessage(
        `${foundPatient.full_name}'s records loaded successfully.`
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const saveClinicalFollowUp = async () => {
    if (!consultationRequest || !patient || !doctor || !followUpPlan.trim()) {
      setError("Enter a clinician follow-up plan before saving.");
      return;
    }
    if (consultationRequest.status !== "accepted") {
      setError("Accept this patient's consultation before saving a clinician follow-up.");
      return;
    }

    try {
      setSavingFollowUp(true);
      const { error: followUpError } = await supabase
        .from("clinician_followups")
        .insert({
          consultation_request_id: consultationRequest.id,
          patient_id: patient.id,
          doctor_id: doctor.id,
          consultation_mode: consultationMode,
          note_type: noteType,
          follow_up_plan: followUpPlan.trim(),
        });
      if (followUpError) throw followUpError;
      setFollowUpPlan("");
      setMessage("Clinician follow-up plan saved for the patient.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to save clinician follow-up plan.");
    } finally {
      setSavingFollowUp(false);
    }
  };

  const openSubmission = (submission) => {
    setSelectedSubmission(submission);
    setAiResult(null);
    setActiveReportId(null);
    setError("");
    setMessage("");
  };

  const openSavedReport = (report) => {
    setAiResult(report.report);
    setActiveReportId(report.id);
    setSelectedSubmission(
      submissions.find(
        (submission) =>
          submission.id === report.submission_id
      ) || null
    );
    setError("");
    setMessage("Saved report opened.");
  };

  const generateAIReport = async () => {
    if (!selectedSubmission || !patient) {
      return;
    }

    setError("");
    setMessage("");
    setAiResult(null);

    try {
      setGenerating(true);

      let imageUrl = null;
      const selectedSymptoms = selectedSubmission.description
        ?.match(/^\[Model symptoms: (.*)\]$/m)?.[1]
        ?.split(" | ")
        .filter(Boolean);

      if (selectedSubmission.file_path) {
        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("medical-files")
            .createSignedUrl(
              selectedSubmission.file_path,
              60
            );

        if (signedUrlError) {
          throw signedUrlError;
        }

        imageUrl = signedUrlData?.signedUrl;
      }

      /*
       * IMPORTANT:
       *
       * React does NOT directly run your Keras models.
       *
       * It sends the submission to your Python AI backend.
       */

      const response = await fetch(
        "http://localhost:8000/api/ai/predict",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            submission_id: selectedSubmission.id,
            patient_id: patient.id,
            submission_type:
              selectedSubmission.submission_type,
            file_path:
              selectedSubmission.file_path,
            file_name:
              selectedSubmission.file_name,
            image_url: imageUrl,
            description:
              selectedSubmission.description,
            selected_symptoms: selectedSymptoms,
          }),
        }
      );

      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(
          failure?.error || "AI server could not process the submission."
        );
      }

      const result = await response.json();

      // This URL is short-lived and only supports comparing the source study
      // with Grad-CAM during the active clinician review session.
      setAiResult({ ...result, source_image_url: imageUrl });
      setActiveReportId(null);

      setMessage(
        "AI report generated successfully."
      );

    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to generate AI report."
      );
    } finally {
      setGenerating(false);
    }
  };

  const saveCurrentReport = async () => {
    if (
      !aiResult ||
      !patient ||
      !selectedSubmission ||
      !doctor
    ) {
      return;
    }

    setError("");
    setMessage("");

    try {
      setSavingReport(true);

      const savedReport = await saveAiReport({
        patientId: patient.id,
        doctorId: doctor.id,
        submission: selectedSubmission,
        report: aiResult,
      });

      setSavedReports((reports) => [
        savedReport,
        ...reports,
      ]);
      setActiveReportId(savedReport.id);
      setMessage("AI report saved. It can be viewed later.");
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          "Unable to save the AI report."
      );
    } finally {
      setSavingReport(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getSubmissionTitle = (type) => {
    if (type === "symptoms") return "Symptoms";
    if (type === "skin_image") return "Skin Image";
    return "Chest X-Ray";
  };

  const getSubmissionIcon = (type) => {
    if (type === "symptoms") return "activity";
    if (type === "skin_image") return "image";
    return "lungs";
  };

  return (
    <div className="doctor-app">

      {/* SIDEBAR */}

      <aside className="doctor-sidebar">

        <div>

          <div className="doctor-logo">

            <div className="doctor-logo-mark">
              +
            </div>

            <div>
              <strong>CLINICAL</strong>
              <span>CDS PLATFORM</span>
            </div>

          </div>

          <div className="doctor-nav-label">
            CLINICAL WORKSPACE
          </div>

          <nav>

            <button
              className={`doctor-nav ${
                activeSection === "dashboard"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("dashboard")}
            >
              <Icon name="grid" />
              {t("overview")}
            </button>

            <button
              className={`doctor-nav ${
                activeSection === "patients"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("patients")}
            >
              <Icon name="patients" />
              {t("patient")}
            </button>

            <button
              className={`doctor-nav ${
                activeSection === "reports"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("reports")}
            >
              <Icon name="ai" />
              {t("reports")}
            </button>

          </nav>

        </div>

        <div className="doctor-sidebar-bottom">

          <div className="doctor-security">
            <Icon name="shield" size={16} />

            <div>
              <strong>Clinical workspace</strong>
              <span>Secure access enabled</span>
            </div>
          </div>

          <button
            className="doctor-signout"
            onClick={logout}
          >
            <Icon name="logout" size={17} />
            {t("logout")}
          </button>

        </div>

      </aside>


      {/* MAIN */}

      <main className="doctor-main">

        {/* TOPBAR */}

        <header className="doctor-topbar">

          <div>
            <span>Clinical workspace</span>
            <strong>Doctor Dashboard</strong>
          </div>

          <div className="doctor-account">

            <div className="doctor-avatar">
              {doctor?.full_name
                ?.charAt(0)
                ?.toUpperCase() || "D"}
            </div>

            <div>
              <strong>
                {doctor?.full_name || "Doctor"}
              </strong>

              <span>Doctor-role account</span>
            </div>

          </div>

        </header>


        {/* HERO */}

        <section className="doctor-hero">

          <div>

            <span className="doctor-eyebrow">
              PATIENT RECORDS
            </span>

            <h1>
              Clinical overview
            </h1>

            <p>
              Search a patient using their unique Patient ID
              after they select your account for consultation to review submitted health information and
              generate AI-assisted reports.
            </p>

            <p>
              Enter the Patient ID during an in-person visit to request access. The patient must approve your request in their own portal before records can be opened. This prototype does not verify medical licences.
            </p>

          </div>

          <div className="doctor-ai-status">

            <div className="ai-status-dot" />

            <div>
              <strong>
                AI Analysis Available
              </strong>

              <span>
                3 clinical models connected
              </span>
            </div>

          </div>

        </section>


        {/* SEARCH */}

        {(activeSection === "dashboard" ||
          activeSection === "patients") && (

        <section className="patient-search-card">

          <div className="search-card-heading">

            <div className="search-icon">
              <Icon name="search" size={21} />
            </div>

            <div>
              <span>
                PATIENT LOOKUP
              </span>

              <h2>
                Find patient or request access
              </h2>
            </div>

          </div>

          <div className="patient-search-form">

            <div className="search-input">

              <span>
                Patient ID
              </span>

              <input
                value={patientCode}
                onChange={(e) =>
                  setPatientCode(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    searchPatient();
                  }
                }}
                placeholder="e.g. PAT-A81F92C3"
              />

            </div>

            <button
              className="search-patient-button"
              onClick={searchPatient}
              disabled={searching}
            >
              <Icon name="search" size={17} />

              {searching
                ? "Searching..."
                : "Find / request access"}
            </button>

          </div>

          <p className="search-hint">
            Enter the Patient ID provided by the patient. An ID alone never grants record access.
          </p>

        </section>

        )}


        {/* MESSAGES */}

        {message && (
          <div className="doctor-message success">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="doctor-message error">
            ! {error}
          </div>
        )}


        {/* PATIENT */}

        {patient && activeSection !== "reports" && (

          <section className="patient-record-section">

            <div className="patient-record-header">

              <div className="patient-record-identity">

                <div className="patient-large-avatar">
                  {patient.full_name
                    ?.charAt(0)
                    ?.toUpperCase()}
                </div>

                <div>

                  <span>
                    PATIENT RECORD
                  </span>

                  <h2>
                    {patient.full_name}
                  </h2>

                  <p>
                    Patient ID:{" "}
                    <strong>
                      {patient.user_code}
                    </strong>
                  </p>

                </div>

              </div>

              <div className="patient-verified">
                <Icon name="shield" size={14} />
                Patient-authorised access
              </div>

            </div>


            {/* SUBMISSIONS */}

            <div className="record-section-title">

              <div>
                <span>
                  MEDICAL SUBMISSIONS
                </span>

                <h3>
                  Submitted health information
                </h3>
              </div>

              <strong>
                {submissions.length} records
              </strong>

            </div>


            <div className="doctor-submissions">

              {submissions.length === 0 ? (

                <div className="no-records">
                  No medical submissions found for this patient.
                </div>

              ) : (

                submissions.map((submission) => (

                  <button
                    className={`doctor-submission ${
                      selectedSubmission?.id ===
                      submission.id
                        ? "selected"
                        : ""
                    }`}
                    key={submission.id}
                    onClick={() =>
                      openSubmission(submission)
                    }
                  >

                    <div className="submission-type-icon">
                      <Icon
                        name={getSubmissionIcon(
                          submission.submission_type
                        )}
                        size={20}
                      />
                    </div>

                    <div className="submission-info">

                      <strong>
                        {getSubmissionTitle(
                          submission.submission_type
                        )}
                      </strong>

                      <span>
                        {submission.file_name ||
                          submission.description ||
                          "Medical submission"}
                      </span>

                    </div>

                    <div className="submission-date">

                      <span>
                        Submitted
                      </span>

                      <time>
                        {new Date(
                          submission.created_at
                        ).toLocaleDateString()}
                      </time>

                    </div>

                    <div className="submission-arrow">
                      →
                    </div>

                  </button>

                ))

              )}

            </div>

          </section>

        )}


        {patient && consultationRequest && activeSection !== "reports" && (
          <section className="clinician-followup-panel">
            <span>DOCTOR-ACCOUNT NOTES</span>
            <p>Patient-approved access · {consultationRequest.decision_tier.replace("_", " ")} screening</p>
            <p>
              Write your own follow-up, checkup instruction, or report summary after examining the patient.
              This prototype does not verify medical licences and these notes are not e-prescriptions.
            </p>
            <label>
              Note type
              <select value={noteType} onChange={(event) => setNoteType(event.target.value)}>
                <option value="follow_up">Follow-up advice</option>
                <option value="checkup">Next checkup</option>
                <option value="report">Report summary</option>
              </select>
            </label>
            <label>
              Visit type
              <select value={consultationMode} onChange={(event) => setConsultationMode(event.target.value)}>
                <option value="in_person">In-person visit</option>
                <option value="video">Video follow-up</option>
                <option value="phone">Phone follow-up</option>
              </select>
            </label>
            <textarea
              value={followUpPlan}
              onChange={(event) => setFollowUpPlan(event.target.value)}
              placeholder="Your assessment and follow-up instructions..."
              maxLength={4000}
            />
            <button className="save-report-button" type="button" onClick={saveClinicalFollowUp}
              disabled={savingFollowUp || !followUpPlan.trim()}>
              {savingFollowUp ? "Saving..." : "Send note to patient"}
            </button>
            <button type="button" onClick={() => updateConsultationStatus("completed")}>Complete visit and close record access</button>
          </section>
        )}


        {/* SAVED REPORTS */}

        {patient &&
          (activeSection === "dashboard" ||
            activeSection === "reports") && (

          <section className="saved-reports-section">

            <div className="saved-reports-header">

              <div>
                <span>
                  SAVED AI REPORTS
                </span>

                <h2>
                  Report history
                </h2>
              </div>

              <strong>
                {savedReports.length} saved
              </strong>

            </div>

            {savedReports.length === 0 ? (

              <div className="no-records">
                Saved AI reports will appear here after review.
              </div>

            ) : (

              <div className="saved-report-list">

                {savedReports.map((report) => (

                  <button
                    className={`saved-report-row ${
                      activeReportId === report.id
                        ? "selected"
                        : ""
                    }`}
                    key={report.id}
                    onClick={() =>
                      openSavedReport(report)
                    }
                  >

                    <div>
                      <strong>
                        {report.prediction}
                      </strong>

                      <span>
                        {report.model ||
                          "Clinical AI Model"}
                      </span>
                    </div>

                    <time>
                      {new Date(
                        report.created_at
                      ).toLocaleString()}
                    </time>

                  </button>

                ))}

              </div>

            )}

          </section>

        )}


        {!patient && activeSection === "reports" && (

          <section className="saved-reports-section">

            <div className="saved-reports-header">
              <div>
                <span>SAVED AI REPORTS</span>
                <h2>Search a patient first</h2>
              </div>
            </div>

            <div className="no-records">
              Enter a Patient ID in Patient Lookup to view
              that patient's saved AI reports.
            </div>

          </section>

        )}


        {/* SELECTED SUBMISSION */}

        {selectedSubmission &&
          activeSection !== "reports" && (

          <section className="clinical-review">

            <div className="review-header">

              <div>

                <span>
                  CLINICAL REVIEW
                </span>

                <h2>
                  {getSubmissionTitle(
                    selectedSubmission.submission_type
                  )}
                </h2>

              </div>

              <div className="review-model">

                <Icon name="ai" size={15} />

                Model ready
              </div>

            </div>


            <div className="review-body">

              {/* SYMPTOMS */}

              {selectedSubmission.submission_type ===
                "symptoms" && (

                <div className="symptom-review">

                  <span>
                    PATIENT DESCRIPTION
                  </span>

                  <div className="symptom-text">
                    {selectedSubmission.description}
                  </div>

                </div>

              )}


              {/* IMAGE */}

              {selectedSubmission.file_path && (

                <div className="image-review">

                  <div className="image-placeholder">

                    <Icon
                      name={getSubmissionIcon(
                        selectedSubmission.submission_type
                      )}
                      size={42}
                    />

                    <span>
                      Medical image selected
                    </span>

                    <small>
                      {selectedSubmission.file_name}
                    </small>

                  </div>

                </div>

              )}


              {/* AI */}

              <div className="ai-action-panel">

                <div className="ai-action-icon">
                  <Icon name="ai" size={22} />
                </div>

                <div className="ai-action-text">

                  <strong>
                    Generate AI clinical report
                  </strong>

                  <span>
                    Run the appropriate trained model against
                    this patient's submission.
                  </span>

                </div>

                <button
                  className="generate-button"
                  onClick={generateAIReport}
                  disabled={generating}
                >

                  <Icon name="ai" size={17} />

                  {generating
                    ? "Analyzing..."
                    : "Generate AI report"}

                </button>

              </div>

            </div>

          </section>

        )}


        {/* AI RESULT */}

        {aiResult && (

          <section className="ai-result-section">

            <div className="ai-result-header">

              <div>

                <span>
                  AI ANALYSIS
                </span>

                <h2>
                  Clinical model result
                </h2>

              </div>

              <div className="ai-generated">
                <Icon name="shield" size={13} />
                AI-assisted
              </div>

            </div>


            <div className="ai-result-content">

              <div className="prediction-main">

                <span>
                  PREDICTED CONDITION
                </span>

                <h1>
                  {aiResult.predicted_disease ||
                    aiResult.prediction ||
                    "Result unavailable"}
                </h1>

                {aiResult.confidence !== undefined && (

                  <div className="confidence">

                    <div className="confidence-top">

                      <span>
                        Model confidence
                      </span>

                      <strong>
                        {(
                          Number(
                            aiResult.confidence
                          ) * 100
                        ).toFixed(1)}
                        %
                      </strong>

                    </div>

                    <div className="confidence-bar">
                      <div
                        style={{
                          width: `${
                            Number(
                              aiResult.confidence
                            ) * 100
                          }%`,
                        }}
                      />
                    </div>

                  </div>

                )}

              </div>


              <div className="model-info">

                <span>
                  MODEL
                </span>

                <strong>
                  {aiResult.model ||
                    aiResult.model_type ||
                    "Clinical AI Model"}
                </strong>

                <small>
                  This result is AI-assisted and should
                  be reviewed by a qualified clinician.
                </small>

              </div>

            </div>

            {aiResult.heatmap_url && (
              <GradCamViewer
                originalUrl={aiResult.source_image_url}
                heatmapUrl={aiResult.heatmap_url}
                targetClass={aiResult.predicted_disease}
                xaiNote={aiResult.xai?.gradcam_note}
              />
            )}

            <SeverityBadge
              decisionSupport={aiResult.decision_support}
              decisionTier={aiResult.decision_tier}
              disclaimer={aiResult.disclaimer}
            />

            {aiResult.xai && aiResult.xai.method === "SHAP" && (
              <ShapViewer xaiData={aiResult.xai} predictedDisease={aiResult.predicted_disease} />
            )}

            {aiResult.xai && (

              <div className="xai-details">

                <div>
                  <span>
                    CLINICAL CONTEXT
                  </span>

                  <p>
                    {aiResult.xai.about}
                  </p>
                </div>

                <div>
                  <span>
                    MODEL SIGNALS
                  </span>

                  <ul>
                    {aiResult.xai.signals?.map((signal) => (
                      <li key={signal}>
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

            )}

            {aiResult.model_type === "symptom_condition" && (
              <p className="symptom-model-note">
                The XGBoost model used the selected symptom terms shown above. Free-text notes are retained for clinician review but are not inferred as model symptoms.
              </p>
            )}

            {aiResult.top_predictions && (

              <div className="top-predictions">

                <span>
                  {aiResult.model_type === "chest_xray_findings"
                    ? "RANKED CHEST FINDINGS"
                    : aiResult.model_type === "symptom_condition"
                      ? "RANKED SYMPTOM-MODEL CONDITIONS"
                    : "TOP PREDICTIONS"}
                </span>

                {aiResult.top_predictions.map((item) => (

                  <div
                    className="top-prediction-row"
                    key={item.label}
                  >
                    <strong>
                      {item.label}
                    </strong>

                    <span>
                      {(
                        Number(item.confidence) * 100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>

                ))}

              </div>

            )}

            <div className="report-actions">

              <button
                className="save-report-button"
                onClick={saveCurrentReport}
                disabled={
                  savingReport ||
                  !selectedSubmission ||
                  Boolean(activeReportId)
                }
              >
                <Icon name="file" size={16} />

                {activeReportId
                  ? "Report saved"
                  : savingReport
                    ? "Saving..."
                    : "Save report"}
              </button>

            </div>

          </section>

        )}


        <footer className="doctor-footer">
          <span>
            Clinical CDS · Doctor-role workspace
          </span>

          <span>
            AI results are decision-support only.
          </span>
        </footer>

      </main>

    </div>
  );
}

export default DoctorDashboard;
