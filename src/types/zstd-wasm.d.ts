declare module "zstd-wasm" {
  export function createZstdCompress(options?: { level?: number }): any;
  export function createZstdDecompress(): any;
  export function compress(data: Uint8Array, level?: number): Uint8Array;
  export function decompress(data: Uint8Array): Uint8Array;
}
