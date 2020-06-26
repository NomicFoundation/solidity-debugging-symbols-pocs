// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract FunctionCallTest {

    function firstFunction(uint var1) public pure returns (uint256) {
        uint myVariable = 1;
        uint resultVariable = secondFunction(var1);
        return resultVariable + myVariable;
    }

    function secondFunction(uint requiredVar) private pure returns (uint256) {
        uint result = 11;
        if(requiredVar < 10) {
            result -= requiredVar;
        } else {
            result += requiredVar;
        }
        return result;
    }

    function passArray(uint number, uint indexSet, uint toChange) public pure returns(uint) {
        uint[5] memory arrayToGive = [number, number, number, number, number];
        uint[5] memory newArray = changeArray(arrayToGive, indexSet, toChange);
        return number;
    }

    function changeArray(uint[5] memory arr, uint index, uint value) private pure returns(uint[5] memory) {
        arr[index] = value;
        return arr;
    }
}
