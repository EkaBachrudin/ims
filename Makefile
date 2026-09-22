SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE ?= docker compose
BACKEND := npm --prefix backend
FRONTEND := npm --prefix frontend
AI := npm --prefix ai-agent

.PHONY: help env install setup db-up db-wait db-down db-shell migrate migrate-deploy \
        seed db-reset test-db dev dev-backend dev-frontend dev-ai-agent rag-ingest \
        lint typecheck test build up down logs ps nuke nuke-global

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

## install: install dependency semua service
install: env
	$(BACKEND) install
	$(FRONTEND) install
	$(AI) install

## setup: siapkan .env + install dependency
setup: install

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

## migrate: buat & terapkan migration baru (development)
migrate: db-up
	$(BACKEND) run db:migrate

## migrate-deploy: terapkan migration yang sudah ada
migrate-deploy: db-up
	$(BACKEND) run db:deploy

## seed: isi data awal (user, produk, partner, gudang)
seed: db-up
	$(BACKEND) run db:seed

## db-reset: reset database + migration + seed
db-reset: db-up
	$(BACKEND) run db:reset

## test-db: buat database test (wms_test) untuk integration test
test-db: db-up
	@$(COMPOSE) exec -T db sh -c 'psql -U "$$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='"'"'wms_test'"'"'" | grep -q 1 || createdb -U "$$POSTGRES_USER" wms_test'
	@echo "Database wms_test siap."

# ------------------------------------------------------------ Local dev ----

## dev: jalankan backend + frontend + ai-agent (Ctrl+C untuk berhenti)
dev: db-up
	@echo "Menjalankan backend, frontend, ai-agent. Tekan Ctrl+C untuk berhenti."
	@trap 'kill 0' INT TERM; \
	 $(BACKEND) run dev 2>&1 | sed 's/^/[backend]  /' & \
	 $(FRONTEND) run dev 2>&1 | sed 's/^/[frontend] /' & \
	 $(AI) run dev 2>&1 | sed 's/^/[ai-agent] /' & \
	 wait

## dev-backend: jalankan backend saja
dev-backend: db-up
	$(BACKEND) run dev

## dev-frontend: jalankan frontend saja
dev-frontend:
	$(FRONTEND) run dev

## dev-ai-agent: jalankan ai-agent saja
dev-ai-agent: db-up
	$(AI) run dev

## rag-ingest: embed dokumen SOP ke tabel document_chunks
rag-ingest: db-up
	$(AI) run rag:ingest

# -------------------------------------------------------------- Quality ----

## lint: lint semua service
lint:
	$(BACKEND) run lint
	$(FRONTEND) run lint
	$(AI) run lint

## typecheck: typecheck semua service
typecheck:
	$(BACKEND) run typecheck
	$(FRONTEND) run typecheck
	$(AI) run typecheck

## test: jalankan test semua service
test: test-db
	$(BACKEND) run test
	$(FRONTEND) run test
	$(AI) run test

## build: build produksi semua service
build:
	$(BACKEND) run build
	$(FRONTEND) run build
	$(AI) run build

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
