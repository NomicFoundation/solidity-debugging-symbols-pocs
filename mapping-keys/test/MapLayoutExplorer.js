const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { patch_web3 } = require("../lib/patch_web3");
const MapLayoutExplorer = artifacts.require("MapLayoutExplorer");

// Traditional Truffle test
contract("Test1", accounts => {
  it("Test 1 key", async function() {
    patch_web3(web3);

    const symbols = await compile("contracts/MapLayoutExplorer.sol");
    MapLayoutExplorer.bytecode = symbols.bytecode;
    const mapLayoutExplorer = await MapLayoutExplorer.new();

    const tracer = createTracer(web3);
    const input_key = 42;


    const result = await mapLayoutExplorer.accessTheMap.sendTransaction(input_key);
    const tx = {
      hash: result.tx,
      to: mapLayoutExplorer.address
    };
    const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

      const keys = mapping_keys.map(v=>v.key);
      assert.equal(keys.length, 1, "More than one key was retrieved.");
      assert.equal(web3.utils.hexToNumber(keys[0]), input_key, "Unexpected key.");
  });
});

// Traditional Truffle test
contract("Test2", accounts => {
  it("Test 2 keys", async function() {
    patch_web3(web3);

    const symbols = await compile("contracts/MapLayoutExplorer.sol");
    MapLayoutExplorer.bytecode = symbols.bytecode;
    const mapLayoutExplorer = await MapLayoutExplorer.new();

    const tracer = createTracer(web3);
    const input_key1 = 42;
    const input_key2 = 58;


    const result = await mapLayoutExplorer.accessNestedMap.sendTransaction(input_key1, input_key2);
    const tx = {
      hash: result.tx,
      to: mapLayoutExplorer.address
    };
    const mapping_keys = await retrieveKeysInTrace(tx, symbols, tracer);

    const keys = mapping_keys.map(v=>v.key);
    assert.equal(keys.length, 2, "More than one key was retrieved.");
    assert.equal(web3.utils.hexToNumber(keys[0]), input_key1, "Unexpected key.");
    assert.equal(web3.utils.hexToNumber(keys[1]), input_key2, "Unexpected key.");
  });
});
