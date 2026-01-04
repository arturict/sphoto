# =============================================================================
# SPhoto Development Makefile
# =============================================================================

.PHONY: dev dev-down dev-logs dev-setup web automation help nuke users stripe-listen

# Default target
help:
	@echo "SPhoto Development Commands"
	@echo "==========================="
	@echo ""
	@echo "Setup:"
	@echo "  make dev-setup    - First-time setup (copy env, create dirs)"
	@echo "  make dev          - Start Immich containers"
	@echo "  make web          - Start web dev server (port 3000)"
	@echo "  make automation   - Start automation server (port 3001)"
	@echo ""
	@echo "Services:"
	@echo "  make immich       - Start only Immich containers"
	@echo "  make immich-down  - Stop Immich containers"
	@echo "  make dev-down     - Stop all containers"
	@echo "  make dev-logs     - Follow container logs"
	@echo ""
	@echo "Testing:"
	@echo "  make users        - List all shared users"
	@echo "  make nuke         - Delete all shared users (for testing)"
	@echo "  make stripe-listen- Forward Stripe webhooks to localhost"
	@echo ""
	@echo "Code Quality:"
	@echo "  make typecheck    - Run TypeScript checks (automation)"
	@echo "  make lint         - Run ESLint (web)"
	@echo "  make clean        - Remove all local data and containers"
	@echo ""
	@echo "Local URLs:"
	@echo "  - Web:          http://localhost:3000"
	@echo "  - Automation:   http://localhost:3001"
	@echo "  - Free Immich:  http://localhost:2283"
	@echo "  - Paid Immich:  http://localhost:2284"
	@echo ""
	@echo "First-time setup:"
	@echo "  1. make dev-setup"
	@echo "  2. make dev"
	@echo "  3. Go to http://localhost:2283, create admin, get API key"
	@echo "  4. Add API key to .env.local as SHARED_FREE_API_KEY"
	@echo "  5. Repeat for http://localhost:2284 (SHARED_PAID_API_KEY)"
	@echo "  6. Start: make web (terminal 1), make automation (terminal 2)"
	@echo ""
	@echo "To test paid subscriptions:"
	@echo "  1. Add Stripe test keys to .env.local"
	@echo "  2. Run: make stripe-listen (in separate terminal)"
	@echo "  3. Use test card: 4242 4242 4242 4242"
	@echo ""

# =============================================================================
# First-time setup
# =============================================================================
dev-setup:
	@echo "Setting up local development environment..."
	@if [ ! -f .env.local ]; then \
		cp .env.local.example .env.local; \
		echo "Created .env.local from template"; \
	else \
		echo ".env.local already exists, skipping"; \
	fi
	@mkdir -p .local/instances/_shared_users
	@mkdir -p .local/free/uploads .local/free/db
	@mkdir -p .local/paid/uploads .local/paid/db
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. Edit .env.local with your settings"
	@echo "  2. Run 'make dev' to start everything"

# =============================================================================
# Full development stack
# =============================================================================
dev: immich
	@echo ""
	@echo "Immich containers started!"
	@echo ""
	@echo "Now start web and automation in separate terminals:"
	@echo "  Terminal 1: make web"
	@echo "  Terminal 2: make automation"
	@echo ""
	@echo "Or use 'make dev-all' to run everything in background (no hot reload)"

dev-all: immich
	@echo "Starting web and automation in background..."
	@cd web && npm install && npm run dev &
	@cd automation && bun install && bun run dev &
	@echo "All services started in background"

dev-down: immich-down
	@echo "All services stopped"

dev-logs:
	docker compose -f docker-compose.local.yml logs -f

# =============================================================================
# Immich containers only
# =============================================================================
immich:
	@echo "Starting Immich containers..."
	@mkdir -p .local/instances/_shared_users
	@mkdir -p .local/free/uploads .local/free/db
	@mkdir -p .local/paid/uploads .local/paid/db
	docker compose -f docker-compose.local.yml up -d

immich-down:
	docker compose -f docker-compose.local.yml down

immich-logs:
	docker compose -f docker-compose.local.yml logs -f

# =============================================================================
# Individual services (run in foreground for hot reload)
# =============================================================================
web:
	@echo "Starting web dev server on http://localhost:3000..."
	@if [ -f .env.local ]; then \
		set -a && . ./.env.local && set +a && cd web && npm install && PORT=3000 npm run dev; \
	else \
		echo "Error: .env.local not found. Run 'make dev-setup' first."; \
		exit 1; \
	fi

automation:
	@echo "Starting automation dev server on http://localhost:3001..."
	@if [ -f .env.local ]; then \
		set -a && . ./.env.local && set +a && cd automation && bun install && PORT=3001 bun run dev; \
	else \
		echo "Error: .env.local not found. Run 'make dev-setup' first."; \
		exit 1; \
	fi

# =============================================================================
# Utilities
# =============================================================================
typecheck:
	cd automation && bun run typecheck

lint:
	cd web && npm run lint

clean:
	docker compose -f docker-compose.local.yml down -v
	rm -rf .local
	@echo "Cleaned up all local data and volumes"

# Delete all shared users (for testing)
nuke:
	@echo "Deleting all shared users..."
	@if [ -f .env.local ]; then \
		. ./.env.local && \
		curl -X POST http://localhost:3001/api/dev/nuke \
			-H "x-api-key: $${ADMIN_API_KEY}" \
			-H "Content-Type: application/json" | jq .; \
	else \
		echo "Error: .env.local not found. Run 'make dev-setup' first."; \
		exit 1; \
	fi

# List all shared users
users:
	@if [ -f .env.local ]; then \
		. ./.env.local && \
		curl -s http://localhost:3001/api/shared/users \
			-H "x-api-key: $${ADMIN_API_KEY}" | jq .; \
	else \
		echo "Error: .env.local not found. Run 'make dev-setup' first."; \
		exit 1; \
	fi

# Forward Stripe webhooks to local automation server
stripe-listen:
	@echo "Forwarding Stripe webhooks to localhost:3001/webhook..."
	@echo "Copy the webhook signing secret to .env.local as STRIPE_WEBHOOK_SECRET"
	@echo ""
	stripe listen --forward-to localhost:3001/webhook
