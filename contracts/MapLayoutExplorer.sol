// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract MapLayoutExplorer {

    mapping(uint256 => address) theMap;
    mapping(uint256 => mapping(uint256 => address)) nestedMap;

    constructor() public {}

    function accessTheMap(uint256 index) public view returns (address) {
        return theMap[index];
    }

    function accessNestedMap(uint256 outerIndex, uint256 innerIndex) public view returns (address) {
        return nestedMap[outerIndex][innerIndex];
    }

}
