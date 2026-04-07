import { useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        setError("Invalid password. Try again.");
        return;
      }

      if (!response.ok) {
        setError("Login failed. Please try again.");
        return;
      }

      const data = await response.json();
      localStorage.setItem("session_token", data.session_token);
      navigate("/dashboard");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "16px",
      }}
    >
      <h1>Warehouse Login</h1>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        style={{ padding: "8px", width: "240px" }}
      />
      {error && <div style={{ color: "red" }}>{error}</div>}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        style={{ padding: "8px 24px" }}
      >
        {isLoading ? "Logging in…" : "Login"}
      </button>
    </div>
  );
}
