# Hardhat JSON-RPC + artifacts for deploy job (same image, different command).
FROM node:20-bookworm
WORKDIR /app

COPY package.json package-lock.json hardhat.config.js ./
COPY contracts ./contracts
COPY scripts ./scripts

RUN npm ci && npx hardhat compile

EXPOSE 8545

# Default: long-running local chain for the full stack (see deploy/docker-compose.yml).
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0", "--port", "8545"]
