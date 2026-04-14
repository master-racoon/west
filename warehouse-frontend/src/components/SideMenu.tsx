import { NavLink } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const ownerNavItems = [
  { label: "Configuration", to: "/dashboard/configuration" },
];

const navItems = [
  { label: "Add Stock", to: "/dashboard/add" },
  { label: "Remove Stock", to: "/dashboard/remove" },
  { label: "Transfer Stock", to: "/dashboard/transfer" },
  { label: "Quick Count", to: "/dashboard/quickcount" },
  { label: "Inventory Visibility", to: "/dashboard/inventory" },
];

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }: { isActive: boolean }) => ({
        padding: "10px 24px",
        textDecoration: "none",
        color: isActive ? "#1a73e8" : "#333",
        backgroundColor: isActive ? "#e8f0fe" : "transparent",
        fontWeight: isActive ? 600 : 400,
      })}
    >
      {label}
    </NavLink>
  );
}

export function SideMenu() {
  const { user } = useAuthStore();

  return (
    <nav
      style={{
        width: "250px",
        flexShrink: 0,
        borderRight: "1px solid #e0e0e0",
        padding: "24px 0",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {user?.role === "owner" && (
        <NavItem to="/dashboard/users" label="Users" />
      )}
      {user?.role === "owner" &&
        ownerNavItems.map((item) => (
          <NavItem key={item.to} to={item.to} label={item.label} />
        ))}
      {navItems.map((item) => (
        <NavItem key={item.to} to={item.to} label={item.label} />
      ))}
    </nav>
  );
}
