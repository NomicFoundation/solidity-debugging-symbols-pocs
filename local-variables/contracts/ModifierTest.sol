// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract ModifierTest {

    event End();

    modifier myMod() {
        _;
        uint modifierVar = 10;
        emit End();
    }

    function someRandomFun(uint newVar) public myMod returns (uint256) {
        return newVar;
    }


    uint counter = 0;

    modifier Dup() {
        _;
        counter += 1;
        _;
    }

    function duplicatedFunction(uint value) public Dup returns (uint256) {
        if(counter == 0) {
            value = value * 10;
        } else {
            value = value / 2;
        }
        return value;
    }

    modifier memoryArray(uint[3] memory modArray) {
        modArray[1] = 20;
        modArray[2] = 30;
        _;
    }

    function receiveArray(uint[3] memory funcArray) public memoryArray(funcArray) returns (uint256) {
        uint rValue = funcArray[0] + funcArray[1] + funcArray[2];
        return rValue;
    }
}
