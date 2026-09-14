<<<<<<< HEAD
# JOOUST Voting System

This project contains the backend API, blockchain contract, and frontend dashboard for the JOOUST student voting system.

## Project structure

- `backend/` — Express REST API and business logic
- `contracts/` — Solidity smart contract
- `frontend/` — React + Vite admin and voter portal
- `ignition/` — Hardhat Ignition deployment config
- `scripts/` — helper scripts
- `test/` — Hardhat tests

## Setup

1. Install dependencies from the repo root:
   npm install
2. Copy the environment template if needed:
   cp .env.example .env
3. Update the database, JWT, and blockchain values in `.env`.
4. Start the API:
   npm run server
5. Start the frontend in another terminal:
   cd frontend && npm install && npm run dev

The API runs the SQL files in `migrations/` automatically on startup and records
completed files in the `schema_migrations` table. For a fresh database, create
the configured database first; the migration runner creates the application
tables and indexes. Existing databases are not dropped or reset.

## Useful commands

```bash
npm run typecheck
npm run server
cd frontend && npm run build
npx hardhat compile
```

## Environment variables

Required values are documented in `.env.example`.

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`
- `HARDHAT_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `VOTING_CONTRACT_ADDRESS`
- `PORT`

## Notes

- The backend expects a MySQL database to be available.
- The blockchain service expects a configured contract address and wallet key.
- The frontend expects the API at `http://localhost:3000/api`.
- Hardhat is configured to use the locally installed `solc` package so it does not rely on network access to download a compiler.
=======
# CRYPTOCIVIC
decentralized, blockchain-based online voting platform designed to secure democratic processes, eliminate election fraud, and maximize voter turnout through cryptographic verification. By leveraging distributed ledger technology, the system ensures that every vote is cast securely, recorded immutably, and strictly protects voter anonymity.
>>>>>>> 11c997ccc32b054a2c80029f072264fd9d90ee19
