import { useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useUserNames } from "../hooks/queries/useUsers";
import { useAuthStore } from "../stores/authStore";

const OWNER_ADMIN_ONLY_MESSAGE =
  "The shared owner login is for administration only. Inventory movements require a personal user account signed in with your own PIN.";

export function LoginPage() {
  const [mode, setMode] = useState<"user" | "owner">("user");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const userNamesQuery = useUserNames();
  const userNames = userNamesQuery.data ?? [];
  const namesLoading = userNamesQuery.isLoading || userNamesQuery.isFetching;

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let body: Record<string, string>;
      if (mode === "owner") {
        body = { password };
      } else {
        if (!userId) {
          setError("Please select your name.");
          return;
        }
        if (!/^\d{4}$/.test(pin)) {
          setError("PIN must be exactly 4 digits.");
          return;
        }
        body = { user_id: userId, pin };
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const responseBody = await response.json().catch(() => null);
      const responseError =
        responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody &&
        typeof responseBody.error === "string"
          ? responseBody.error
          : null;

      if (response.status === 423) {
        setError(
          responseError ||
            "Account locked. Ask an owner to unlock it or try again in 15 minutes.",
        );
        return;
      }
      if (response.status === 401) {
        setError(
          responseError ||
            (mode === "owner"
              ? "Invalid password. Try again."
              : "Invalid PIN. Try again."),
        );
        return;
      }
      if (!response.ok) {
        setError(responseError || "Login failed. Please try again.");
        return;
      }

      const data = responseBody;
      setToken(data.session_token);
      setUser(data.user);
      localStorage.setItem("session_token", data.session_token);
      navigate("/dashboard");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  const toggleMode = () => {
    setMode((m) => (m === "user" ? "owner" : "user"));
    setError(null);
    setPin("");
    setPassword("");
    setUserId("");
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

      {mode === "user" ? (
        <>
          {userNamesQuery.isError && (
            <div style={{ color: "red" }}>Failed to load user list.</div>
          )}
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isLoading || namesLoading}
            style={{ padding: "8px", width: "240px" }}
          >
            <option value="">Select your name</option>
            {userNames.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="4-digit PIN"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            maxLength={4}
            inputMode="numeric"
            style={{ padding: "8px", width: "240px" }}
          />
        </>
      ) : (
        <>
          <div style={{ width: "240px", color: "#555", fontSize: "14px" }}>
            {OWNER_ADMIN_ONLY_MESSAGE}
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{ padding: "8px", width: "240px" }}
          />
        </>
      )}

      {error && <div style={{ color: "red" }}>{error}</div>}

      <button
        onClick={handleLogin}
        disabled={isLoading}
        style={{ padding: "8px 24px" }}
      >
        {isLoading ? "Logging in…" : "Login"}
      </button>

      <button
        onClick={toggleMode}
        style={{
          background: "none",
          border: "none",
          color: "#1a73e8",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        {mode === "user" ? "Login as owner" : "Back to PIN login"}
      </button>
    </div>
  );
}
