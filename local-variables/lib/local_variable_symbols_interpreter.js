const {toBN} = web3.utils;
const util = require("util");
const coder = require("@ethersproject/abi").defaultAbiCoder;
const { decodeInstructions: buidlerEVMDecodeInstructions } = require("../node_modules/@nomiclabs/buidler/internal/buidler-evm/stack-traces/source-maps");
const fs = require('fs').promises;

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

function decodeInstructions(bytecode, sourceMap) {
    const bytecodeBuffer = Buffer.from(bytecode.replace("0x", ""), "hex");
    return buidlerEVMDecodeInstructions(bytecodeBuffer, sourceMap, new Map());
}

async function mapLinesToFileOffsets(filePath) {
    const file = await fs.readFile(filePath, 'utf8');
    // console.log("File: " + util.inspect(file, { depth: 6 }));
    const lines = file.split('\n');
    // console.log("Lines: " + util.inspect(lines, { depth: 6 }));
    let sum = 0;
    const fileOffsetByLine = [];
    for (const line of lines) {
        // Add an extra character to account for each subtracted newline.
        fileOffsetByLine.push({ start: sum, end: sum + line.length + 1 });
        sum += line.length + 1;
    }
    // console.log("File offsets: " + util.inspect(fileOffsetByLine, { depth: 6 }));
    return fileOffsetByLine;
}

/* Returns line -> bytecode offsets dictionary. The lists of instructions are ordered by program counter.
 */
function translateLineToBytecodeOffsets(decodedInstructions, fileOffsetByLine, lines) {
    const bytecodeOffsetsByLine = {};
    for (const instruction of decodedInstructions) {
        const location = instruction.location;
        if (location) {
            const line = matchOffsetToLine(fileOffsetByLine, instruction.location, lines);
            if (line !== null) {
                if (!bytecodeOffsetsByLine[line]) bytecodeOffsetsByLine[line] = [];
                bytecodeOffsetsByLine[line].push(instruction);
            }
        }
    };

    return bytecodeOffsetsByLine;
}

function matchOffsetToLine(fileOffsetByLine, location, lines) {
    for (const line of lines) {
        const { start, end } = fileOffsetByLine[line - 1];
        if (start <= location.offset && location.offset < end) {
            return line;
        }
    }
    return null;
}

/*
 */
async function retrieveLiveVariablesInTrace(trace, symbols, bytecodeRangesByLine, deployedBytecode = true) {
    const symbolsByOffset = {};
    for (const symbol of symbols.variables) {
        // const test = Object.freeze(symbol);
        // symbol.rawr = "lel";
        // test.rawr = "lel";
        const bytecodeOffset = deployedBytecode ? symbol.deployedBytecodeOffset : symbol.bytecodeOffset;
        if (!symbolsByOffset[bytecodeOffset]) symbolsByOffset[bytecodeOffset] = [];
        symbolsByOffset[bytecodeOffset].push(symbol);
    }

    const liveVariablesInTrace = {};
    for (const [line, bytecodeRange] of Object.entries(bytecodeRangesByLine)) {
        const stopBytecodeOffset = bytecodeRange[0].pc;
        const variablesByIteration = await traceLiveVariablesStackLocations(trace, stopBytecodeOffset, symbolsByOffset);
        // We need to find the first step that executes an instruction outside the bytecode range to ensure the relevant variable is initialized.
        const variablesValueByIteration = await Promise.all(variablesByIteration.map((liveVariables) => readVariableValues(trace, liveVariables, bytecodeRange)));
        // console.log(`Live variables in line ${line}: ${util.inspect(variablesValueByIteration, { depth: 5 })}`);
        liveVariablesInTrace[line] = variablesValueByIteration;
    }

    return liveVariablesInTrace;
}

// TODO: restrict liveVariables to a certain scope.
async function traceLiveVariablesStackLocations(trace, stopBytecodeOffset, symbolsByOffset) {
    const numberOfSteps = await trace.getLength();
    const liveVariablesByIteration = [];
    let liveVariables = [];
    let step = 0;
    for (; step < numberOfSteps; step++) {
        const pc = await trace.getCurrentPC(step);
        const offsetSymbols = symbolsByOffset[pc];
        const stack = await trace.getStackAt(step);

        // FIXME: This should use the end of scope markers too.
        liveVariables = liveVariables.filter((variable) => {
            return variable.stackPointer < stack.length;
        });

        if (offsetSymbols) {
            if (!isPush(trace.tracer.trace[step].op)) {
                // FIXME: this probably breaks with variable symbols for function parameters.
                throw new Error(`Found a variable where there is no push instruction! Opcode: ${trace.tracer.trace[step].op}`);
            }
            // console.log("Found at least one variable!");
            // console.log(util.inspect(trace.tracer.trace[step]));

            for (const symbol of offsetSymbols) {
                // console.log(`Found variable ${symbol.label}`);
                // This position should use a common frame of reference: the bottom of the stack.
                // Since this is a push instruction, its position is outside the current stack.
                const stackPointer = stack.length - symbol.stackOffset;
                liveVariables.push({
                    stackPointer,
                    symbol
                });
            }
        }

        if (pc == stopBytecodeOffset) {
            liveVariablesByIteration.push({
                liveVariables: liveVariables.slice(),
                step
            });
        }
    }
    return liveVariablesByIteration;
}

async function readVariableValues(trace, variables, bytecodeRange) {
    const numberOfSteps = await trace.getLength();
    // TODO: what if we get a discontiguous bytecode range? That case could warrant a deeper look.
    let finalStep = variables.step;
    for (; finalStep < numberOfSteps; finalStep++) {
        const pc = await trace.getCurrentPC(finalStep);
        if (bytecodeRange.every((instruction) => {
            return instruction.pc != pc;
        })) {
            break;
        }
    }

    // The top of the stack is at the first element.
    const stack = await trace.getStackAt(finalStep);
    // console.log(`Stack in final step: ${util.inspect(stack, { depth: 5 })}`);
    // TODO: read variable values and decode them.
    return variables.liveVariables.map((variable) => {
        const type = toCanonicalType(variable.symbol.typeName);
        // default location seems to be the stack?
        if (variable.symbol.location == "default") {
            return { ...variable, value: decodeValue("0x" + stack[stack.length - 1 - variable.stackPointer], type) };
        } else {
            throw new Error(`Unknown location ${variable.symbol.location}`);
        }
    });
}

function isPush(opcode) {
    return opcode.startsWith("PUSH");
}

module.exports = {
    retrieveLiveVariablesInTrace,
    translateLineToBytecodeOffsets,
    mapLinesToFileOffsets,
    decodeInstructions
};
