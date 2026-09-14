import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";

const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

const CONTRACT_ADDRESS = process.env.VOTING_CONTRACT_ADDRESS;

if (!PRIVATE_KEY) {
  throw new Error("BLOCKCHAIN_PRIVATE_KEY is not configured");
}

if (!CONTRACT_ADDRESS) {
  throw new Error("VOTING_CONTRACT_ADDRESS is not configured");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = new ethers.Wallet(
  PRIVATE_KEY,
  provider
);

const votingAbi = [
  "function registerVoter(bytes32 _voterHash, uint256 _schoolId) external",
  "function vote(uint256 _electionId, uint256 _candidateId, bytes32 _voterHash) external",
  "function hasVoted(uint256 _electionId, bytes32 _voterHash) view returns (bool)",
  "function voterRegistered(bytes32 _voterHash) view returns (bool)",
  "function voterSchool(bytes32 _voterHash) view returns (uint256)",
  "function getCandidateVotes(uint256 _candidateId) view returns (uint256)"
];

const votingContract = new ethers.Contract(
  CONTRACT_ADDRESS,
  votingAbi,
  wallet
);

export function createVoterHash(
  registrationNumber: string
): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(registrationNumber)
  );
}

export async function registerVoterOnBlockchain(
  registrationNumber: string,
  schoolId: number
) {
  const voterHash = createVoterHash(
    registrationNumber
  );

  const alreadyRegistered =
    await votingContract.voterRegistered(voterHash);

  if (!alreadyRegistered) {
    const tx = await votingContract.registerVoter(
      voterHash,
      schoolId
    );

    await tx.wait();
  }

  return voterHash;
}

export async function castVoteOnBlockchain(
  electionId: number,
  candidateId: number,
  registrationNumber: string
) {
  const voterHash = createVoterHash(
    registrationNumber
  );

  const tx = await votingContract.vote(
    electionId,
    candidateId,
    voterHash
  );

  const receipt = await tx.wait();

  return {
    transactionHash: receipt.hash,
    voterHash
  };
}
export async function getCandidateVotesOnBlockchain(
  candidateId: number
) {
  return await votingContract.getCandidateVotes(
    candidateId
  );
}
