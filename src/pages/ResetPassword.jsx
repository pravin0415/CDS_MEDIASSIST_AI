import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

function ResetPassword() {

  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e) => {

    e.preventDefault();

    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.updateUser({
        password: password,
      });

    if (error) {

      setError(error.message);

    } else {

      setMessage(
        "Password updated successfully."
      );

      setTimeout(() => {
        navigate("/login");
      }, 2000);

    }

    setLoading(false);
  };

  return (
    <div className="auth-container">

      <div className="auth-card">

        <div className="auth-card-heading">
          <span>SECURE UPDATE</span>
          <h2>Reset password</h2>
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

        <form onSubmit={handleUpdatePassword}>

          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />

          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Updating..."
              : "Update Password"}
          </button>

        </form>

      </div>

    </div>
  );
}

export default ResetPassword;
