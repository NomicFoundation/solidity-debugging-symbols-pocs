#!/bin/bash

SOLC="solc"
SOLC_FLAGS="--combined-json abi,asm,ast,bin,bin-runtime,compact-format,devdoc,hashes,interface,metadata,opcodes,srcmap,srcmap-runtime,storage-layout,userdoc"

$SOLC $SOLC_FLAGS contracts/MapLayoutExplorer.sol > artifacts/MapLayoutExplorer.json
$SOLC $SOLC_FLAGS contracts/ASTExplorer.sol > artifacts/ASTExplorer.json
