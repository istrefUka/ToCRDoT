import { Frontier, LogEntry } from "./append_only_log";

export function toBase64(input: string): string {
  return Buffer.from(input, "utf-8").toString('base64');
}

export function fromBase64(input: string): string {
  return Buffer.from(input, "base64").toString('utf-8');
}
export function mapReplacer(key: any, value: any) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), 
    };
  } else {
    return value;
  }
}

export function mapReviver(key: any, value: any) {
  if (typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}

export function isLogEntry(obj: any): obj is LogEntry {
  const o = obj as LogEntry;
  return o.creator !== undefined && o.id !== undefined && o.index !== undefined && o.operation !== undefined;
}
export function isFrontier(obj: any): obj is Frontier {
  if (obj instanceof Map) {
    return true;
  }
  return false;
}