.PHONY: help verify deploy-prod reset-demo logs

help:
	@echo "Targets:"
	@echo "  verify       — npm ci + compile + run all Hardhat tests"
	@echo "  deploy-prod  — bring up the public-prod stack on the host"
	@echo "  reset-demo   — wipe + redeploy + reseed (manual reset)"
	@echo "  logs         — tail the public-prod compose logs"

verify:
	npm ci
	npm run verify

deploy-prod:
	docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml \
		--env-file /etc/jpmc-evm-poc/secrets.env up -d --build

reset-demo:
	bash deploy/reset-demo.sh

logs:
	docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.prod.yml \
		logs -f --tail=200
