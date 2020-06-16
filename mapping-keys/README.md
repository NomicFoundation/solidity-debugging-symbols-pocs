# Debugging Symbols for Solidity's Mapping Keys (Proof of Concept)

This project works as a first draft implementation of debugging symbols in solidity for tracking keys used in mappings.

## Debugging Symbol

The compiler will output a json object with the following metadata:
 * `storageLayout`: The variables extracted from the `--storage-layout` flag in solidity
 * `storageTypes`: The types extracted from the `--storage-layout` flag in solidity
 * `mappings`: The positions in the bytecode in which a `SHA3` is present that is used to calculate the slot for a key in a mapping
 
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

To run the tests, run `npx buidler test` on this directory. Tests are generated out of the json files in `test/jsons`

####Test layout
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
Each test is a `JSON` object with `contractName` as the file and name on the contract located in `contracts`.
An array of `constructorTests` and another array of `tests`. Each test will call a method and expect a `result`.
The result must contains all they keys used in the transaction in the respective mappings. If a mapping is located inside a struct, the result will nest all the structs fields.

```$json
result: {
    myStruct {
        mappingMember: {
            { "key1" : true }
        }
    }
}
```

Flags `only` and `skip` are available to cherrypick with tests to run.
