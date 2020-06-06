// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract MapLayoutExplorer {

    mapping(uint256 => address) theMap;
    mapping(string => uint256) redZoneMap;
    mapping(uint256 => mapping(uint256 => address)) nestedMap;

    struct OptionalMapping {
        bool hasMapping;
        mapping(uint256 => address) maybeMap;
    }

    mapping(uint256 => OptionalMapping) severalMaybeMaps;

    constructor() public {}

    function accessTheMap(uint256 index) public view returns (address) {
        return theMap[index];
    }

    function accessRedZoneMap(string memory key) public view returns (uint256) {
        return redZoneMap[key];
    }

    function accessNestedMap(uint256 outerIndex, uint256 innerIndex) public view returns (address) {
        return nestedMap[outerIndex][innerIndex];
    }

    function accessOneMaybeMap(uint256 maybeIndex, uint256 index) public view returns (address) {
        return severalMaybeMaps[maybeIndex].maybeMap[index];
    }

}
