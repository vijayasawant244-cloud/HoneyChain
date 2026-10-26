// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HoneyBatch {
    enum Role { None, Beekeeper, Processor, Distributor, Lab }

    struct Batch {
        string batchId;
        string beekeeper;
        string hiveId;
        string location;
        uint256 harvestDate;
        uint256 quantity;
        string status;
    }

    struct HealthRecord {
        string condition;
        uint256 confidencePct;
        uint256 estDailyGainGrams;
        uint256 recordedAt;
    }

    struct LabReport {
        address lab;
        bytes32 reportHash;
        bool passed;
        uint256 recordedAt;
    }

    struct Jar {
        string batchId;
        bool registered;
        bool claimed;
        uint256 claimedAt;
    }

    mapping(string => Batch) public batches;
    mapping(string => HealthRecord) public healthRecords;
    mapping(string => LabReport) public labReports;
    mapping(address => Role) public roles;
    mapping(string => address) public batchCreator;
    mapping(bytes32 => Jar) private jars;
    mapping(string => uint256) public jarCount;
    mapping(string => uint256) public claimedCount;
    string[] public batchIds;

    address public owner;

    event HealthRecorded(string batchId, string condition, uint256 confidencePct, uint256 estDailyGainGrams);
    event RoleAssigned(address indexed user, Role role);
    event LabReportRecorded(string batchId, address indexed lab, bytes32 reportHash, bool passed);
    event JarsRegistered(string batchId, uint256 count);
    event JarClaimed(string batchId, bytes32 codeHash, uint256 claimedAt);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can do this");
        _;
    }

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Caller does not have the required role");
        _;
    }

    function assignRole(address _user, Role _role) public onlyOwner {
        require(_user != address(0), "Invalid address");
        roles[_user] = _role;
        emit RoleAssigned(_user, _role);
    }

    function createBatch(
        string memory _batchId,
        string memory _beekeeper,
        string memory _hiveId,
        string memory _location,
        uint256 _harvestDate,
        uint256 _quantity
    ) public onlyRole(Role.Beekeeper) {
        require(bytes(_batchId).length != 0, "Batch ID required");
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists");
        batches[_batchId] = Batch(_batchId, _beekeeper, _hiveId, _location, _harvestDate, _quantity, "Harvested");
        batchCreator[_batchId] = msg.sender;
        batchIds.push(_batchId);
    }

    function getBatch(string memory _batchId) public view returns (
        string memory, string memory, string memory, string memory, uint256, uint256, string memory
    ) {
        Batch memory b = batches[_batchId];
        return (b.batchId, b.beekeeper, b.hiveId, b.location, b.harvestDate, b.quantity, b.status);
    }

    function recordLabReport(
        string memory _batchId,
        bytes32 _reportHash,
        bool _passed
    ) public onlyRole(Role.Lab) {
        require(bytes(batches[_batchId].batchId).length != 0, "Batch does not exist");
        require(labReports[_batchId].recordedAt == 0, "Lab report already recorded");
        labReports[_batchId] = LabReport(msg.sender, _reportHash, _passed, block.timestamp);
        emit LabReportRecorded(_batchId, msg.sender, _reportHash, _passed);
    }

    function getLabReport(string memory _batchId) public view returns (
        address, bytes32, bool, uint256
    ) {
        LabReport memory r = labReports[_batchId];
        return (r.lab, r.reportHash, r.passed, r.recordedAt);
    }

    function updateStatus(string memory _batchId, string memory _newStatus) public {
        require(bytes(batches[_batchId].batchId).length != 0, "Batch does not exist");

        bytes32 current = keccak256(abi.encodePacked(batches[_batchId].status));
        bytes32 next = keccak256(abi.encodePacked(_newStatus));

        if (next == keccak256(abi.encodePacked("Tested"))) {
            require(roles[msg.sender] == Role.Processor, "Only Processor can mark Tested");
            require(current == keccak256(abi.encodePacked("Harvested")), "Batch must be Harvested first");
            require(labReports[_batchId].recordedAt != 0, "Lab report required");
            require(labReports[_batchId].passed, "Lab report did not pass");
        } else if (next == keccak256(abi.encodePacked("Shipped"))) {
            require(roles[msg.sender] == Role.Distributor, "Only Distributor can mark Shipped");
            require(current == keccak256(abi.encodePacked("Tested")), "Batch must be Tested first");
        } else {
            revert("Invalid status");
        }

        batches[_batchId].status = _newStatus;
    }

    function getAllBatchIds() public view returns (string[] memory) {
        return batchIds;
    }

    function setHealth(
        string memory _batchId,
        string memory _condition,
        uint256 _confidencePct,
        uint256 _estDailyGainGrams
    ) public onlyOwner {
        require(bytes(batches[_batchId].batchId).length != 0, "Batch does not exist");
        require(_confidencePct <= 100, "Confidence must be 0-100");
        healthRecords[_batchId] = HealthRecord(_condition, _confidencePct, _estDailyGainGrams, block.timestamp);
        emit HealthRecorded(_batchId, _condition, _confidencePct, _estDailyGainGrams);
    }

    function getHealth(string memory _batchId) public view returns (
        string memory, uint256, uint256, uint256
    ) {
        HealthRecord memory h = healthRecords[_batchId];
        return (h.condition, h.confidencePct, h.estDailyGainGrams, h.recordedAt);
    }

    function registerJars(string memory _batchId, bytes32[] memory _codeHashes) public onlyRole(Role.Beekeeper) {
        require(bytes(batches[_batchId].batchId).length != 0, "Batch does not exist");
        require(batchCreator[_batchId] == msg.sender, "Only the batch creator can do this");
        require(_codeHashes.length > 0, "No codes given");
        require(_codeHashes.length <= 100, "Too many codes at once");
        for (uint256 i = 0; i < _codeHashes.length; i++) {
            require(!jars[_codeHashes[i]].registered, "Code already registered");
            jars[_codeHashes[i]] = Jar(_batchId, true, false, 0);
        }
        jarCount[_batchId] += _codeHashes.length;
        emit JarsRegistered(_batchId, _codeHashes.length);
    }

    function claimJar(string memory _secret) public {
        bytes32 h = keccak256(abi.encodePacked(_secret));
        Jar storage j = jars[h];
        require(j.registered, "Unknown code");
        require(!j.claimed, "Code already used");
        j.claimed = true;
        j.claimedAt = block.timestamp;
        claimedCount[j.batchId] += 1;
        emit JarClaimed(j.batchId, h, block.timestamp);
    }

    function getJarStatus(string memory _secret) public view returns (
        bool, bool, uint256, string memory
    ) {
        Jar memory j = jars[keccak256(abi.encodePacked(_secret))];
        return (j.registered, j.claimed, j.claimedAt, j.batchId);
    }
}