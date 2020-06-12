const {toBN} = web3.utils;
const util = require("util");
const coder = require("@ethersproject/abi").defaultAbiCoder;

function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

function toCanonicalType(type) {
    if(type.startsWith("t_")) {
        type = type.replace("t_", "");
    }

    if(type.startsWith("string")) return "string";
    if(type.startsWith("struct")) return "struct";
    if(type.startsWith("mapping")) return "mapping";
    if(type.startsWith("enum")) return "enum";
    if(type.startsWith("array")) return "array";
    return type;
}

function decodeValue(value, valueType) {
    const type = toCanonicalType(valueType);
    if (type === 'string') {
        return web3.utils.toAscii(value);
    } else {
        return coder.decode([toCanonicalType(valueType)], value).toString();
    }
}

/*
 */
async function retrieveLiveVariablesInTrace(trace, symbols, stopBytecodeOffset, iterations, deployedBytecode = true) {
    // The trace was successfully retrieved and analysed
    const symbolsByOffset = {};
    for (const symbol of symbols.variables) {
        const bytecodeOffset = deployedBytecode ? symbol.deployedBytecodeOffset : symbol.bytecodeOffset;
        if (!symbolsByOffset[bytecodeOffset]) symbolsByOffset[bytecodeOffset] = [];
        symbolsByOffset[bytecodeOffset].push(symbol);
    }

    const numberOfSteps = await trace.getLength();
    let iteration = 0;
    // TODO: restrict liveVariables to a certain scope.
    let liveVariables = [];
    for (let step = 0; step < numberOfSteps; step++) {
        const pc = await trace.getCurrentPC(step);
        const stack = await trace.getStackAt(step);
        const offsetSymbols = symbolsByOffset[pc];
        if (offsetSymbols) {
            console.log("Found at least one variable!");
            console.log(util.inspect(trace.tracer.trace[step]));

            for (const symbol of offsetSymbols) {
                console.log(`Found variable ${symbol.label}`);
                // This position should use a common frame of reference: the bottom of the stack.
                const stackPointer = stack.length - 1 - symbol.stackOffset;
                liveVariables.push({
                    stackPointer,
                    symbol
                });
            }
        }
        // FIXME: This should use the end of scope markers instead.
        liveVariables = liveVariables.filter((variable) => {
            return variable.stackPointer <= stack.length;
        });
        if (pc == stopBytecodeOffset) {
            iteration += 1;
            if (iteration == iterations) {
                // TODO: read variable values and decode them.
                for (const variable of liveVariables) {
                    const type = toCanonicalType(variable.symbol.typeName);
                    // default location seems to be the stack?
                    if (variable.symbol.location == "default") {
                        variable.value = decodeValue("0x" + stack[variable.stackPointer], type);
                    } else {
                        throw Error(`Unknown location ${location}`);
                    }
                }
                break;
            }
        }
    }
    console.log(`Live variables: ${util.inspect(liveVariables, { depth: 5 })}`);
    return liveVariables;
}

module.exports = {
    retrieveLiveVariablesInTrace,
};
