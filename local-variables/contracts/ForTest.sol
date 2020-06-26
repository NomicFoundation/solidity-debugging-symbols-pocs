// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract ForTest {

    function multiply(uint times, uint add) public pure returns (uint256) {
        uint counter = 0;
        for(uint i = 0; i<times; i++) {
            counter+=add;
        }
        return counter;
    }

    function fillArray(uint times, uint256 set) public pure returns (uint256) {
        uint256[5] memory array = [uint256(0),uint256(0),uint256(0),uint256(0),uint256(0)];
        for(uint i = 0; i<times; i++) {
            array[i] = set;
        }
        return array[0];
    }
}
