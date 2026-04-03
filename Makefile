.PHONY: help dev stop clean backend frontend docker logs deploy deploy-backend deploy-frontend test test-backend test-e2e test-all context-check

# Default target
help:
	@echo "Available commands:"
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
	@echo "  make deploy     - Deploy all services (backend, frontend)"
	@echo "  make deploy-backend   - Deploy backend API only"
	@echo "  make deploy-frontend  - Deploy frontend only"

# Start all services in correct order
dev:
	@echo "Starting docker-compose..."
	@docker-compose up -d postgres-dev
	@echo "Waiting for database to be ready..."
	@sleep 3
	@echo "Starting backend (this will generate OpenAPI specs)..."
	@cd warehouse-backend && npm run dev &
	@echo "Waiting for backend to generate OpenAPI..."
	@sleep 5
	@echo "Starting frontend..."
	@cd warehouse-frontend && npm run dev
	@echo "All services started!"

# Start backend with docker
backend:
	@echo "Starting docker-compose..."
	@docker-compose up -d postgres-dev
	@echo "Waiting for database to be ready..."
	@sleep 3
	@echo "Starting backend..."
	@cd warehouse-backend && npm run dev

# Start frontend only
frontend:
	@echo "Starting frontend..."
	@cd warehouse-frontend && npm run dev

# Start docker only
docker:
	@echo "Starting docker-compose..."
	@docker-compose up -d postgres-dev
	@echo "Docker services started!"

# Stop all services
stop:
	@echo "Stopping frontend..."
	@pkill -f "vite.*warehouse-frontend" || true
	@echo "Stopping backend..."
	@pkill -f "tsx.*warehouse-backend" || true
	@echo "Stopping docker-compose..."
	@docker-compose down
	@echo "All services stopped!"

# Clean up everything
clean: stop
	@echo "Cleaning up..."
	@docker-compose down -v
	@echo "Cleanup complete!"

# Show logs
logs:
	@echo "=== Docker logs ==="
	@docker-compose logs --tail=50

# Deploy all services to production
deploy: deploy-backend deploy-frontend
	@echo "🚀 All services deployed successfully!"

# Deploy backend API to Cloudflare Pages
deploy-backend:
	@echo "📦 Deploying backend API to Cloudflare Pages..."
	@cd warehouse-backend && npm run deploy
	@echo "✅ Backend API deployed!"

# Deploy frontend to Cloudflare Pages
deploy-frontend:
	@echo "🎨 Deploying frontend to Cloudflare Pages..."
	@cd warehouse-frontend && npm run deploy
	@echo "✅ Frontend deployed!"

# Run all tests
test: test-backend test-e2e
	@echo "✅ All tests completed!"

# Run backend tests with Docker
test-backend:
	@echo "🧪 Running backend tests..."
	@docker-compose --profile test up --abort-on-container-exit --exit-code-from test-runner
	@docker-compose --profile test down
	@echo "✅ Backend tests completed!"

# Run E2E tests with Docker
test-e2e:
	@echo "🎭 Running E2E tests..."
	@docker-compose --profile e2e up --abort-on-container-exit --exit-code-from e2e-runner
	@docker-compose --profile e2e down
	@echo "✅ E2E tests completed!"
	@echo ""
	@echo "📊 View detailed test report:"
	@echo "   cd warehouse-frontend && npx playwright show-report"

# Validate AI context files against actual codebase
context-check:
	@./context-check.sh
