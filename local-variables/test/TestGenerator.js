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

testDefinitions.forEach( testDefinition => {
  contract(testDefinition.contractName, accounts => {
    const defaultAccount = accounts[0];
    let tracer, symbols, Contract;
    const contractPath = `contracts/${testDefinition.contractName}.sol`;
    let runtimeDecodedInstructions, constructorDecodedInstructions, fileOffsetByLine;

    before(async () => {
      const contractArtifact = artifacts.require(testDefinition.contractName);
      symbols = await compile(contractPath);
      Contract = new web3.eth.Contract(contractArtifact.abi, null, { gas: 4 * (10 ** 6), data: symbols.bytecode, from: defaultAccount });
      tracer = createTracer(web3);
      fileOffsetByLine = await mapLinesToFileOffsets(contractPath);
      runtimeDecodedInstructions = decodeInstructions(symbols.bytecodeRuntime, symbols.srcmapRuntime);
      constructorDecodedInstructions = decodeInstructions(symbols.bytecode, symbols.srcmap);
    });

    testDefinition.constructorTests && testDefinition.constructorTests.map(unitTest => {
      let testGenerate;
      if (unitTest.skip) testGenerate = it.skip;
      else if (unitTest.only) testGenerate = it.only;
      else testGenerate = it;

      testGenerate(unitTest.description, async () => {
        const deployTx = Contract.deploy({ arguments: unitTest.params });
        const calldata = deployTx.encodeABI();
        let txHash;
        const contract = await deployTx.send().once('transactionHash', (hash) => {
          txHash = hash;
        });
        const tx = { hash: txHash, to: contract.options.address, input: calldata};
        await traceTransaction(tracer, tx);

        const lines = Object.keys(unitTest.result);
        const instructionsByLineMap = instructionsByLine(lines, constructorDecodedInstructions, fileOffsetByLine);
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, constructorDecodedInstructions, instructionsByLineMap, false);
        assert.deepEqual(variables, unitTest.result);
      });

    });

    testDefinition.tests && testDefinition.tests.map(unitTest => {
      let testGenerate;
      if (unitTest.skip) testGenerate = it.skip;
      else if (unitTest.only) testGenerate = it.only;
      else testGenerate = it;

      testGenerate(unitTest.description, async () => {
        const params = unitTest.constructorParams || [];
        const contract = await Contract.deploy({ arguments: params }).send();
        unitTest.before && await Promise.all(unitTest.before.map(
            m => contract[m.method](...m.params).send({value: m.value, from: m.from})
        ));
        const methodCallTxObject = contract.methods[unitTest.method](...unitTest.params);
        const calldata = methodCallTxObject.encodeABI();
        const result = await methodCallTxObject.send({value: unitTest.value, from: unitTest.from});
        const tx = { hash: result.transactionHash, to: contract.options.address, input: calldata };
        await traceTransaction(tracer, tx);

        const lines = Object.keys(unitTest.result);
        const instructionsByLineMap = instructionsByLine(lines, runtimeDecodedInstructions, fileOffsetByLine);
        const variables = await retrieveLiveVariablesInTrace(tracer, symbols, runtimeDecodedInstructions, instructionsByLineMap);
        assert.deepEqual(variables, unitTest.result);

      });
    });
  });
});
