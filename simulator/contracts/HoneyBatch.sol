// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HoneyBatch {

    struct Batch {
        string batchId;
        string farmer;
        uint256 harvestDate;
        uint256 quantity;
        string status;
    }

    mapping(string => Batch) public batches;

    function createBatch(
        string memory _batchId,
        string memory _farmer,
        uint256 _harvestDate,
        uint256 _quantity
    ) public {
        batches[_batchId] = Batch(
            _batchId,
            _farmer,
            _harvestDate,
            _quantity,
            "Harvested"
        );
    }

    function updateStatus(
        string memory _batchId,
        string memory _newStatus
    ) public {
        batches[_batchId].status = _newStatus;
    }

    function getBatch(
        string memory _batchId
    ) public view returns (Batch memory) {
        return batches[_batchId];
    }
}