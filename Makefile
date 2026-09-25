SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE ?= docker compose
COMPOSE_DEV := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: help env setup db-up db-wait db-down db-shell migrate migrate-deploy \
        seed shell-backend db-reset test-db \
        dev dev-down dev-logs dev-backend dev-frontend dev-ai-agent \
        rag-ingest \
        lint typecheck test build up down logs ps \
        prod prod-down prod-logs prod-seed prod-rag-ingest \
        nuke nuke-global

## help: tampilkan daftar perintah
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## //' | \
	 awk -F': ' 'BEGIN {printf "\nPerintah tersedia:\n"}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}; END {printf "\n"}'

# ---------------------------------------------------------------- Setup ----

## env: buat .env dari .env.example bila belum ada
env:
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env || cp frontend/.env.example frontend/.env
	@test -f ai-agent/.env || cp ai-agent/.env.example ai-agent/.env
	@echo "File .env siap."

## setup: siapkan .env (dependency diinstall di dalam image Docker)
setup: env

# ------------------------------------------------------------- Database ----

## db-up: jalankan PostgreSQL + pgvector & tunggu sampai healthy
db-up:
	$(COMPOSE) up -d db
	@$(MAKE) --no-print-directory db-wait

## db-wait: tunggu sampai container DB berstatus healthy
db-wait:
	@printf "Menunggu database"
	@until [ "$$($(COMPOSE) ps -q db | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do printf "."; sleep 1; done
	@echo " siap."

## db-down: hentikan container DB (data tetap tersimpan)
db-down:
	$(COMPOSE) down

## db-shell: buka psql di container DB
db-shell:
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

## migrate: buat & terapkan migration baru (development, via Docker)
migrate: env
	$(COMPOSE_DEV) run --rm backend npx prisma migrate dev

## migrate-deploy: terapkan migration yang sudah ada (via Docker)
migrate-deploy: env
	$(COMPOSE_DEV) run --rm backend npx prisma migrate deploy

## seed: isi data awal (user, produk, partner, gudang) via Docker
seed: env
	$(COMPOSE_DEV) run --rm backend sh -c "npx prisma migrate deploy && npm run db:seed"

## shell-backend: buka shell di container backend (Docker dev)
shell-backend: env
	$(COMPOSE_DEV) run --rm backend sh

## db-reset: reset database + migration + seed (via Docker)
db-reset: env
	$(COMPOSE_DEV) run --rm backend npm run db:reset

## test-db: buat database test (wms_test) untuk integration test
test-db: db-up
	@$(COMPOSE) exec -T db sh -c 'psql -U "$$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='"'"'wms_test'"'"'" | grep -q 1 || createdb -U "$$POSTGRES_USER" wms_test'
	@echo "Database wms_test siap."

# ------------------------------------------------------------ Local dev ----
# Development via Docker (hot reload). Ctrl+C untuk berhenti.

## dev: jalankan semua service via Docker + hot reload (Ctrl+C untuk berhenti)
dev: env
	@echo "Menjalankan db + backend + frontend + ai-agent (Docker, hot reload)."
	@echo "Tekan Ctrl+C untuk berhenti."
	$(COMPOSE_DEV) up --build

## dev-down: hentikan stack development (data DB tetap tersimpan)
dev-down:
	$(COMPOSE_DEV) down

## dev-logs: ikuti log semua service development
dev-logs:
	$(COMPOSE_DEV) logs -f --tail=100

## dev-backend: jalankan backend (Docker) beserta dependensinya
dev-backend: env
	$(COMPOSE_DEV) up --build backend

## dev-frontend: jalankan frontend (Docker) beserta dependensinya
dev-frontend: env
	$(COMPOSE_DEV) up --build frontend

## dev-ai-agent: jalankan ai-agent (Docker) beserta dependensinya
dev-ai-agent: env
	$(COMPOSE_DEV) up --build ai-agent

## rag-ingest: embed dokumen SOP ke tabel document_chunks (via Docker)
rag-ingest: env
	$(COMPOSE_DEV) run --rm ai-agent npm run rag:ingest

# -------------------------------------------------------------- Quality ----

## lint: lint semua service (via Docker)
lint: env
	$(COMPOSE_DEV) run --rm --no-deps backend npm run lint
	$(COMPOSE_DEV) run --rm --no-deps frontend npm run lint
	$(COMPOSE_DEV) run --rm --no-deps ai-agent npm run lint

## typecheck: typecheck semua service (via Docker)
typecheck: env
	$(COMPOSE_DEV) run --rm --no-deps backend npm run typecheck
	$(COMPOSE_DEV) run --rm --no-deps frontend npm run typecheck
	$(COMPOSE_DEV) run --rm --no-deps ai-agent npm run typecheck

## test: jalankan test semua service (via Docker)
test: env test-db
	$(COMPOSE_DEV) run --rm backend sh -c 'TEST_DATABASE_URL=$${DATABASE_URL%/*}/wms_test npm run test'
	$(COMPOSE_DEV) run --rm --no-deps frontend npm run test
	$(COMPOSE_DEV) run --rm --no-deps ai-agent npm run test

## build: build produksi semua service (via Docker)
build: env
	$(COMPOSE_DEV) run --rm --no-deps backend npm run build
	$(COMPOSE_DEV) run --rm --no-deps frontend npm run build
	$(COMPOSE_DEV) run --rm --no-deps ai-agent npm run build

# -------------------------------------------------- Docker full stack -----

## up: build & jalankan seluruh stack (detached)
up: env
	$(COMPOSE) up --build -d
	$(COMPOSE) ps

## down: hentikan seluruh stack (data tetap tersimpan)
down:
	$(COMPOSE) down

## logs: ikuti log semua service
logs:
	$(COMPOSE) logs -f --tail=100

## ps: status container
ps:
	$(COMPOSE) ps

# ------------------------------------------------- Docker production -----

## prod: build & jalankan seluruh stack mode production (detached)
prod: env
	$(COMPOSE_PROD) up --build -d
	$(COMPOSE_PROD) ps

## prod-down: hentikan stack production (data DB tetap tersimpan)
prod-down:
	$(COMPOSE_PROD) down

## prod-logs: ikuti log semua service production
prod-logs:
	$(COMPOSE_PROD) logs -f --tail=100

## prod-seed: migration + isi data awal di stack production (DESTRUKTIF, via Docker)
prod-seed: env
	$(COMPOSE_PROD) run --rm --build backend sh -c "npx prisma migrate deploy && npm run db:seed"

## prod-rag-ingest: pastikan schema lalu embed dokumen SOP ke document_chunks (via Docker)
prod-rag-ingest: env
	$(COMPOSE_PROD) run --rm --build backend npx prisma migrate deploy
	$(COMPOSE_PROD) run --rm --build ai-agent npm run rag:ingest

# ----------------------------------------------------------------- Nuke ----

## nuke: HAPUS container + volume DB + image lokal + network proyek ini + dist
nuke:
	$(COMPOSE) down -v --remove-orphans --rmi local
	@rm -rf backend/dist frontend/dist ai-agent/dist
	@echo "Proyek dibersihkan (container, volume DB, image lokal, dist)."

## nuke-global: PERINGATAN - prune seluruh resource Docker yang tidak terpakai (SEMUA proyek)
nuke-global:
	@echo "PERINGATAN: menghapus resource Docker yang tidak terpakai secara GLOBAL."
	@read -p "Lanjutkan? [y/N] " ans; [ "$$ans" = "y" ] || (echo "Dibatalkan."; exit 1)
	docker system prune -af --volumes
