import { OptionObject } from 'loader-utils';
import webpack from 'webpack';

export type LoaderCallback = (
  error: Error | undefined | null,
  content?: string | Buffer,
  sourceMap?: any,
) => void;

export interface LoaderContext {
  getOptions(schema?: object): Readonly<OptionObject>;
  version: string;
  context: string;
  rootContext: string;
  request: string;
  query: any;
  data?: any;
  callback: LoaderCallback;
  async(): LoaderCallback | undefined;
  cacheable(flag?: boolean): void;
  loaders: any[];
  loaderIndex: number;
  resource: string;
  resourcePath: string;
  resourceQuery: string;
  emitWarning(message: string | Error): void;
  emitError(message: string | Error): void;
  loadModule(
    request: string,
    callback: (error: Error | null, source: string, sourceMap: any, module: webpack.Module) => void,
  ): any;
  resolve(context: string, request: string, callback: (error: Error, result: string) => void): any;
  resolveSync(context: string, request: string): string;
  addDependency(file: string): void;
  dependency(file: string): void;
  addContextDependency(directory: string): void;
  clearDependencies(): void;
  value: any;
  inputValue: any;
  debug: boolean;
  minimize: boolean;
  sourceMap: boolean;
  target:
  | 'web'
  | 'webworker'
  | 'async-node'
  | 'node'
  | 'electron-main'
  | 'electron-renderer'
  | 'node-webkit'
  | string;
  webpack: boolean;
  emitFile(name: string, content: Buffer | string, sourceMap: any): void;
  fs: any;
  mode: 'production' | 'development' | 'none';
  _compilation: webpack.Compilation;
  _compiler: webpack.Compiler;
  _module: webpack.Module;
  hot: boolean;
}
