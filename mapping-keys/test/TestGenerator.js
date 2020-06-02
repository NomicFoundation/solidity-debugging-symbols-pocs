const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, retrieveKeysInTrace } = require("../lib/mapping_symbols_interpreter");
const { patch_web3 } = require("../lib/patch_web3");
const fs = require('fs');
patch_web3(web3);

const filenames = fs.readdirSync("test/jsons");
filenames.forEach(file => {
  const testDefinition = require(`./jsons/${file}`);
  contract(testDefinition.contractName, accounts => {
    testDefinition.tests.map(unitTest => {
      let contract, tracer, symbols;

      before(async () => {
        const Contract = artifacts.require(testDefinition.contractName);
        symbols = await compile(`contracts/${testDefinition.contractName}.sol`);
        Contract.bytecode = symbols.bytecode;
        contract = await Contract.new();
        tracer = createTracer(web3);
      });

      it(unitTest.description, async () => {
        const result = await contract[unitTest.method].sendTransaction(...unitTest.params);
        const tx = {hash: result.tx, to: contract.address};
        const usedKeys = await retrieveKeysInTrace(tx, symbols, tracer);

        const assertHasExactKeys = (result, target) => {
          assert.hasAllKeys(result, target, "The result keys do not match");
          Object.keys(target).forEach(k => {
            if (target[k] instanceof Object) {
              assert.isObject(result[k]);
              assertHasExactKeys(result[k], target[k]);
            }
          })

        };

        assertHasExactKeys(usedKeys, unitTest.result)
      });
    });
  });
});