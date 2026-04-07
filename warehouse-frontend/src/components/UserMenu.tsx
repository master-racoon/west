import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
    }
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ padding: "6px 12px", cursor: "pointer" }}
      >
        {user.role}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            zIndex: 100,
            minWidth: "120px",
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 16px",
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
