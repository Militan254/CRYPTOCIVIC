import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL =
  process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";

const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const CONTRACT_ADDRESS =
  process.env.VOTING_CONTRACT_ADDRESS;

if (!PRIVATE_KEY) {
  throw new Error("BLOCKCHAIN_PRIVATE_KEY is not configured");
}

if (!CONTRACT_ADDRESS) {
  throw new Error("VOTING_CONTRACT_ADDRESS is not configured");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = new ethers.NonceManager(
  new ethers.Wallet(
    PRIVATE_KEY,
    provider
  )
);
const abi = [
  "function createElection(string,string,uint8,uint256) external",
  "function addCandidate(uint256,bytes32) external",
  "function setElectionStatus(uint256,uint8) external",
  "function electionCount() view returns (uint256)",
  "function candidateCount() view returns (uint256)"
];

const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  abi,
  wallet
);

async function sendTransaction(
  transaction: Promise<ethers.ContractTransactionResponse>
) {
  const tx = await transaction;
  console.log(`Transaction sent: ${tx.hash}`);
  await tx.wait();
}

async function main() {
  console.log("Setting up blockchain voting data...");

  let electionCount =
    Number(await contract.electionCount());

  let candidateCount =
    Number(await contract.candidateCount());

  console.log(`Current elections: ${electionCount}`);
  console.log(`Current candidates: ${candidateCount}`);

  // ------------------------------------------------------------
  // Election 1
  // ------------------------------------------------------------

  if (electionCount < 1) {
    console.log("Creating school election...");

    await sendTransaction(
      contract.createElection(
        "School of Informatics and Innovative Systems Representative Election",
        "School Representative",
        0,
        7
      )
    );

    electionCount++;
    console.log("School election created.");
  }

  // ------------------------------------------------------------
  // Election 2
  // ------------------------------------------------------------

  if (electionCount < 2) {
    console.log("Creating university election...");

    await sendTransaction(
      contract.createElection(
        "JOOUST University President Election",
        "University President",
        1,
        0
      )
    );

    electionCount++;
    console.log("University election created.");
  }

  // ------------------------------------------------------------
  // Candidate 1
  // ------------------------------------------------------------

  if (candidateCount < 1) {
    console.log("Adding Daniel Onyango as candidate...");

    const candidateHash = ethers.keccak256(
      ethers.toUtf8Bytes("I132G1325824")
    );

    await sendTransaction(
      contract.addCandidate(
        1,
        candidateHash
      )
    );

    candidateCount++;
    console.log("Candidate added.");
  }

  // ------------------------------------------------------------
  // Activate elections
  // ------------------------------------------------------------

  console.log("Activating election 1...");

  await sendTransaction(
    contract.setElectionStatus(1, 1)
  );

  console.log("Election 1 is ACTIVE.");

  console.log("Activating election 2...");

  await sendTransaction(
    contract.setElectionStatus(2, 1)
  );

  console.log("Election 2 is ACTIVE.");

  console.log("Blockchain setup complete.");
}

main().catch((error) => {
  console.error("Blockchain setup failed:", error);
  process.exitCode = 1;
});
