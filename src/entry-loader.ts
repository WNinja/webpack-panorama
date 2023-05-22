import fs from 'fs';
import { interpolateName } from 'loader-utils';
import path from 'path';
import webpack from 'webpack';
import { LoaderContext } from './webpack-loader-api';

export interface EntryLoaderOptions {
  cacheable?: boolean | false;
  filename?: string;
  plugins?: (string | webpack.WebpackPluginInstance)[];
}

export function pitch(this: LoaderContext) {
  const options: EntryLoaderOptions = this.getOptions();

  this.cacheable(options.cacheable ?? false);
  this.addDependency(this.resourcePath);

  let list = resolveImport({}, this.resourcePath, true);
  for (const sPath of Object.keys(list)) {
    this.addDependency(sPath);
  }

  const filenameTemplate = options.filename ?? '[path][name].js';
  const filename = interpolateName(this, filenameTemplate, { context: this.rootContext });
  const compiler = createCompiler(this, filename, options.plugins ?? []);

  const callback = this.async()!;
  compiler.runAsChild((error, entries, compilation) => {
    (compilation?.warnings ?? []).forEach((e) => this.emitWarning(e));
    (compilation?.errors ?? []).forEach((e) => this.emitError(e));

    if (error) {
      callback(error);
    } else if (entries!.length > 0) {
      const file = [...entries![0].files][0];
      callback(null, `module.exports = __webpack_public_path__ + ${JSON.stringify(file)};`);
    } else {
      callback(null, '');
    }
  });
}

function createCompiler(
  loader: LoaderContext,
  filename: string,
  pluginsOption: NonNullable<EntryLoaderOptions['plugins']>,
) {
  const { _compilation: oldCompilation, _compiler: oldCompiler } = loader;
  const outputOptions = { ...oldCompilation.outputOptions, filename };

  const allowedPlugins = new Set(pluginsOption.filter((x): x is string => typeof x === 'string'));
  const plugins = [
    ...oldCompiler.options.plugins.filter((p) => allowedPlugins.has(p.constructor.name)),
    ...pluginsOption.filter((x): x is webpack.WebpackPluginInstance => typeof x !== 'string'),
  ];

  const compilerName = path.relative(oldCompiler.context, loader.resourcePath);
  const childCompiler = oldCompilation.createChildCompiler(compilerName, outputOptions, plugins);

  const { rawRequest } = loader._module as webpack.NormalModule;
  new webpack.EntryPlugin(loader.context, rawRequest, 'main').apply(childCompiler);

  return childCompiler;
}

function resolveImport(list: Record<string, boolean>, scriptPath: string, bRoot = false) {
  let tTry = bRoot ? [scriptPath] : [
    scriptPath + ".tsx",
    scriptPath + ".ts",
    scriptPath + "/index.tsx",
    scriptPath + "/index.ts",
  ];

  tTry.some((sPath) => {
    if (fs.existsSync(sPath)) {
      if (list[sPath]) return true;
      bRoot == false && (list[sPath] = true);

      const content = fs.readFileSync(sPath, "utf-8");
      const sDir = path.dirname(sPath);
      const importList = content.match(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g)?.map((relativePath) => {
        return relativePath.replace(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g, "$2");
      })?.map((relativePath) => {
        return path.resolve(sDir, relativePath);
      });
      if (importList) {
        importList.forEach(element => {
          if (element.search(/.*(\.less|\.s\.xml)/) == -1) {
            resolveImport(list, element);
          }
        });
      }

      return true;
    }
  });
  return list;
}