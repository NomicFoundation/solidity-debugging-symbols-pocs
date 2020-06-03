// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract MapConstructor {

    mapping(string => string) map;
    string originalKey;

    constructor(string memory firstKey, string memory firstValue,
                string memory secondKey, string memory secondValue) public {
        map[firstKey] = firstValue;
        map[secondKey] = secondValue;
        originalKey = firstKey;
    }

    function moveValue(string memory newKey) public {
        map[newKey] = map[originalKey];
        map[originalKey] = "";
        originalKey = newKey;
    }
}
