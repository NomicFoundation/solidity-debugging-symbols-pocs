const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, traceTransaction } = require("../lib/tracer");
const { retrieveLiveVariablesInTrace } = require("../lib/local_variable_symbols_interpreter");
const { patch_web3 } = require("../lib/patch_web3");
const fs = require('fs');
const util = require('util');
patch_web3(web3);

const filenames = fs.readdirSync("test/jsons");
let testDefinitions = filenames.map(file => require(`./jsons/${file}`));
let hasOnly = false;
const onlys = testDefinitions.map(td => {
  const ans = {
    contractName: td.contractName,
    constructorTests: td.constructorTests? td.constructorTests.filter(t => t.only) : [],
    tests:  td.tests? td.tests.filter(t => t.only): [],
  };

  hasOnly = hasOnly || ans.constructorTests.length > 0 || ans.tests.length > 0;
  return ans
});

if(hasOnly) {
  testDefinitions = onlys;
}

const hardcodedPc = 89;
const hardcodedIterations = 1;

testDefinitions.forEach( testDefinition => {
  contract(testDefinition.contractName, accounts => {
    let tracer, symbols, Contract;

    before(async () => {
      Contract = artifacts.require(testDefinition.contractName);
      symbols = await compile(`contracts/${testDefinition.contractName}.sol`);
      console.log("Symbols: " + util.inspect(symbols, { depth: 6 }));
      Contract.bytecode = symbols.bytecode;
      tracer = createTracer(web3);
    });

    // TODO: define test logic
    testDefinition.tests && testDefinition.tests.map(unitTest => {
      it(unitTest.description, async () => {
        const params = unitTest.constructorParams || [];
        const contract = await Contract.new(...params);
        unitTest.before && await Promise.all(unitTest.before.map(
            m => contract[m.method].sendTransaction(...m.params, {value: m.value, from: m.from})
        ));
        const result = await contract[unitTest.method].sendTransaction(...unitTest.params, {value: unitTest.value, from: unitTest.from});
        const tx = {hash: result.tx, to: contract.address};
        await traceTransaction(tracer, tx);
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, hardcodedPc, hardcodedIterations);
      });
    });
  });
});