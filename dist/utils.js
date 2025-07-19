"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBase64 = toBase64;
exports.fromBase64 = fromBase64;
exports.mapReplacer = mapReplacer;
exports.mapReviver = mapReviver;
exports.isLogEntry = isLogEntry;
exports.isFrontier = isFrontier;
function toBase64(input) {
    return Buffer.from(input, "utf-8").toString('base64');
}
function fromBase64(input) {
    return Buffer.from(input, "base64").toString('utf-8');
}
// the following functions shall be used to serialize / deserialize the append-only log
// source: https://stackoverflow.com/a/56150320/13166601
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReplacer(key, value) {
    if (value instanceof Map) {
        return {
            dataType: 'Map',
            value: Array.from(value.entries()), // or with spread: value: [...value]
        };
    }
    else {
        return value;
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReviver(key, value) {
    if (typeof value === 'object' && value !== null) {
        if (value.dataType === 'Map') {
            return new Map(value.value);
        }
    }
    return value;
}
// ============
function isLogEntry(obj) {
    const o = obj;
    return o.creator !== undefined && o.dependencies !== undefined && o.id !== undefined && o.index !== undefined && o.operation !== undefined;
}
function isFrontier(obj) {
    const o = obj;
    if (obj instanceof Map) {
        return true;
    }
    return false;
}
