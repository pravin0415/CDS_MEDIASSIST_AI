import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useLanguage } from "../i18n";

// Generate unique-looking patient ID
const generatePatientId = () => {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 8; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return `PAT-${code}`;
};

function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [role, setRole] = useState("patient");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    // Check passwords
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    // Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,

      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    // Handle signup error
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Make sure Supabase returned a user
    if (!data.user) {
      setError("Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    const userCode = role === "patient" ? generatePatientId() : null;

    // Insert user profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        full_name: fullName,
        role,
        user_code: userCode,
      }, {
        onConflict: "id",
        ignoreDuplicates: true,
      });

    // Handle profile insertion error
    if (profileError) {
      setError(
        `Account created, but profile creation failed: ${profileError.message}`
      );
      setLoading(false);
      return;
    }

    /*
      If email confirmation is disabled,
      user session will be available immediately.
    */

    if (data.session) {
      navigate(role === "doctor" ? "/doctor" : "/patient");
    } else {
      setMessage(
        "Registration successful. Please check your email to verify your account."
      );
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">

      <section className="auth-panel">

        <div className="auth-brand">
          <div className="auth-mark">+</div>

          <div>
            <strong>Clinical CDS</strong>
            <span>Secure care collaboration</span>
          </div>
        </div>

        <div className="auth-copy">
          <span>CREATE YOUR ACCOUNT</span>
          <h1>Join the Clinical CDS platform.</h1>
          <p>
            Patients can explore AI-assisted screening. Doctor-role accounts can request access
            using a Patient ID during an in-person visit; the patient must approve that request.
            This academic prototype does not verify medical licences.
          </p>
        </div>

      </section>

      <div className="auth-card">

        <Link to="/" className="auth-home-link">← Back to home</Link>

        <div className="auth-card-heading">
          <span>NEW ACCOUNT</span>
          <h2>Create account</h2>
        </div>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        {message && (
          <p className="success">
            {message}
          </p>
        )}

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder={t("fullName")}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <div className="role-selection">
            <label><input type="radio" value="patient" checked={role === "patient"} onChange={(e) => setRole(e.target.value)} /> {t("patient")}</label>
            <label><input type="radio" value="doctor" checked={role === "doctor"} onChange={(e) => setRole(e.target.value)} /> {t("doctor")}</label>
          </div>

          <input
            type="email"
            placeholder={t("email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />


          <input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder={t("password")}
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Creating Account..."
              : t("register")}
          </button>
        </form>

        <p>
          Already have an account?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
