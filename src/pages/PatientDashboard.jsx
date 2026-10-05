import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { loadPatientReports } from "../lib/aiReports";
import { useNavigate } from "react-router-dom";
import "../patient-dashboard.css";
import SeverityBadge from "../components/SeverityBadge";
import ShapViewer from "../components/ShapViewer";
import GradCamViewer from "../components/GradCamViewer";
import NearbyFacilities from "../components/NearbyFacilities";
import { useLanguage } from "../i18n";
import { extractLocalizedSymptoms } from "../lib/symptomLanguage";

function Icon({ name, size = 20 }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h6" />
      </>
    ),
    report: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 3-4 3 2 4-6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l3-8 4 16 3-8h4" />
      </>
    ),
    heart: (
      <>
        <path d="M20.8 8.6c0 5.4-8.8 11.4-8.8 11.4S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.8 2.6z" />
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
    copy: (
      <>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
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
      {paths[name]}
    </svg>
  );
}

function PatientDashboard() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [symptoms, setSymptoms] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [profileName, setProfileName] = useState("");

  const [skinFile, setSkinFile] = useState(null);
  const [xrayFile, setXrayFile] = useState(null);

  const [submissions, setSubmissions] = useState([]);
  const [reports, setReports] = useState([]);
  const [consultationRequests, setConsultationRequests] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState([]);
  const [emergencyFlags, setEmergencyFlags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPatient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPatient = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate("/");
        return;
      }

      setUser(user);

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("full_name, user_code, role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        console.error(profileError);
        setError("Unable to load patient profile.");
        return;
      }

      if (!profileData || profileData.role !== "patient") {
        navigate("/");
        return;
      }

      setProfile(profileData);
      setProfileName(profileData.full_name || "");
      await loadSubmissions(user.id);
      await loadReports(user.id);
      await loadDoctorUpdates(user.id);
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async (patientId) => {
    try {
      setReports(await loadPatientReports(patientId));
    } catch (err) {
      console.error(err);
    }
  };

  const loadSubmissions = async (patientId) => {
    const { data, error } = await supabase
      .from("medical_submissions")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSubmissions(data || []);
  };

  const loadDoctorUpdates = async (patientId) => {
    const [{ data: requests, error: requestError }, { data: notes, error: notesError }] = await Promise.all([
      supabase.rpc("list_patient_consultations"),
      supabase.from("clinician_followups")
        .select("id, note_type, consultation_mode, follow_up_plan, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
    ]);
    if (requestError || notesError) {
      setError(requestError?.message || notesError?.message || "Doctor updates could not be loaded.");
      return;
    }
    setConsultationRequests(requests || []);
    setDoctorNotes(notes || []);
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    const refresh = () => loadDoctorUpdates(user.id);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [user?.id]);

  const updateDoctorAccess = async (requestId, nextStatus) => {
    const { error: statusError } = await supabase.rpc("set_consultation_status", {
      request_id: requestId,
      next_status: nextStatus,
    });
    if (statusError) return setError(statusError.message);
    setMessage(nextStatus === "accepted"
      ? "Doctor access approved. You may now give that doctor your Patient ID during your visit."
      : "Doctor access declined or revoked.");
    await loadDoctorUpdates(user.id);
  };

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    clearMessages();

    const nextName = profileName.trim();

    if (!nextName) {
      setError("Full name is required.");
      return;
    }

    try {
      setSavingProfile(true);

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: nextName })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((current) => ({
        ...current,
        full_name: nextName,
      }));

      setMessage("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const submitSymptoms = async () => {
    clearMessages();

    if (!symptoms.trim()) {
      setError("Please type or speak your symptoms before submitting.");
      return;
    }

    const symptomDescription = symptoms.trim();
    const selectedSymptoms = extractLocalizedSymptoms(symptomDescription, language);

    try {
      setUploading(true);
      setAnalysisResult(null);

      const response = await fetch("http://localhost:8000/api/ai/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "symptoms",
          description: symptomDescription,
          selected_symptoms: selectedSymptoms,
        }),
      });
      const analysis = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(analysis?.error || "The symptom analysis service could not process this text.");
      }

      const { data: submission, error } = await supabase
        .from("medical_submissions")
        .insert({
          patient_id: user.id,
          submission_type: "symptoms",
          description: symptomDescription,
          selected_symptoms: selectedSymptoms,
          ai_result: analysis,
        })
        .select("id");

      if (error) throw error;

      setSymptoms("");
      setAnalysisResult({ ...analysis, submission_id: submission?.[0]?.id });
      setMessage("Your symptoms were analysed and the screening result is ready.");

      await loadSubmissions(user.id);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const uploadMedicalImage = async (file, type) => {
    clearMessages();

    if (!file) {
      setError("Please select an image first.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10 MB.");
      return;
    }

    try {
      setUploading(true);
      setAnalysisResult(null);

      // Analyse the selected study immediately. The patient—not a doctor—
      // receives the model output, decision-support tier, and Grad-CAM.
      const formData = new FormData();
      formData.append("file", file);
      const analysisResponse = await fetch(
        type === "skin_image"
          ? "http://localhost:8000/api/predict/skin"
          : "http://localhost:8000/api/predict/chest-xray",
        { method: "POST", body: formData },
      );
      const analysis = await analysisResponse.json().catch(() => null);
      if (!analysisResponse.ok) {
        throw new Error(analysis?.error || "The image analysis service could not process this image.");
      }

      const folder =
        type === "skin_image" ? "skin" : "chest-xray";

      const extension = file.name.split(".").pop();

      const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const filePath = `${user.id}/${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("medical-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: submission, error: databaseError } = await supabase
        .from("medical_submissions")
        .insert({
          patient_id: user.id,
          submission_type: type,
          file_path: filePath,
          file_name: file.name,
          ai_result: analysis,
        })
        .select("id");

      if (databaseError) throw databaseError;

      if (type === "skin_image") {
        setSkinFile(null);
      } else {
        setXrayFile(null);
      }

      setAnalysisResult({
        ...analysis,
        submission_type: type,
        submission_id: submission?.[0]?.id,
        source_image_url: URL.createObjectURL(file),
      });

      setMessage(
        type === "skin_image"
          ? "Skin image analysed and uploaded securely."
          : "Chest X-ray analysed and uploaded securely."
      );

      await loadSubmissions(user.id);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString(language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSubmissionName = (type) => {
    if (type === "symptoms") return t("symptoms");
    if (type === "skin_image") return t("skinImage");
    return t("chestXray");
  };

  const getSubmissionIcon = (type) => {
    if (type === "symptoms") return "activity";
    if (type === "skin_image") return "image";
    return "lungs";
  };

  const copyPatientId = async () => {
    const patientId = profile?.user_code || user?.id;
    if (!patientId || !navigator.clipboard) {
      setError("Patient ID could not be copied. Please copy it manually.");
      return;
    }
    try {
      await navigator.clipboard.writeText(patientId);
      setMessage("Patient ID copied.");
    } catch (copyError) {
      console.error(copyError);
      setError("Patient ID could not be copied. Please copy it manually.");
    }
  };

  const startSpeechInput = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech input is not supported by this browser. Please type your symptoms.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Speech input could not start. Check microphone permission and try again.");
    };
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setSymptoms((current) => [current, spokenText].filter(Boolean).join(" "));
    };
    recognition.start();
  };

  if (loading) {
    return (
      <div className="clinical-loading">
        <div className="loading-brand">
          <div className="brand-mark">+</div>
          <span>CLINICAL CDS</span>
        </div>

        <div className="loading-line" />

        <p>Preparing your secure patient portal...</p>
      </div>
    );
  }

  const patientInitial =
    profile?.full_name?.charAt(0)?.toUpperCase() || "P";

  return (
    <div className="clinical-app">

      {/* SIDEBAR */}

      <aside className="clinical-sidebar">

        <div className="sidebar-top">

          <div className="clinical-logo">
            <div className="logo-mark">
              +
            </div>

            <div>
              <strong>CLINICAL</strong>
              <span>CDS PLATFORM</span>
            </div>
          </div>

          <div className="workspace-label">
            PATIENT PORTAL
          </div>

          <nav>

            <button
              className={`side-link ${
                activeSection === "overview"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("overview")}
            >
              <Icon name="grid" />
              <span>{t("overview")}</span>
            </button>

            <button
              className={`side-link ${
                activeSection === "submissions"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveSection("submissions")
              }
            >
              <Icon name="upload" />
              <span>{t("submissions")}</span>
            </button>

            <button
              className={`side-link ${
                activeSection === "reports"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("reports")}
            >
              <Icon name="report" />
              <span>{t("reports")}</span>
            </button>

            <button
              className={`side-link ${
                activeSection === "profile"
                  ? "active"
                  : ""
              }`}
              onClick={() => setActiveSection("profile")}
            >
              <Icon name="user" />
              <span>{t("profile")}</span>
            </button>

          </nav>

        </div>

        <div className="sidebar-bottom">

          <div className="security-note">
            <div className="security-icon">
              <Icon name="shield" size={16} />
            </div>

            <div>
              <strong>{t("securePortal")}</strong>
              <span>Your data is protected</span>
            </div>
          </div>

          <button
            className="signout-button"
            onClick={logout}
          >
            <Icon name="logout" size={18} />
            {t("logout")}
          </button>

          <div className="sidebar-version">
            Clinical CDS · v1.0
          </div>

        </div>

      </aside>


      {/* CONTENT */}

      <main className="clinical-content">

        {/* TOP BAR */}

        <header className="topbar">

          <div className="breadcrumb">
            {t("patientPortal")}
            <span>/</span>
            <strong>
              {activeSection === "overview" && t("overview")}
              {activeSection === "submissions" && t("submissions")}
              {activeSection === "reports" && t("reports")}
              {activeSection === "profile" && t("profile")}
            </strong>
          </div>

          <div className="topbar-actions">

            <div className="user-menu">

              <div className="user-avatar">
                {patientInitial}
              </div>

              <div className="user-menu-text">
                <strong>{profile?.full_name}</strong>
                <span>{t("patient")}</span>
              </div>

            </div>

          </div>

        </header>


        {/* HERO */}

        {activeSection === "overview" && (

        <section className="welcome-section">

          <div>

            <div className="eyebrow">
              <span className="online-dot" />
              PATIENT ACCOUNT
            </div>

            <h1>
              Good morning,{" "}
              <span>{profile?.full_name?.split(" ")[0]}</span>.
            </h1>

            <p>
              Keep your screening submissions and results in one place.
              This portal does not share them with a doctor.
            </p>

          </div>

          <div className="date-display">
            <span>Today</span>
            <strong>
              {new Date().toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </strong>
          </div>

        </section>

        )}


        {/* PROFILE STRIP */}

        {activeSection !== "profile" && (

        <section className="profile-strip">

          <div className="profile-primary">

            <div className="large-avatar">
              {patientInitial}
            </div>

            <div>
              <span className="profile-label">
                PATIENT PROFILE
              </span>

              <h2>
                {profile?.full_name}
              </h2>

              <div className="verified">
                <Icon name="shield" size={13} />
                Signed-in patient
              </div>
            </div>

          </div>

          <div className="patient-code">

            <span>PATIENT ID</span>

            <div className="code-row">

              <strong>
                {profile?.user_code || user?.id}
              </strong>

              <button
                type="button"
                onClick={copyPatientId}
                title="Copy patient ID"
              >
                <Icon name="copy" size={15} />
              </button>

            </div>

          </div>

          <div className="profile-status">

            <span>ACCOUNT STATUS</span>

            <strong>
              <i />
              Active
            </strong>

          </div>

        </section>

        )}


        {/* MESSAGES */}

        {message && (
          <div className="toast-message success">
            <span>✓</span>
            {message}
            <button onClick={clearMessages}>×</button>
          </div>
        )}

        {error && (
          <div className="toast-message error">
            <span>!</span>
            {error}
            <button onClick={clearMessages}>×</button>
          </div>
        )}


        {/* MEDICAL SUBMISSIONS */}

        {(activeSection === "overview" ||
          activeSection === "submissions") && (

        <section className="submission-section">

          <div className="section-header">

            <div>
              <div className="section-kicker">
                HEALTH DATA
              </div>

              <h2>
                Medical submissions
              </h2>

              <p>
                Submit information for AI screening and review
                your own results here.
              </p>
            </div>

            <div className="secure-label">
              <Icon name="shield" size={14} />
              Secure & private
            </div>

          </div>


          <div className="submission-grid">

            {/* SYMPTOMS */}

            <article className="medical-card symptoms-card">

              <div className="card-top">

                <div className="medical-icon">
                  <Icon name="activity" size={22} />
                </div>

                <span className="card-number">
                  01
                </span>

              </div>

              <div className="card-body">

                <span className="medical-category">
                  CLINICAL INFORMATION
                </span>

                <h3>
                  {t("symptoms")}
                </h3>

                <p>
                  Tell us how you're feeling and describe
                  any symptoms or health concerns.
                </p>

                <fieldset className="red-flag-checklist">
                  <legend>{t("redFlagTitle")}</legend>
                  {[
                    ["breathing", t("redFlagBreathing")],
                    ["chest", t("redFlagChest")],
                    ["stroke", t("redFlagStroke")],
                    ["bleeding", t("redFlagBleeding")],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input type="checkbox" checked={emergencyFlags.includes(key)}
                        onChange={(event) => setEmergencyFlags((current) => event.target.checked
                          ? [...current, key] : current.filter((flag) => flag !== key))} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {emergencyFlags.length > 0 && <div className="emergency-alert" role="alert">{t("redFlagAction")}</div>}

                <textarea
                  value={symptoms}
                  onChange={(e) =>
                    setSymptoms(e.target.value)
                  }
                  placeholder="Type your symptoms, for example: I have cough, fever, chills and feel tired..."
                />

                <button
                  className="speech-input-button"
                  type="button"
                  onClick={startSpeechInput}
                  disabled={listening}
                >
                  {listening ? t("listening") : t("useMicrophone")}
                </button>

              </div>

              <button
                className="primary-action"
                onClick={submitSymptoms}
                disabled={uploading}
              >
                {uploading
                  ? "Submitting..."
                    : t("submitSymptoms")}
                <span>→</span>
              </button>

            </article>


            {/* SKIN */}

            <article className="medical-card skin-card">

              <div className="card-top">

                <div className="medical-icon">
                  <Icon name="image" size={22} />
                </div>

                <span className="card-number">
                  02
                </span>

              </div>

              <div className="card-body">

                <span className="medical-category">
                  DERMATOLOGY
                </span>

                <h3>
                  {t("skinImage")}
                </h3>

                <p>
                  Upload a clear photograph of the
                  affected skin area.
                </p>

                <label className="modern-upload">

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      setSkinFile(
                        e.target.files?.[0] || null
                      )
                    }
                  />

                  <div className="upload-symbol">
                    <Icon name="upload" size={20} />
                  </div>

                  <strong>
                    {skinFile
                      ? skinFile.name
                      : "Select an image"}
                  </strong>

                  <span>
                    JPG, PNG or WEBP · Up to 10 MB
                  </span>

                </label>

              </div>

              <button
                className="primary-action"
                onClick={() =>
                  uploadMedicalImage(
                    skinFile,
                    "skin_image"
                  )
                }
                disabled={uploading || !skinFile}
              >
                {uploading
                  ? "Uploading..."
                    : t("uploadSkin")}
                <span>→</span>
              </button>

            </article>


            {/* X-RAY */}

            <article className="medical-card xray-card">

              <div className="card-top">

                <div className="medical-icon">
                  <Icon name="lungs" size={22} />
                </div>

                <span className="card-number">
                  03
                </span>

              </div>

              <div className="card-body">

                <span className="medical-category">
                  RADIOLOGY
                </span>

                <h3>
                  {t("chestXray")}
                </h3>

                <p>
                  Upload your chest radiograph for
                  clinical assessment.
                </p>

                <label className="modern-upload">

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      setXrayFile(
                        e.target.files?.[0] || null
                      )
                    }
                  />

                  <div className="upload-symbol">
                    <Icon name="upload" size={20} />
                  </div>

                  <strong>
                    {xrayFile
                      ? xrayFile.name
                      : "Select an X-ray"}
                  </strong>

                  <span>
                    JPG, PNG or WEBP · Up to 10 MB
                  </span>

                </label>

              </div>

              <button
                className="primary-action"
                onClick={() =>
                  uploadMedicalImage(
                    xrayFile,
                    "chest_xray"
                  )
                }
                disabled={uploading || !xrayFile}
              >
                {uploading
                  ? "Uploading..."
                    : t("uploadXray")}
                <span>→</span>
              </button>

            </article>

          </div>

          {analysisResult && (
            <section className="patient-screening-result">
              {analysisResult.decision_tier === "CRITICAL" && (
                <div className="emergency-alert" role="alert">{t("redFlagAction")}</div>
              )}
              <SeverityBadge
                decisionSupport={analysisResult.decision_support}
                decisionTier={analysisResult.decision_tier}
                disclaimer={analysisResult.disclaimer}
              />
              <span>{t("aiResult")}</span>
              <h3>{analysisResult.prediction}</h3>
              <p>{t("confidence")}: {(Number(analysisResult.confidence) * 100).toFixed(1)}%. {t("scoreDisclaimer")}</p>

              {analysisResult.matched_symptoms && (
                <p><strong>Recognized from your text:</strong> {analysisResult.matched_symptoms.join(", ") || "No model symptoms recognized"}</p>
              )}
              {analysisResult.xai && analysisResult.xai.method === "SHAP" && (
                <ShapViewer xaiData={analysisResult.xai} predictedDisease={analysisResult.prediction} />
              )}

              {analysisResult.heatmap_url && (
                <GradCamViewer
                  originalUrl={analysisResult.source_image_url}
                  heatmapUrl={analysisResult.heatmap_url}
                  targetClass={analysisResult.prediction}
                  xaiNote={analysisResult.xai?.gradcam_note}
                />
              )}

              <h4>{analysisResult.self_care?.title}</h4>
              {analysisResult.self_care?.steps?.length > 0 && <ul>{analysisResult.self_care.steps.map((step) => <li key={step}>{step}</li>)}</ul>}
              {analysisResult.self_care?.warning && <p className={analysisResult.self_care.level === "urgent" ? "urgent-warning" : "screening-warning"}>{analysisResult.self_care.warning}</p>}

              {["CRITICAL", "HIGH_URGENCY", "MODERATE", "UNCERTAIN"].includes(analysisResult.decision_tier) && (
                <>
                  <p className="urgent-warning">
                    {analysisResult.decision_tier === "CRITICAL"
                      ? "Seek emergency medical care now; do not wait for an online request."
                      : "Consider an in-person assessment. Find nearby care, and show your Patient ID to the doctor you visit. The doctor can request access, which you approve here."}
                  </p>
                  <NearbyFacilities key={analysisResult.submission_id || analysisResult.decision_tier}
                    initialKind={["CRITICAL", "HIGH_URGENCY"].includes(analysisResult.decision_tier) ? "hospital" : "doctor"} />
                </>
              )}
            </section>
          )}

        </section>

        )}

        {(activeSection === "overview" || activeSection === "submissions") && (
          <section className="patient-followup-list">
            <div className="followup-heading">
              <div>
                <div className="section-kicker">DOCTOR CONNECTIONS</div>
                <h2>Access requests and visit notes</h2>
              </div>
              <button type="button" onClick={() => loadDoctorUpdates(user?.id)}>Refresh</button>
            </div>
            <p>
              Your Patient ID identifies your record but does not grant access. After a visit,
              approve only the doctor account you recognize. Doctor accounts are not licence-verified in this prototype.
            </p>
            {consultationRequests.length === 0 && <p>No doctor access requests yet.</p>}
            {consultationRequests.map((request) => (
              <article className="patient-report-card" key={request.id}>
                <h3>{request.doctor_name || "Doctor account"}</h3>
                <p>Screening tier: {request.decision_tier.replace("_", " ")}</p>
                <p>Status: {request.status}</p>
                <time>{formatDate(request.created_at)}</time>
                {request.status === "requested" && (
                  <div>
                    <button type="button" onClick={() => updateDoctorAccess(request.id, "accepted")}>Approve this doctor</button>
                    <button type="button" onClick={() => updateDoctorAccess(request.id, "cancelled")}>Decline</button>
                  </div>
                )}
                {request.status === "accepted" && (
                  <button type="button" onClick={() => updateDoctorAccess(request.id, "cancelled")}>Revoke access</button>
                )}
              </article>
            ))}
            <h3>Notes from your doctor</h3>
            {doctorNotes.length === 0 && <p>No visit notes have been added yet.</p>}
            {doctorNotes.map((note) => (
              <article className="patient-report-card" key={note.id}>
                <h3>{note.note_type.replace("_", " ")}</h3>
                <p>{note.follow_up_plan}</p>
                <small>{note.consultation_mode.replace("_", " ")} · {formatDate(note.created_at)}</small>
              </article>
            ))}
          </section>
        )}


        {/* SAVED REPORTS */}

        {(activeSection === "overview" ||
          activeSection === "reports") && (

        <section className="patient-reports-section">

          <div className="section-header activity-header">

            <div>
              <div className="section-kicker">
                AI REPORTS
              </div>

              <h2>
                Saved reports
              </h2>

            </div>

            <span className="activity-count">
              {reports.length} saved
            </span>

          </div>

          {reports.length === 0 ? (

            <div className="empty-activity">

              <div className="empty-icon">
                <Icon name="report" size={22} />
              </div>

              <div>
                <h3>
                  No saved reports yet
                </h3>

                <p>
                  Historical saved AI reports, if any, will
                  appear here.
                </p>
              </div>

            </div>

          ) : (

            <div className="patient-report-list">

              {reports.map((report) => (

                <article
                  className="patient-report-card"
                  key={report.id}
                >

                  <div>
                    <span>
                      {report.model ||
                        "Clinical AI Model"}
                    </span>

                    <h3>
                      {report.prediction}
                    </h3>

                    {report.confidence !== null && (
                      <strong>
                        {(
                          Number(report.confidence) *
                          100
                        ).toFixed(1)}
                        % model score (not a disease probability)
                      </strong>
                    )}
                  </div>

                  {report.report?.xai?.about && (
                    <p>
                      {report.report.xai.about}
                    </p>
                  )}

                  <time>
                    {formatDate(report.created_at)}
                  </time>

                </article>

              ))}

            </div>

          )}

        </section>

        )}


        {/* PROFILE */}

        {activeSection === "profile" && (

          <section className="patient-profile-section">

            <div className="section-header">

              <div>
                <div className="section-kicker">
                  PROFILE
                </div>

                <h2>
                  Account details
                </h2>

                <p>
                  Keep your account details accurate for
                  your own screening records.
                </p>
              </div>

              <div className="secure-label">
                <Icon name="shield" size={14} />
                Signed in
              </div>

            </div>

            <form
              className="profile-form"
              onSubmit={updateProfile}
            >

              <label>
                <span>Full name</span>
                <input
                  value={profileName}
                  onChange={(e) =>
                    setProfileName(e.target.value)
                  }
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  value={user?.email || ""}
                  disabled
                />
              </label>

              <label>
                <span>Patient ID</span>
                <input
                  value={profile?.user_code || user?.id || ""}
                  disabled
                />
              </label>

              <button
                className="primary-action profile-save"
                disabled={savingProfile}
              >
                {savingProfile
                  ? "Saving..."
                  : "Save profile"}
                <span>→</span>
              </button>

            </form>

          </section>

        )}


        {/* ACTIVITY */}

        {activeSection === "overview" && (

        <section className="activity-section">

          <div className="section-header activity-header">

            <div>
              <div className="section-kicker">
                YOUR ACTIVITY
              </div>

              <h2>
                Recent submissions
              </h2>

            </div>

            <span className="activity-count">
              {submissions.length} total
            </span>

          </div>


          {submissions.length === 0 ? (

            <div className="empty-activity">

              <div className="empty-icon">
                <Icon name="file" size={22} />
              </div>

              <div>
                <h3>
                  No submissions yet
                </h3>

                <p>
                  Your medical submissions will appear
                  here once you upload them.
                </p>
              </div>

            </div>

          ) : (

            <div className="activity-table">

              {submissions.slice(0, 6).map(
                (submission) => (

                  <div
                    className="activity-row"
                    key={submission.id}
                  >

                    <div className="activity-type-icon">
                      <Icon
                        name={getSubmissionIcon(
                          submission.submission_type
                        )}
                        size={18}
                      />
                    </div>

                    <div className="activity-details">

                      <strong>
                        {getSubmissionName(
                          submission.submission_type
                        )}
                      </strong>

                      <span>
                        {submission.file_name ||
                          submission.description ||
                          "Medical submission"}
                      </span>

                    </div>

                    <div className="activity-status">
                      <span>
                        Submitted
                      </span>
                    </div>

                    <time>
                      {formatDate(
                        submission.created_at
                      )}
                    </time>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        )}


        {/* FOOTER */}

        <footer className="clinical-footer">

          <span>
            © 2026 Clinical CDS
          </span>

          <div>
            <span>Privacy</span>
            <span>Security</span>
            <span>Help</span>
          </div>

        </footer>

      </main>

    </div>
  );
}

export default PatientDashboard;
