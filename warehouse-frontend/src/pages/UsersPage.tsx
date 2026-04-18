import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useResetPin,
  useUnlockUser,
} from "../hooks/queries/useUsers";

export function UsersPage() {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Redirect non-owners
  if (user?.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const resetPin = useResetPin();
  const unlockUser = useUnlockUser();

  const handleCreate = async () => {
    setFormError(null);
    if (!newName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setFormError("PIN must be exactly 4 digits.");
      return;
    }
    try {
      await createUser.mutateAsync({ name: newName.trim(), pin: newPin });
      setShowForm(false);
      setNewName("");
      setNewPin("");
    } catch (e: any) {
      setFormError(e.message || "Failed to create user.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    await deleteUser.mutateAsync(id);
  };

  const handleResetPin = async (id: string) => {
    const newPinVal = window.prompt("New 4-digit PIN:");
    if (!newPinVal) return;
    if (!/^\d{4}$/.test(newPinVal)) {
      alert("PIN must be exactly 4 digits.");
      return;
    }
    await resetPin.mutateAsync({ id, pin: newPinVal });
  };

  const handleUnlock = async (id: string) => {
    await unlockUser.mutateAsync(id);
  };

  const isLocked = (locked_until: string | null) => {
    if (!locked_until) return false;
    return new Date(locked_until) > new Date();
  };

  return (
    <div style={{ padding: "24px" }}>
      <h2>Users</h2>

      <button
        onClick={() => setShowForm((s) => !s)}
        style={{ marginBottom: "16px", padding: "8px 16px" }}
      >
        {showForm ? "Cancel" : "Add User"}
      </button>

      {showForm && (
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: "6px" }}
          />
          <input
            placeholder="4-digit PIN"
            value={newPin}
            onChange={(e) =>
              setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            maxLength={4}
            inputMode="numeric"
            style={{ padding: "6px", width: "100px" }}
          />
          <button
            onClick={handleCreate}
            disabled={createUser.isPending}
            style={{ padding: "6px 16px" }}
          >
            {createUser.isPending ? "Creating…" : "Create"}
          </button>
          {formError && <span style={{ color: "red" }}>{formError}</span>}
        </div>
      )}

      {isLoading ? (
        <div>Loading users…</div>
      ) : !users || users.length === 0 ? (
        <div>No users yet.</div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Name
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Created
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Status
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: "8px" }}>{u.name}</td>
                <td style={{ padding: "8px" }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: "8px" }}>
                  {isLocked(u.locked_until) ? (
                    <span style={{ color: "red" }}>Locked</span>
                  ) : (
                    <span style={{ color: "green" }}>Active</span>
                  )}
                </td>
                <td style={{ padding: "8px", display: "flex", gap: "8px" }}>
                  <button onClick={() => handleDelete(u.id, u.name)}>
                    Delete
                  </button>
                  <button onClick={() => handleResetPin(u.id)}>
                    Reset PIN
                  </button>
                  {isLocked(u.locked_until) && (
                    <button onClick={() => handleUnlock(u.id)}>Unlock</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
