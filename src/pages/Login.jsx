import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../i18n";

const REQUEST_TIMEOUT_MS = 20_000;

function withTimeout(request, message) {
  return Promise.race([
    request,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
    }),
  ]);
}

function Login() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        "Login timed out. Check your internet connection and Supabase project URL.",
      );

      if (error) {
        setError(error.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setError("Login succeeded, but no user account was returned.");
        return;
      }

      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle(),
        "Profile lookup timed out. Check Supabase database connectivity.",
      );

      if (profileError) {
        setError(profileError.message);
        return;
      }

      if (profile && profile.role === "doctor") {
        navigate("/doctor");
      } else {
        navigate("/patient");
      }
    } catch (loginError) {
      console.error("Login failed:", loginError);
      setError(loginError.message || "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">

      <section className="auth-panel">

        <div className="auth-brand">
          <div className="auth-mark">+</div>

          <div>
            <strong>Clinical CDS</strong>
            <span>Secure decision-support workspace</span>
          </div>
        </div>

        <div className="auth-copy">
          <span>PATIENT AND DOCTOR ACCESS</span>
          <h1>Sign in to your care workspace.</h1>
          <p>
            Patients review AI screening results first. During an in-person visit, a doctor
            can request access using the Patient ID; the patient approves access in their portal.
          </p>
        </div>

      </section>

      <div className="auth-card">

        <Link to="/" className="auth-home-link">← Back to home</Link>

        <div className="auth-card-heading">
          <span>WELCOME BACK</span>
          <h2>Login</h2>
        </div>

        {error && (
          <p className="error">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin}>

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

          <button type="submit" disabled={loading}>
            {loading ? "..." : t("login")}
          </button>

        </form>

        <div className="auth-links">
          <Link to="/forgot-password">
            Forgot password?
          </Link>

          <p>
            Don't have an account?{" "}
            <Link to="/register">
              {t("register")}
            </Link>
          </p>
        </div>

      </div>

    </div>
  );
}

export default Login;
