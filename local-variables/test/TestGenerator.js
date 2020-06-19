const { compile, compileSourceMap } = require("../lib/compiler_with_symbols");
const { createTracer, traceTransaction } = require("../lib/tracer");
const {
  retrieveLiveVariablesInTrace,
  translateLineToBytecodeOffsets,
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
      // FIXME: remove this when the instrumentation is present in the standard json or outputs source maps too.
      // Compilations need to happen separately to avoid data races in the instrumentation output.
      Object.assign(symbols, await compileSourceMap(contractPath));
      // console.log("Symbols: " + util.inspect(symbols, { depth: 6 }));
      Contract.bytecode = symbols.bytecode;
      tracer = createTracer(web3);

      fileOffsetByLine = await mapLinesToFileOffsets(contractPath);
      runtimeDecodedInstructions = decodeInstructions(symbols["bin-runtime"], symbols["srcmap-runtime"]);
      // console.log("Decoded runtime instructions: " + util.inspect(runtimeDecodedInstructions, { depth: 6 }));
      constructorDecodedInstructions = decodeInstructions(symbols.bytecode, symbols.srcmap);
      // console.log("Decoded constructor instructions: " + util.inspect(constructorDecodedInstructions, { depth: 6 }));
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

        const lines = Object.keys(unitTest.tests);
        const runtimeBytecodeOffsetsByLine = translateLineToBytecodeOffsets(runtimeDecodedInstructions, fileOffsetByLine, lines);
        // console.log("Runtime bytecode offsets by line: " + util.inspect(runtimeBytecodeOffsetsByLine, { depth: 6 }));

        // const constructorBytecodeOffsetsByLine = translateLineToBytecodeOffsets(constructorDecodedInstructions, fileOffsetByLine, lines);
        // console.log("Constructor bytecode offsets by line: " + util.inspect(runtimeBytecodeOffsetsByLine, { depth: 6 }));

        // This checks that the variables defined in the test are found in the trace.
        // TODO: Check that the variables found in the trace are all defined in the test. I.e. both sets should be equal.
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, runtimeBytecodeOffsetsByLine);
        for (const [line, test] of Object.entries(unitTest.tests)) {
          const lineVariables = variables[line];
          for (const [index, iterationTest] of test.entries()) {
            const variable = getLatestMatchingVariable(lineVariables[index], iterationTest.label);
            assert.isDefined(variable, `Couldn't find a variable labeled ${iterationTest.label}`);
            assert.equal(iterationTest.value, variable.value);
          }
        }
      });
    });
  });
});


function getLatestMatchingVariable(iterationVariables, label) {
  const index = iterationVariables.map((variable) => {
    return variable.symbol.label;
  }).lastIndexOf(label);
  return iterationVariables[index];
}
