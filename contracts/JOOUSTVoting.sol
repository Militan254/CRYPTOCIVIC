// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract JOOUSTVoting {

    enum ElectionScope {
        SCHOOL,
        UNIVERSITY
    }

    enum ElectionStatus {
        UPCOMING,
        ACTIVE,
        CLOSED
    }

    struct Election {
        uint256 electionId;
        string title;
        string position;
        ElectionScope scope;
        uint256 schoolId;
        ElectionStatus status;
    }

    struct Candidate {
        uint256 candidateId;
        uint256 electionId;
        bytes32 candidateHash;
        uint256 voteCount;
        bool approved;
    }

    // ============================================================
    // ADMINISTRATION
    // ============================================================

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // ============================================================
    // STORAGE
    // ============================================================

    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate) public candidates;

    // electionId => voterHash => whether the voter has voted
    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;

    // voterHash => school ID
    mapping(bytes32 => uint256) public voterSchool;

    // voterHash => whether the voter has been registered
    mapping(bytes32 => bool) public voterRegistered;

    uint256 public electionCount;
    uint256 public candidateCount;

    // ============================================================
    // EVENTS
    // ============================================================

    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        string position,
        ElectionScope scope,
        uint256 schoolId
    );

    event CandidateAdded(
        uint256 indexed candidateId,
        uint256 indexed electionId
    );

    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        bytes32 indexed voterHash
    );

    event VoterRegistered(
        bytes32 indexed voterHash,
        uint256 indexed schoolId
    );

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================================
    // ELECTION MANAGEMENT
    // ============================================================

    function createElection(
        string memory _title,
        string memory _position,
        ElectionScope _scope,
        uint256 _schoolId
    ) external onlyOwner {

        require(
            _scope == ElectionScope.UNIVERSITY || _schoolId > 0,
            "School election requires school"
        );

        electionCount++;

        elections[electionCount] = Election({
            electionId: electionCount,
            title: _title,
            position: _position,
            scope: _scope,
            schoolId: _schoolId,
            status: ElectionStatus.UPCOMING
        });

        emit ElectionCreated(
            electionCount,
            _title,
            _position,
            _scope,
            _schoolId
        );
    }

    // ============================================================
    // CANDIDATE MANAGEMENT
    // ============================================================

    function addCandidate(
        uint256 _electionId,
        bytes32 _candidateHash
    ) external onlyOwner {

        require(
            elections[_electionId].electionId != 0,
            "Election does not exist"
        );

        candidateCount++;

        candidates[candidateCount] = Candidate({
            candidateId: candidateCount,
            electionId: _electionId,
            candidateHash: _candidateHash,
            voteCount: 0,
            approved: true
        });

        emit CandidateAdded(
            candidateCount,
            _electionId
        );
    }

    // ============================================================
    // ELECTION STATUS
    // ============================================================

    function setElectionStatus(
        uint256 _electionId,
        ElectionStatus _status
    ) external onlyOwner {

        require(
            elections[_electionId].electionId != 0,
            "Election does not exist"
        );

        elections[_electionId].status = _status;
    }

    // ============================================================
    // VOTER REGISTRATION
    // ============================================================

    function registerVoter(
        bytes32 _voterHash,
        uint256 _schoolId
    ) external onlyOwner {

        require(
            _schoolId > 0,
            "Invalid school"
        );

        voterSchool[_voterHash] = _schoolId;
        voterRegistered[_voterHash] = true;

        emit VoterRegistered(
            _voterHash,
            _schoolId
        );
    }

    // ============================================================
    // VOTING
    // ============================================================

    function vote(
        uint256 _electionId,
        uint256 _candidateId,
        bytes32 _voterHash
    ) external {

        require(
            elections[_electionId].electionId != 0,
            "Election does not exist"
        );

        require(
            elections[_electionId].status == ElectionStatus.ACTIVE,
            "Election is not active"
        );

        require(
            candidates[_candidateId].electionId == _electionId,
            "Candidate is not in this election"
        );

        require(
            candidates[_candidateId].approved,
            "Candidate is not approved"
        );

        require(
            voterRegistered[_voterHash],
            "Voter is not registered"
        );

        require(
            !hasVoted[_electionId][_voterHash],
            "Student has already voted"
        );

        // University elections are open to registered students
        // from any school.
        //
        // School elections require the voter's registered school
        // to match the election's school.
        require(
            elections[_electionId].scope == ElectionScope.UNIVERSITY ||
            voterSchool[_voterHash] == elections[_electionId].schoolId,
            "Student not eligible for this school election"
        );

        hasVoted[_electionId][_voterHash] = true;

        candidates[_candidateId].voteCount++;

        emit VoteCast(
            _electionId,
            _candidateId,
            _voterHash
        );
    }

    // ============================================================
    // RESULTS
    // ============================================================

    function getCandidateVotes(
        uint256 _candidateId
    ) external view returns (uint256) {

        require(
            candidates[_candidateId].candidateId != 0,
            "Candidate does not exist"
        );

        return candidates[_candidateId].voteCount;
    }
}
