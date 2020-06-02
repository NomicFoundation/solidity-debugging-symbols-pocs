// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract MapCondition {

    mapping(uint256 => address) trueMap;
    mapping(uint256 => address) falseMap;

    constructor() public {}

    function accessCondition(bool map, uint index) public view returns (address) {
        return getMap(map)[index];
    }

    function getMap(bool map) internal view returns (mapping(uint256 => address) storage) {
        if(map) {
            return trueMap;
        } else {
            return falseMap;
        }
    }
}
