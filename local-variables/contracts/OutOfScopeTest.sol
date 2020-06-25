// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract OutOfScopeTest {

    function someRandomFun() public pure returns (uint256) {
        uint myVar1 = 10;
        uint myVar2 = 20;
        {
            uint myVar1 = 30;
            uint localVar = 40;
            myVar2 = 50;
        }
        return myVar2;
    }
}
