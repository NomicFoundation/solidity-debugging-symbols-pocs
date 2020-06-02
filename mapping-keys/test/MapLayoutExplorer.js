const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { patch_web3 } = require("../lib/patch_web3");
const MapLayoutExplorer = artifacts.require("MapLayoutExplorer");
const util = require("util");

// Patch web3 debug module for ganache
patch_web3(web3);

// Create setup promise
let symbols;
let mapLayoutExplorer;
const setup_promise = compile("contracts/MapLayoutExplorer.sol")
  .then(outputSymbols => {
    symbols = outputSymbols;
    MapLayoutExplorer.bytecode = outputSymbols.bytecode;
    return MapLayoutExplorer.new();
  })
  .then((new_contract) => {
    mapLayoutExplorer = new_contract;
  });



// Traditional Truffle test
contract("MapLayoutExplorer", accounts => {
  before(() => {
    return setup_promise;
  });

  it("Test 1 key", async function() {
    const tracer = createTracer(web3);
    const input_key = 42;

    const result = await mapLayoutExplorer.accessTheMap.sendTransaction(input_key);
    const tx = {
      hash: result.tx,
      to: mapLayoutExplorer.address
    };
    const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

    assert.isDefined(mapping_keys.theMap, "The tested for mapping was not found within the accessed mappings");
    const keys = Object.keys(mapping_keys.theMap);
    assert.equal(keys.length, 1, "Unexpected number of keys.");
    assert.equal(web3.utils.hexToNumber(keys[0]), input_key, "Unexpected key.");
  });

  it("Test 2 keys", async function() {
    const tracer = createTracer(web3);
    const input_key1 = 42;
    const input_key2 = 58;


    const result = await mapLayoutExplorer.accessNestedMap.sendTransaction(input_key1, input_key2);
    const tx = {
      hash: result.tx,
      to: mapLayoutExplorer.address
    };
    const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

    assert.isDefined(mapping_keys.nestedMap, "The tested for mapping was not found within the accessed mappings");
    const keys = Object.keys(mapping_keys.nestedMap);
    assert.equal(keys.length, 1, "Unexpected number of keys.");
    assert.equal(web3.utils.hexToNumber(keys[0]), input_key1, "Unexpected key.");
    const nested_mapping = mapping_keys.nestedMap[keys[0]];
    const keys_nested = Object.keys(nested_mapping);
    assert.equal(keys_nested.length, 1, "Unexpected number of keys in nested mapping.");
    assert.equal(web3.utils.hexToNumber(keys_nested[0]), input_key2, "Unexpected nested key.");
  });

  it("Test dynamically sized key", async function() {
    const tracer = createTracer(web3);
    const input_key = "forty two";

    console.log(util.inspect(symbols));

    const result = await mapLayoutExplorer.accessRedZoneMap.sendTransaction(input_key);
    const tx = {
      hash: result.tx,
      to: mapLayoutExplorer.address
    };
    const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

    console.log(mapping_keys);

    assert.isDefined(mapping_keys.redZoneMap, "The tested for mapping was not found within the accessed mappings");
    assert.isTrue(false, "Test not implemented");
    // const keys = mapping_keys.map(v=>v.key);
    // assert.equal(keys.length, 1, "Unexpected number of keys.");
    // assert.equal(web3.utils.hexToNumber(keys[0]), input_key, "Unexpected key.");
  });
});
