const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { patch_web3 } = require("../lib/patch_web3");
const fs = require('fs');
patch_web3(web3);

const assertHasExactKeys = (result, target) => {
  assert.hasAllKeys(result, target, "The result keys do not match");
  Object.keys(target).forEach(k => {
    if (target[k] instanceof Object) {
      assert.isObject(result[k]);
      assertHasExactKeys(result[k], target[k]);
    }
  })

};

const filenames = fs.readdirSync("test/jsons");
filenames.forEach(file => {
  const testDefinition = require(`./jsons/${file}`);
  contract(testDefinition.contractName, accounts => {
    let tracer, symbols, Contract;

    before(async () => {
      Contract = artifacts.require(testDefinition.contractName);
      symbols = await compile(`contracts/${testDefinition.contractName}.sol`);
      Contract.bytecode = symbols.bytecode;
      tracer = createTracer(web3);
    });

    testDefinition.constructorTests && testDefinition.constructorTests.map(unitTest => {

      it(unitTest.description, async() => {
        const contract = await Contract.new(...unitTest.params);
        const tx = {hash: contract.transactionHash, to: contract.address};
        const usedKeys = await retrieveKeysInTrace(tx, symbols, tracer, false);
        assertHasExactKeys(usedKeys, unitTest.result)
      });

    });

    testDefinition.tests && testDefinition.tests.map(unitTest => {

      it(unitTest.description, async () => {
        const params = unitTest.constructorParams || [];
        const contract = await Contract.new(...params);
        const result = await contract[unitTest.method].sendTransaction(...unitTest.params);
        const tx = {hash: result.tx, to: contract.address};
        const usedKeys = await retrieveKeysInTrace(tx, symbols, tracer);
        assertHasExactKeys(usedKeys, unitTest.result)
      });

    });
  });
});