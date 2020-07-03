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

    uint256[5] theArray = [ 1, 2, 3, 4, 5 ];

    function iterateAndModifyStorageArray(uint256 newNumber) public returns (uint256) {
        uint256[5] storage someArray = theArray;
        for (uint256 i = 0; i < someArray.length; i++) {
            someArray[i] = newNumber;
        }
        return newNumber;
    }
}
