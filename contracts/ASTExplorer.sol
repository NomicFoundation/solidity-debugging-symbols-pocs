// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract ASTExplorer {

    // mapping(uint256 => mapping(uint256 => address)) theMap;
    mapping(string => address) anotherMap;

    struct theStruct {
        uint256 yay;
        mapping(uint256 => string) nested;
    }

    mapping(uint256 => theStruct) strangeMap;

    constructor() public {}

    // function accessTheMap(uint256 outerIndex, uint256 innerIndex) public view returns (address) {
    //     return theMap[outerIndex][innerIndex];
    // }

    function accessAnotherMap(string memory someString) public view returns (address) {
        return anotherMap[someString];
    }

    function accessStrangeMap(uint256 strangeIndex, uint256 nestedIndex) public view returns (string memory) {
        return strangeMap[strangeIndex].nested[nestedIndex];
    }

}
