// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract StructOnState {

    mapping(uint=> uint) map1;
    mapping(uint=> Mapp) map2;
    struct Mapp {
        uint di;
        mapping(uint => uint) dos;
    }
    struct MyState {
        Mapp mapp;
        uint16 id;
        mapping(uint => Mapp) mapUU;
        uint id2;
        address add;
        uint8 id3;
        mapping(uint => address) mapUA;
        mapping(uint => mapping(address => uint)) mapMapAU;
        address[] adds;
        bytes8 bId;
        bytes7 bSd;
        mapping(string => uint) mapSU;
    }

    MyState state;

    mapping(uint => MyState) states;

    function setMapUU(uint a, uint b) public {
        state.mapUU[1];
        states[2].mapp.dos[3];
        state.mapMapAU[4][msg.sender];
    }

}