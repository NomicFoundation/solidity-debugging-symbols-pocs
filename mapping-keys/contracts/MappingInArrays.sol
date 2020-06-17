// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract MappingInArrays {

    struct OptionalMapping {
        bool hasMapping;
        mapping(uint256 => address) firstMap;
        uint16 someValue;
        mapping(uint256 => address) secondMap;
        bool isDone;
    }

    mapping(uint256 => address)[5] fixedMapArray;
    mapping(uint256 => mapping(string => address))[5] fixedNestedMapArray;
    mapping(address => mapping(string => address)[5]) nestedMapOfFixedArrays;
    mapping(address => OptionalMapping[5])[10] fixedArrayWithStructs;

    function accessFixedMap(uint index, uint256 key) public view returns (address) {
        return fixedMapArray[index][key];
    }

    function accessFixedNestedMap(uint index, uint256 key, string memory key2) public view returns (address) {
        return fixedNestedMapArray[index][key][key2];
    }

    function accessNestedMapOfFixed(address key, uint index, string memory key2) public view returns (address) {
        return nestedMapOfFixedArrays[key][index][key2];
    }

    function accessFirstMap(uint firstIndex, address key, uint secondIndex, uint key2) public view returns (address) {
        return fixedArrayWithStructs[firstIndex][key][secondIndex].firstMap[key2];
    }

    function accessSecondMap(uint firstIndex, address key, uint secondIndex, uint key2) public view returns (address) {
        return fixedArrayWithStructs[firstIndex][key][secondIndex].secondMap[key2];
    }

}
