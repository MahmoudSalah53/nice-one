declare module "archiver" {
  interface ArchiverOptions {
    zlib?: { level?: number };
  }

  interface Archiver {
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "end", listener: () => void): this;
    append(
      source: string | Buffer,
      options?: { name: string }
    ): this;
    file(path: string, options: { name: string }): this;
    finalize(): void;
  }

  function archiver(format: "zip", options?: ArchiverOptions): Archiver;

  export = archiver;
}
