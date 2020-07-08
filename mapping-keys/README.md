# Debugging Symbols for Solidity's Mapping Keys (Proof of Concept)

This project works as a first draft implementation of debugging symbols in solidity for tracking keys used in mappings.

## Debugging Symbols

The compiler will output a json object with the following metadata:
 * `storageLayout`: The variables extracted from the `--storage-layout` flag in solidity
 * `storageTypes`: The types extracted from the `--storage-layout` flag in solidity
 * `mappings`: The positions in the bytecode in which a `SHA3` instruction is present that is used to calculate the slot for a key in a mapping
 
 Example:
```$json
 mappings: [
    {
      bytecodeOffset: '156',
      deployedBytecodeOffset: '124'
    },
    {
      bytecodeOffset: '174',
      deployedBytecodeOffset: '167'
    }
  ]
```

## Tests

To run the tests, run `npx buidler test` in this directory. Tests are generated out of the json files in `test/jsons`.

### Test layout
```$json
{
  "contractName": "myContract",
  "constructorTests": [
    {
      "params": ["param1", "param2],
      "result": {
        "map": { "key":  true, "key2":  true }
      },
      "description": "Test on constructor"
    },
    ...
  ],
  "tests": [
    {
      "constructorParams": [ "constructorParam" ],
      "method": "myMethod",
      "params": ["param1", "param2"],
      "result": {
        "myMap": { "key1":  true }
      },true
      "description": "Call myMethod"
    },
    {
      "method": "myNestedMethod",
      "params": ["param1", "param2"],
      "result": {
        "nestedMap": { 
            "key1":  {
               "nestedKey": true
            } 
         }
      },
      "description": "Call myMethod"
    },
    ...
  ]
}
```
Each test file is a `JSON` object with the following fields:
- `contractName`: the file and name of the contract located in `contracts`.
- `constructorTests`: An array of tests to be run after calling the constructor.
- `tests`: An array of tests to be run after calling a specific method.
Each test will call a method and expect a `result`.
The result must contain all the keys used in the transaction in the respective mappings. If a mapping is located inside a struct, the result will nest all the struct fields.

```$json
result: {
    myStruct {
        mappingMember: {
            { "key1" : true }
        }
    }
}
```

Flags `only` and `skip` are available to cherrypick which tests to run.

## Compiler source

The source code for the compiler can be found [here](https://github.com/jcaracciolo/solidity/tree/debugging-symbols).