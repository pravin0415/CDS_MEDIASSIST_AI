import { supabase } from "./supabase";

const REPORT_SELECT =
  "id, patient_id, doctor_id, submission_id, submission_type, prediction, confidence, model, report, created_at";

export async function loadPatientReports(patientId) {
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("ai_reports")
    .select(REPORT_SELECT)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function saveAiReport({
  patientId,
  doctorId,
  submission,
  report,
}) {
  const prediction =
    report.predicted_disease ||
    report.prediction ||
    "Result unavailable";

  const { data, error } = await supabase
    .from("ai_reports")
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      submission_id: submission.id,
      submission_type: submission.submission_type,
      prediction,
      confidence:
        report.confidence === undefined
          ? null
          : Number(report.confidence),
      model:
        report.model ||
        report.model_type ||
        "Clinical AI Model",
      report,
    })
    .select(REPORT_SELECT)
    .maybeSingle();

  if (error) throw error;

  return data;
}
