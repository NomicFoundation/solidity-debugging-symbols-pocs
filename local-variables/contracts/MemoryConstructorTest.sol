// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract MemoryConstructorTest {

    event End();
    string savedString;


    constructor(string memory myStr, uint[3] memory array) public {

        string storage theString = savedString;
        savedString = myStr;
        array[1] = 1337;
        emit End();
    }

}
