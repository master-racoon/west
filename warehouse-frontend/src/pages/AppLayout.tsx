import { Outlet } from "react-router-dom";
import { SideMenu } from "../components/SideMenu";
import { UserMenu } from "../components/UserMenu";

export function AppLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "8px 24px",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <UserMenu />
      </header>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <SideMenu />
        <main style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
