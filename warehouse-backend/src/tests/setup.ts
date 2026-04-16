const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"Backend integration tests require the compose-provided test environment. Run `make test-backend` from the repository root.",
	);
}

const databaseHost = new URL(databaseUrl).hostname;

if (databaseHost !== "neon-proxy-test.localtest.me") {
	throw new Error(
		`Backend integration tests must run through \
make test-backend\
 so they use the isolated compose test database. Received DATABASE_URL host: ${databaseHost}`,
	);
}

export {};
