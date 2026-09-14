import { expect } from "chai";
import { network } from "hardhat";

describe("JOOUSTVoting", function () {

  async function deployVoting() {
    const { ethers } = await network.connect();

    const voting = await ethers.deployContract("JOOUSTVoting");

    return { voting, ethers };
  }

  it("should create a school election", async function () {
    const { voting } = await deployVoting();

    await voting.createElection(
      "School of Informatics Representative",
      "School Representative",
      0,
      7
    );

    const election = await voting.elections(1);

    expect(election.title).to.equal(
      "School of Informatics Representative"
    );

    expect(election.position).to.equal(
      "School Representative"
    );

    expect(election.schoolId).to.equal(7);
  });

  it("should create a university-wide election", async function () {
    const { voting } = await deployVoting();

    await voting.createElection(
      "JOOUST University President",
      "University President",
      1,
      0
    );

    const election = await voting.elections(1);

    expect(election.scope).to.equal(1);
    expect(election.schoolId).to.equal(0);
  });

  it("should prevent a student from voting twice", async function () {
    const { voting, ethers } = await deployVoting();

    await voting.createElection(
      "JOOUST University President",
      "University President",
      1,
      0
    );

    await voting.addCandidate(
      1,
      ethers.keccak256(
        ethers.toUtf8Bytes("Alex Otieno")
      )
    );

    await voting.setElectionStatus(1, 1);

    const voterHash = ethers.keccak256(
      ethers.toUtf8Bytes("TEST001")
    );

    // Register student
    await voting.registerVoter(voterHash, 1);

    // First vote
    await voting.vote(1, 1, voterHash);

    // Second vote must fail
    await expect(
      voting.vote(1, 1, voterHash)
    ).to.be.revertedWith(
      "Student has already voted"
    );
  });

  it("should allow a student to vote in their own school election", async function () {
    const { voting, ethers } = await deployVoting();

    // School 7 election
    await voting.createElection(
      "School of Informatics Representative",
      "School Representative",
      0,
      7
    );

    await voting.addCandidate(
      1,
      ethers.keccak256(
        ethers.toUtf8Bytes("Daniel Onyango")
      )
    );

    await voting.setElectionStatus(1, 1);

    // Student belongs to School 7
    const voterHash = ethers.keccak256(
      ethers.toUtf8Bytes("TEST004")
    );

    await voting.registerVoter(voterHash, 7);

    await voting.vote(1, 1, voterHash);
    expect(
      await voting.getCandidateVotes(1)
    ).to.equal(1);
  });

  it("should reject a student from another school", async function () {
    const { voting, ethers } = await deployVoting();

    // School 7 election
    await voting.createElection(
      "School of Informatics Representative",
      "School Representative",
      0,
      7
    );

    await voting.addCandidate(
      1,
      ethers.keccak256(
        ethers.toUtf8Bytes("Daniel Onyango")
      )
    );

    await voting.setElectionStatus(1, 1);

    // Student belongs to School 1
    const voterHash = ethers.keccak256(
      ethers.toUtf8Bytes("TEST001")
    );

    await voting.registerVoter(voterHash, 1);

    await expect(
      voting.vote(1, 1, voterHash)
    ).to.be.revertedWith(
      "Student not eligible for this school election"
    );
  });

  it("should allow students from different schools to vote in a university election", async function () {
    const { voting, ethers } = await deployVoting();

    await voting.createElection(
      "JOOUST University President",
      "University President",
      1,
      0
    );

    await voting.addCandidate(
      1,
      ethers.keccak256(
        ethers.toUtf8Bytes("Alex Otieno")
      )
    );

    await voting.setElectionStatus(1, 1);

    // Student from School 1
    const student1 = ethers.keccak256(
      ethers.toUtf8Bytes("TEST001")
    );

    // Student from School 7
    const student2 = ethers.keccak256(
      ethers.toUtf8Bytes("TEST004")
    );

    await voting.registerVoter(student1, 1);
    await voting.registerVoter(student2, 7);

    await voting.vote(1, 1, student1);
    await voting.vote(1, 1, student2);

    expect(
      await voting.getCandidateVotes(1)
    ).to.equal(2);
  });

});
