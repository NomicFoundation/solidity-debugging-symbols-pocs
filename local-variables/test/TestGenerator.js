const { compile } = require("../lib/compiler_with_symbols");
const { createTracer } = require("../lib/tracer");
const { patch_web3 } = require("../lib/patch_web3");
const fs = require('fs');
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

testDefinitions.forEach( testDefinition => {
  contract(testDefinition.contractName, accounts => {
    let tracer, symbols, Contract;

    before(async () => {
      Contract = artifacts.require(testDefinition.contractName);
      symbols = await compile(`contracts/${testDefinition.contractName}.sol`);
      Contract.bytecode = symbols.bytecode;
      tracer = createTracer(web3);
    });

    testDefinition.tests && testDefinition.tests.map(unitTest => {
      console.log("hello world");
    });
  });
});