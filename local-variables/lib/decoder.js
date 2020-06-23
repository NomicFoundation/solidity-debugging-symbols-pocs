const coder = require("@ethersproject/abi").defaultAbiCoder;


function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

function toCanonicalType(type) {
    if (type.startsWith("t_")) {
        type = type.replace("t_", "");
    }

    if (type.startsWith("string")) return "string";
    if (type.startsWith("struct")) return "struct";
    if (type.startsWith("mapping")) return "mapping";
    if (type.startsWith("enum")) return "enum";
    if (type.startsWith("array")) return "array";
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

function readValue(state, variable) {
    // The top of the stack is at the first element.
    const { stack, memory } = state;
    const type = toCanonicalType(variable.symbol.typeName);
    // default location seems to be the stack?
    const stackValue = stack[stack.length - 1 - variable.stackPointer];
    if (variable.symbol.location == "default") {
        return { ...variable, value: decodeValue("0x" + stackValue, type) };
    } else if (variable.symbol.location == "memory") {
        const variablePointer = BigInt("0x" + stackValue);
        const { dataPointer, length } = getMemoryPointerAndLength(state, variable.symbol, variablePointer);
        const value = readMemory(memory, dataPointer, length);
        const decodedValue = decodeValue(value, type);
        return { ...variable, value: decodedValue };
    } else {
        throw new Error(`Unknown location ${variable.symbol.location}`);
    }
}

function getMemoryPointerAndLength(state, symbol, variablePointer) {
    if (symbol.location != "memory") throw new Error(`Unsupported location ${symbol.location}`);
    const symbolLength = BigInt(symbol.numberOfBytes);
    if (symbol.encoding == "inplace") {
        // The length is given in the symbols.
        return {
            dataPointer: variablePointer,
            length: symbolLength
        };
    } else if (symbol.encoding == "bytes") {
        // We need to read the length in the machine memory.
        return {
            dataPointer: variablePointer + symbolLength,
            length: BigInt(readMemory(state.memory, variablePointer, symbolLength))
        };
    } else {
        throw new Error(`Unsupported encoding ${symbol.encoding}`);
    }
}

module.exports = {
    readValue
}