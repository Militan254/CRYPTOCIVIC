import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const JOOUSTVotingModule = buildModule("JOOUSTVotingModule", (m) => {
  const voting = m.contract("JOOUSTVoting");

  return { voting };
});

export default JOOUSTVotingModule;
