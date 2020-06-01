const { deployContract, accessTheMap, accessNestedMap } = require("../lib/generate_tx");
const { patch_web3 } = require("../lib/patch_web3");
const { createTracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { assert } = require("chai");

const Web3 = require("web3");

// TODO: add symbols here
const symbols = [
    {
        bytecodeOffset: [ 176 ]
    },
    {
        bytecodeOffset: [ 193 ]
    },
    {
        bytecodeOffset: [ 254 ]
    },
    {
        bytecodeOffset: [ 551 ]
    },
];

describe("Mapping key symbols", () => {
    let web3;
    let contract;

    before(async () => {
        web3 = new Web3("ws://localhost:8545");
        //TODO: Check that the remote end is served by ganache. geth doesn't need this patch.
        patch_web3(web3);
        contract = await deployContract(web3);
    });

    after(() => {
        web3.currentProvider.disconnect();
    })

    it("should retrieve the key for a simple mapping access", async () => {
        const tracer = createTracer(web3);
        const input_key = 42;
        const receipt = await accessTheMap(contract, input_key);
        const tx = {
            hash: receipt.transactionHash,
            to: contract.options.address
        }
        const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

        const keys = Object.keys(mapping_keys);
        assert.equal(keys.length, 1, "More than one key was retrieved.");
        // FIXME: This is a hack since we're not decoding the key according to its type for now.
        const key_number = Number("0x" + keys[0]);
        assert.equal(key_number, input_key, "Unexpected key.");
    });
})