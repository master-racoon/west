.PHONY: help install i setup sync db-generate db-migrate generate-api check type-check type-check-backend type-check-frontend build build-backend build-frontend dev stop clean backend frontend docker logs deploy deploy-backend deploy-scheduler deploy-frontend test test-backend test-e2e test-all context-check

BACKEND_DIR := warehouse-backend
FRONTEND_DIR := warehouse-frontend
DOCKER_COMPOSE := docker compose

# Default target
help:
	@echo "Available commands:"
	@echo "  make install    - Install backend and frontend dependencies"
	@echo "  make setup      - Install deps, start docker, run migrations, generate API artifacts"
	@echo "  make sync       - Generate backend migrations, apply them, and run frontend API generation"
	@echo "  make db-generate      - Generate Drizzle migrations"
	@echo "  make db-migrate       - Apply local database migrations"
	@echo "  make generate-api     - Run frontend API generation"
	@echo "  make check      - Run sync and type-check across backend + frontend"
	@echo "  make type-check - Run backend and frontend type-checks"
	@echo "  make build      - Build backend and frontend"
	@echo "  make dev        - Start all services (docker, backend, frontend)"
	@echo "  make backend    - Start backend only (with docker)"
	@echo "  make frontend   - Start frontend only"
	@echo "  make docker     - Start docker-compose only"
	@echo "  make stop       - Stop all services"
	@echo "  make clean      - Stop all services and clean up"
	@echo "  make logs       - Show logs from all services"
	@echo "  make test       - Run all tests (backend + e2e)"
	@echo "  make test-backend     - Run backend tests only"
	@echo "  make test-e2e         - Run E2E tests"
	@echo "  make context-check    - Validate AI context files against actual codebase"
	@echo "  make deploy     - Deploy all services (backend, scheduler, frontend)"
	@echo "  make deploy-backend   - Deploy backend API only"
	@echo "  make deploy-scheduler - Deploy scheduler Worker only"
	@echo "  make deploy-frontend  - Deploy frontend only"


# Install all services
install i:
	@echo "Installing all packages"
	@cd $(BACKEND_DIR) && npm i
	@cd $(FRONTEND_DIR) && npm i
	@echo "All services installed!"

# Common setup flow
setup: install docker sync
	@echo "Development environment is ready"

# Schema and generated artifact sync
sync: db-generate db-migrate generate-api
	@echo "Schema and generated artifacts are in sync"

db-generate:
	@echo "Generating backend migrations..."
	@cd $(BACKEND_DIR) && npm run db:generate

db-migrate:
	@echo "Applying backend migrations..."
	@cd $(BACKEND_DIR) && npm run db:migrate

generate-api:
	@echo "Generating frontend API artifacts..."
	@cd $(FRONTEND_DIR) && npm run generate-api

type-check: type-check-backend type-check-frontend
	@echo "Type-check completed"

type-check-backend:
	@echo "Running backend type-check..."
	@cd $(BACKEND_DIR) && npm run type-check

type-check-frontend:
	@echo "Running frontend type-check..."
	@cd $(FRONTEND_DIR) && npm run type-check

check: sync type-check
	@echo "Checks completed"

build: build-backend build-frontend
	@echo "Build completed"

build-backend:
	@echo "Building backend..."
	@cd $(BACKEND_DIR) && npm run build

build-frontend:
	@echo "Building frontend..."
	@cd $(FRONTEND_DIR) && npm run build

# Start all services in correct order
dev:
	@echo "Starting docker-compose..."
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d
	@echo "Starting backend..."
	@cd $(BACKEND_DIR) && npm run dev &
	@echo "Waiting for backend OpenAPI endpoint..."
	@until curl -sf http://127.0.0.1:8788/openapi.json >/dev/null; do \
		echo "Backend not ready yet"; \
		sleep 1; \
	done
	@echo "Generating frontend API artifacts from the running backend..."
	@cd $(FRONTEND_DIR) && npm run generate-api:live
	@echo "Starting frontend..."
	@cd $(FRONTEND_DIR) && npm run dev
	@echo "All services started!"

# Start backend with docker
backend:
	@echo "Starting docker-compose..."
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d
	@echo "Waiting for database to be ready..."
	@sleep 3
	@echo "Starting backend..."
	@cd $(BACKEND_DIR) && npm run dev

# Start frontend only
frontend:
	@echo "Starting frontend..."
	@cd $(FRONTEND_DIR) && npm run dev

# Start docker only
docker:
	@echo "Starting docker-compose..."
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d
	@echo "Docker services started!"

# Stop all services
stop:
	@echo "Stopping frontend..."
	@pkill -f "vite.*warehouse-frontend" || true
	@echo "Stopping backend..."
	@pkill -f "tsx.*warehouse-backend" || true
	@echo "Stopping docker-compose..."
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) down
	@echo "All services stopped!"

# Clean up everything
clean: stop
	@echo "Cleaning up..."
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) down -v
	@echo "Cleanup complete!"

# Show logs
logs:
	@echo "=== Docker logs ==="
	@cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) logs --tail=50

# Deploy all services to production
deploy: deploy-backend deploy-scheduler deploy-frontend
	@echo "🚀 All services deployed successfully!"

# Deploy backend API to Cloudflare Pages
deploy-backend:
	@echo "📦 Deploying backend API to Cloudflare Pages..."
	@cd $(BACKEND_DIR) && npm run deploy
	@echo "✅ Backend API deployed!"

# Deploy scheduler Worker to Cloudflare
deploy-scheduler:
	@echo "⏰ Deploying scheduler Worker to Cloudflare..."
	@cd $(BACKEND_DIR) && npm run scheduler:deploy
	@echo "✅ Scheduler Worker deployed!"

# Deploy frontend to Cloudflare Pages
deploy-frontend:
	@echo "🎨 Deploying frontend to Cloudflare Pages..."
	@cd $(FRONTEND_DIR) && npm run deploy
	@echo "✅ Frontend deployed!"

# Run all tests
test: test-backend test-e2e
	@echo "✅ All tests completed!"

# Run backend tests with Docker
test-backend:
	@echo "🧪 Running backend tests..."
	@$(DOCKER_COMPOSE) --profile test up --abort-on-container-exit --exit-code-from test-runner
	@$(DOCKER_COMPOSE) --profile test down
	@echo "✅ Backend tests completed!"

# Run E2E tests with Docker
test-e2e:
	@echo "🎭 Running E2E tests..."
	@$(DOCKER_COMPOSE) --profile e2e up --abort-on-container-exit --exit-code-from e2e-runner
	@$(DOCKER_COMPOSE) --profile e2e down
	@echo "✅ E2E tests completed!"
	@echo ""
	@echo "📊 View detailed test report:"
	@echo "   cd $(FRONTEND_DIR) && npx playwright show-report"

# Validate AI context files against actual codebase
context-check:
	@./context-check.sh
