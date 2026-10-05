import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ForgotPassword() {

  const [email, setEmail] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {

    e.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/reset-password`,
        }
      );

    if (error) {
      setError(error.message);
    } else {
      setMessage(
        "Password reset link has been sent to your email."
      );
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">

      <div className="auth-card">

        <div className="auth-card-heading">
          <span>ACCOUNT RECOVERY</span>
          <h2>Forgot password</h2>
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

        <form onSubmit={handleReset}>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>

        </form>

        <Link to="/login">
          Back to login
        </Link>

      </div>

    </div>
  );
}

export default ForgotPassword;
