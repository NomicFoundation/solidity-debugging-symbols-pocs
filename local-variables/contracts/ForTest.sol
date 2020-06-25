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
}
