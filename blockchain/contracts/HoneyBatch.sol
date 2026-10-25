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

    mapping(string => Batch) public batches;
    mapping(string => HealthRecord) public healthRecords;
    mapping(string => LabReport) public labReports;
    mapping(address => Role) public roles;
    string[] public batchIds;

    address public owner;

    event HealthRecorded(string batchId, string condition, uint256 confidencePct, uint256 estDailyGainGrams);
    event RoleAssigned(address indexed user, Role role);
    event LabReportRecorded(string batchId, address indexed lab, bytes32 reportHash, bool passed);

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
}