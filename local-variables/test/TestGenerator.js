const { compile } = require("../lib/compiler_with_symbols");
const { createTracer, traceTransaction } = require("../lib/tracer");
const {
  retrieveLiveVariablesInTrace,
  instructionsByLine,
  mapLinesToFileOffsets,
  decodeInstructions
} = require("../lib/local_variable_symbols_interpreter");
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
  return ans;
});

if (hasOnly) {
  testDefinitions = onlys;
}

testDefinitions.forEach( testDefinition => {
  contract(testDefinition.contractName, accounts => {
    let tracer, symbols, Contract;
    const contractPath = `contracts/${testDefinition.contractName}.sol`;
    let runtimeDecodedInstructions, constructorDecodedInstructions, fileOffsetByLine;

    before(async () => {
      Contract = artifacts.require(testDefinition.contractName);
      symbols = await compile(contractPath);
      Contract.bytecode = symbols.bytecode;
      tracer = createTracer(web3);
      fileOffsetByLine = await mapLinesToFileOffsets(contractPath);
      runtimeDecodedInstructions = decodeInstructions(symbols.bytecodeRuntime, symbols.srcmapRuntime);
      constructorDecodedInstructions = decodeInstructions(symbols.bytecode, symbols.srcmap);
    });

    testDefinition.constructorTests && testDefinition.constructorTests.map(unitTest => {
      if(unitTest.skip) return;

      it(unitTest.description, async () => {
        const contract = await Contract.new(...unitTest.params);
        const tx = {hash: contract.transactionHash, to: contract.address};
        await traceTransaction(tracer, tx);

        const lines = Object.keys(unitTest.result);
        const instructionsByLineMap = instructionsByLine(lines, constructorDecodedInstructions, fileOffsetByLine);
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, instructionsByLineMap, false);
        assert.deepEqual(variables, unitTest.result);
      });

    });

    testDefinition.tests && testDefinition.tests.map(unitTest => {
      if(unitTest.skip) return;

      it(unitTest.description, async () => {
        const params = unitTest.constructorParams || [];
        const contract = await Contract.new(...params);
        unitTest.before && await Promise.all(unitTest.before.map(
            m => contract[m.method].sendTransaction(...m.params, {value: m.value, from: m.from})
        ));
        const result = await contract[unitTest.method].sendTransaction(...unitTest.params, {value: unitTest.value, from: unitTest.from});
        const tx = {hash: result.tx, to: contract.address};
        await traceTransaction(tracer, tx);

        const lines = Object.keys(unitTest.result);
        const instructionsByLineMap = instructionsByLine(lines, runtimeDecodedInstructions, fileOffsetByLine);
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, instructionsByLineMap);
        assert.deepEqual(variables, unitTest.result);

      });
    });
  });
});
