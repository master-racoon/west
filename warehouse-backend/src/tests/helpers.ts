// Test helpers for warehouse backend tests
export async function clearDatabase() {
  // In a real test environment, this would clear the test database
  // For now, it's a placeholder
}

export async function signupUser(role: "owner" | "user" = "user") {
  return {
    id: `test-${role}-${Date.now()}`,
    email: `${role}@test.com`,
    role,
  };
}
