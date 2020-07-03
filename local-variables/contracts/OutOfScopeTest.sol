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

    function conditionArray(bool over3, uint index, uint number) public pure returns (uint256) {
        uint[5] memory arr;
        if(over3) {
            uint[5] memory values = [uint(0), uint(0), uint(0), uint(0), uint(0)];
            for(uint i=0; i<index; i++) {
                values[i] = number;
            }
            arr = values;
        } else {
            uint[5] memory under3 = [uint(0), uint(0), uint(0), uint(0), uint(0)];
            for(uint i=0; i<3; i++) {
                under3[i] = number + index;
            }
            arr = under3;
        }
        return arr[4];
    }

    uint256[3] aNumberArray = [ 30, 40, 50 ];

    function someRandomFunWithStorage() public view returns (uint256) {
        uint myVar1 = 10;
        uint myVar2 = 20;
        {
            uint[3] storage someNumbers = aNumberArray;
            uint myVar1 = someNumbers[0];
            uint localVar = someNumbers[1];
            myVar2 = someNumbers[2];
        }
        return myVar2;
    }
}
