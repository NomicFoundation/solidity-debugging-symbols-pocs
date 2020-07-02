const coder = require("@ethersproject/abi").defaultAbiCoder;
const { toBN, sha3, hexToBytes } = web3.utils;

const uint256Size = 32;
const uint256InHexSize = uint256Size * 2;
const wordSize = BigInt(uint256Size);

function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

function padToWord(number) {
    return toBN(number).toString(16, 64);
}

async function readStorage(readStorageSlot, pointer, size) {
    if (size > 1000n * wordSize) {
        throw new Error("A large storage crawl was requested.");
    }


    const slotsToRead = size / wordSize + (size % wordSize > 0n ? 1n : 0n);
    const value_array = [];
    for (let i = pointer; i < pointer + slotsToRead; i++) {
        const slot = "0x" + padToWord(i.toString(16));
        const word = await readStorageSlot(slot);
        const padded_word = padToWord(toBN(word));
        value_array.push(padded_word);
    }
    return "0x" + value_array.join("").substring(0, Number(size * 2n));
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

function decodeValue(value, symbol) {
    const type = toCanonicalType(symbol.typeName);
    if (type === 'string') {
        return web3.utils.toAscii(value);
    } else if (type === 'array') {
        //FIXME: add decoding of complex arrays
        const baseType = toCanonicalType(symbol.base);
        if (!baseType.startsWith("uint")) throw new Error(`Unsupported array type ${symbol.typeName}`);
        const decodedArray = [];
        // Array elements get padded to word size.
        const sizeInHex = uint256InHexSize;
        value = value.replace("0x", "");
        for (let i = 0; i < value.length; i += sizeInHex) {
            const element = "0x" + value.slice(i, i + sizeInHex);
            decodedArray.push(coder.decode([baseType], element).toString());
        }
        return decodedArray;
    } else if (type == 'struct') {
        const struct = {};
        for (const memberSymbol of symbol.members) {
            const byteOffsetInHex = (memberSymbol.slot * uint256Size + memberSymbol.offset) * 2 + 2;
            const sizeInHex = getSize(memberSymbol) * 2;
            const element = "0x" + value.slice(byteOffsetInHex, byteOffsetInHex + sizeInHex);
            struct[memberSymbol.label] = coder.decode([toCanonicalType(memberSymbol.type)], element).toString();
        }
        return struct;
    } else {
        return coder.decode([type], value).toString();
    }
}

async function readValue(state, variable, readStorageSlot) {
    // The top of the stack is at the first element.
    const { stack, memory, calldata } = state;
    const stackIndex = stack.length - 1 - variable.stackPointer;
    const stackValue = "0x" + stack[stackIndex];
    // default location seems to be the stack?
    if (variable.symbol.location == "default") {
        return { ...variable, value: decodeValue(stackValue, variable.symbol) };
    } else if (variable.symbol.location == "memory") {
        // To reliably decode values located in memory, the compiler needs to add their type information
        // to the type dictionary. This is currently only done for types in the storage layout.
        // Thus, we only support simple memory types here.
        const variablePointer = BigInt(stackValue);
        const { dataPointer, length } = getMemoryPointerAndLength(state, variable.symbol, variablePointer);
        const value = readMemory(memory, dataPointer, length);
        const decodedValue = decodeValue(value, variable.symbol);
        return { ...variable, value: decodedValue };
    } else if (variable.symbol.location == "calldata") {
        // The length of the calldata retrieved is in the slot above the calldata pointer.
        const calldataPointer = BigInt(stackValue);
        const { dataPointer, length } = getCallDataPointerAndLength(calldata, variable.symbol, calldataPointer);
        const value = readMemory(calldata, dataPointer, length);
        return { ...variable, value: decodeValue(value, variable.symbol) };
    } else if (variable.symbol.location == "storage") {
        const { dataPointer, length } = await getStoragePointerAndLength(variable.symbol, stackValue, readStorageSlot);
        const value = await readStorage(readStorageSlot, dataPointer, length);
        return { ...variable, value: decodeValue(value, variable.symbol) };
    } else {
        throw new Error(`Unknown location ${variable.symbol.location}`);
    }
}

// TODO: This should probably be merged with getCallDataPointerAndLength but we want to play it safe for now.
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
            dataPointer: variablePointer + BigInt(uint256Size),
            length: BigInt(readMemory(state.memory, variablePointer, BigInt(uint256Size)))
        };
    } else {
        throw new Error(`Unsupported encoding ${symbol.encoding}`);
    }
}

function getCallDataPointerAndLength(calldata, symbol, variablePointer) {
    if (symbol.location != "calldata") throw new Error(`Unsupported location ${symbol.location}`);
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
            dataPointer: variablePointer,
            length: BigInt(readMemory(calldata, variablePointer - BigInt(uint256Size), BigInt(uint256Size)))
        };
    } else if (symbol.encoding == "dynamic_array") {
        const numberOfElements = BigInt(readMemory(calldata, variablePointer - BigInt(uint256Size), BigInt(uint256Size)));
        const length = numberOfElements * symbolLength;
        return {
            dataPointer: variablePointer,
            length
        }
    } else {
        throw new Error(`Unsupported encoding ${symbol.encoding}`);
    }
}

async function getStoragePointerAndLength(symbol, variablePointer, readStorageSlot) {
    if (symbol.location != "storage") throw new Error(`Unsupported location ${symbol.location}`);
    const symbolLength = BigInt(symbol.numberOfBytes);
    if (symbol.encoding == "inplace") {
        // The length is given in the symbols.
        return {
            dataPointer: BigInt(variablePointer),
            length: symbolLength
        };
    } else if (symbol.encoding == "bytes") {
        const lengthSlot = BigInt(variablePointer);
        const slotValue = BigInt(await readStorage(readStorageSlot, lengthSlot, wordSize));
        // The bytes encoding in the storage uses the lowest order bit to encode two different representations:
        // - inplace bytes for short byte buffers
        // - derivation of the byte buffer pointer with the slot hash for arbitrarily large byte buffers
        const isInplace = (slotValue & 0x01n) == 0n;
        let length, stringPointer;
        if (isInplace) {
            length = (slotValue & 0xffn) >> 1n;
            stringPointer = lengthSlot;
        } else {
            // The string buffer is elsewhere.
            length = slotValue >> 1n;
            stringPointer = BigInt(sha3(hexToBytes("0x" + padToWord(lengthSlot.toString(16)))));
        }
        return {
            dataPointer: stringPointer,
            length
        };
    } else if (symbol.encoding == "dynamic_array") {
        const lengthSlot = BigInt(variablePointer);
        const elementSize = BigInt(getSize({ type: symbol.base }));
        const numberOfElements = BigInt(await readStorage(readStorageSlot, lengthSlot, elementSize));
        const length = numberOfElements * elementSize;
        const arrayPointer = BigInt(sha3(hexToBytes("0x" + padToWord(lengthSlot.toString(16)))));
        return {
            dataPointer: arrayPointer,
            length
        };
    } else {
        throw new Error(`Unsupported encoding ${symbol.encoding}`);
    }
}

function getSize(symbol) {
    if (toCanonicalType(symbol.type) == "uint256") {
        return uint256Size;
    } else {
        throw new Error(`Unsupported type ${symbol.type}`);
    }
}

module.exports = {
    readValue
}