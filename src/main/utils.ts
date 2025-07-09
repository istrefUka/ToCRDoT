export function toBase64(input: string): string {
  return Buffer.from(input, "utf-8").toString('base64');
}

export function fromBase64(input: string): string {
  return Buffer.from(input, "base64").toString('utf-8');
}

// the following functions shall be used to serialize / deserialize the append-only log
// source: https://stackoverflow.com/a/56150320/13166601
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReplacer(key: any, value: any) { 
  if(value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapReviver(key: any, value: any) {
  if(typeof value === 'object' && value !== null) {
    if (value.dataType === 'Map') {
      return new Map(value.value);
    }
  }
  return value;
}
// ============