import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Configuration", to: "/dashboard/configuration" },
  { label: "Add Stock", to: "/dashboard/add" },
  { label: "Remove Stock", to: "/dashboard/remove" },
  { label: "Transfer Stock", to: "/dashboard/transfer" },
  { label: "Quick Count", to: "/dashboard/quickcount" },
  { label: "Inventory Visibility", to: "/dashboard/inventory" },
];

export function SideMenu() {
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
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }: { isActive: boolean }) => ({
            padding: "10px 24px",
            textDecoration: "none",
            color: isActive ? "#1a73e8" : "#333",
            backgroundColor: isActive ? "#e8f0fe" : "transparent",
            fontWeight: isActive ? 600 : 400,
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
