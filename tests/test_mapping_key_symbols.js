const { deployContract } = require("../lib/generate_tx");
const { tracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { assert, equal } = require("chai");

// TODO: add symbols here
const symbols = {};

describe("Mapping key symbols", () => {
    let contract;

    before(async () => {
        contract = await deployContract();
    });

    it("should retrieve the key for a simple mapping access", async () => {
        const input_key = 42;
        const receipt = await contract.methods.accessTheMap(input_key).send({});
        const mapping_keys = await retrieveKeysInTrace(receipt, symbols);

        const keys = Object.keys(mapping_keys);
        equal(keys.length, 1, "More than one key was retrieved.");
        equal(keys[0], input_key, "Unexpected key.");
    });
})