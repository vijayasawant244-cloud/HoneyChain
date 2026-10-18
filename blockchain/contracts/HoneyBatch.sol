// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HoneyBatch {
    struct Batch {
        string batchId;
        string beekeeper;
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

    mapping(string => Batch) public batches;
    mapping(string => HealthRecord) public healthRecords;
    string[] public batchIds;

    address public owner;

    event HealthRecorded(string batchId, string condition, uint256 confidencePct, uint256 estDailyGainGrams);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can do this");
        _;
    }

    function createBatch(
        string memory _batchId,
        string memory _beekeeper,
        uint256 _harvestDate,
        uint256 _quantity
    ) public {
        require(bytes(batches[_batchId].batchId).length == 0, "Batch ID already exists");
        batches[_batchId] = Batch(_batchId, _beekeeper, _harvestDate, _quantity, "Harvested");
        batchIds.push(_batchId);
    }

    function getBatch(string memory _batchId) public view returns (
        string memory, string memory, uint256, uint256, string memory
    ) {
        Batch memory b = batches[_batchId];
        return (b.batchId, b.beekeeper, b.harvestDate, b.quantity, b.status);
    }

    function updateStatus(string memory _batchId, string memory _newStatus) public {
        require(bytes(batches[_batchId].batchId).length != 0, "Batch does not exist");
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