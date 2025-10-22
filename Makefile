.PHONY: help dev prod down logs test shell migrate clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make dev       - Start development environment"
	@echo "  make prod      - Start production environment"
	@echo "  make down      - Stop all containers"
	@echo "  make logs      - View logs (all services)"
	@echo "  make test      - Run tests in container"
	@echo "  make shell     - Open shell in app container"
	@echo "  make migrate   - Run database migrations"
	@echo "  make clean     - Remove all containers, volumes, and images"
	@echo "  make pgadmin   - Start with pgAdmin tool"

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "Application running at http://localhost:3000"
	@echo "Use 'make logs' to view logs"

# Production environment
prod:
	@echo "Starting production environment..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@echo "Production environment started"

# Stop all containers
down:
	@echo "Stopping all containers..."
	docker-compose down

# View logs
logs:
	docker-compose logs -f

logs-app:
	docker-compose logs -f app

logs-postgres:
	docker-compose logs -f postgres

logs-redis:
	docker-compose logs -f redis

# Run tests
test:
	docker-compose exec app npm test

test-watch:
	docker-compose exec app npm run test:watch

test-coverage:
	docker-compose exec app npm run test:coverage

# Open shell
shell:
	docker-compose exec app sh

shell-postgres:
	docker-compose exec postgres psql -U auth_user -d auth_db

shell-redis:
	docker-compose exec redis redis-cli -a ${REDIS_PASSWORD}

# Database migrations
migrate:
	@echo "Running database migrations..."
	docker-compose exec postgres psql -U auth_user -d auth_db -f /docker-entrypoint-initdb.d/001_create_users_table.sql
	docker-compose exec postgres psql -U auth_user -d auth_db -f /docker-entrypoint-initdb.d/002_create_oauth_connections_table.sql
	docker-compose exec postgres psql -U auth_user -d auth_db -f /docker-entrypoint-initdb.d/003_create_two_factor_credentials_table.sql
	docker-compose exec postgres psql -U auth_user -d auth_db -f /docker-entrypoint-initdb.d/004_create_audit_logs_table.sql
	docker-compose exec postgres psql -U auth_user -d auth_db -f /docker-entrypoint-initdb.d/005_create_webauthn_credentials_table.sql
	@echo "Migrations completed"

# Start with pgAdmin
pgadmin:
	@echo "Starting with pgAdmin..."
	docker-compose --profile tools up -d
	@echo "pgAdmin available at http://localhost:5050"

# Clean up everything
clean:
	@echo "Removing all containers, volumes, and images..."
	docker-compose down -v --rmi all
	@echo "Cleanup complete"

# Rebuild containers
rebuild:
	@echo "Rebuilding containers..."
	docker-compose build --no-cache
	@echo "Rebuild complete"

# Health check
health:
	@echo "Checking service health..."
	@curl -f http://localhost:3000/health || echo "App not healthy"
	@docker-compose exec postgres pg_isready -U auth_user -d auth_db || echo "Postgres not ready"
	@docker-compose exec redis redis-cli ping || echo "Redis not ready"
