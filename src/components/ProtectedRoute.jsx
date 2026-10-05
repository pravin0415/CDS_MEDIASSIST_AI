import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function ProtectedRoute({ children, requiredRole }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // No logged-in user
        if (!user) {
          setAllowed(false);
          setLoading(false);
          return;
        }

        // Get user's role
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Profile error:", error);
          setAllowed(false);
          setLoading(false);
          return;
        }

        // Check role
        if (profile && profile.role === requiredRole) {
          setAllowed(true);
        } else {
          setAllowed(false);
        }

        setLoading(false);
      } catch (error) {
        console.error("Authentication error:", error);
        setAllowed(false);
        setLoading(false);
      }
    };

    checkUser();
  }, [requiredRole]);

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (!allowed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
