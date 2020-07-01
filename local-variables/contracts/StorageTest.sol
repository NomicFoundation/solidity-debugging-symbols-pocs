// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract StorageTest {

    uint256[] aStorageNumberArray;

    constructor(uint256 aNumber, uint256 repetition) public {
        for (uint256 i = 0; i < repetition; i++) {
            aStorageNumberArray.push(aNumber);
        }
    }

    function inspectStoragePointerToNumbers() public view returns (uint256) {
        uint256[] storage aPointerToNumbers = aStorageNumberArray;
        return aPointerToNumbers.length;
    }

    function pushToStoragePointerToNumbers(uint256 aNumber) public returns (uint256) {
        uint256[] storage aPointerToNumbers = aStorageNumberArray;
        aPointerToNumbers.push(aNumber);
        return aPointerToNumbers.length;
    }
}
