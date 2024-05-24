import fs from 'fs';
import path from 'path';
import posthtml from 'posthtml';
import { LoaderContext } from '../webpack-loader-api';

const createNodeFilter = (tags: string[]) => (
  node: posthtml.NodeTreeElement,
): node is posthtml.Node =>
  typeof node === 'object' && (tags.length === 0 || tags.includes(node.tag as any));

const getRoot = (tree: posthtml.Api) => tree.find(createNodeFilter(['root']));

const getIncludeRoots = (tree: posthtml.Api) =>
  (getRoot(tree)?.content ?? []).filter(createNodeFilter(['scripts', 'styles']));

export const AddCommonStyles = (less_src: string[]) => {
  return (tree: posthtml.Api) => {
    return getRoot(tree)?.content.filter(createNodeFilter(['styles'])).forEach(node => {
      const last_element = node.content.pop();
      less_src.forEach((src) => node.content.push(`\n\t\t`, {
        tag: "include",
        attrs: {
          src: src
        },
        content: []
      }));
      if (last_element) {
        node.content.push(last_element);
      }
    });
  };
};

export const preserveIncludesBefore: posthtml.Plugin = (tree: posthtml.Api) => {
  getIncludeRoots(tree)
    .flatMap((x) => x.content)
    .filter(createNodeFilter(['include']))
    .forEach((node) => {
      node.tag = 'panorama-include';
    });
};

export const preserveIncludesAfter: posthtml.Plugin = (tree) => {
  getIncludeRoots(tree)
    .flatMap((x) => x.content)
    .filter(createNodeFilter(['panorama-include']))
    .forEach((node) => {
      node.tag = 'include';
    });
};

export const validateIncludes = (context: LoaderContext): posthtml.Plugin => (tree) => {
  for (const scope of getIncludeRoots(tree)) {
    for (const node of scope.content) {
      if (typeof node !== 'object') continue;

      if (node.tag !== 'include') {
        context.emitError(new Error(`Unexpected tag '${node.tag}'`));
        continue;
      }

      const { src } = node.attrs;
      if (src == null) {
        context.emitError(new Error('<include> tag is missing "src" attribute'));
        continue;
      }

      if (scope.tag === 'styles') {
        if (!src.endsWith('.css') && !src.endsWith('.vcss_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      } else if (scope.tag === 'scripts') {
        if (!src.endsWith('.js') && !src.endsWith('.vjs_c') && !src.endsWith('.ts') && !src.endsWith('.vts_c')) {
          context.emitError(new Error(`Dependency '${src}' has invalid extension`));
        }
      }
    }
  }
};

export function IncludeDota2Snippet(_this: LoaderContext) {
  function GetAllSnippet(TS_List: Record<string, boolean>, Snippets: Record<string, boolean>, scriptPath: string, bSuffix = false) {
    let tTry = bSuffix ? [scriptPath] : [
      scriptPath + ".tsx",
      scriptPath + ".ts",
      scriptPath + "/index.tsx",
      scriptPath + "/index.ts",
    ];
    // 判断以上任一情况的文件是否存在
    tTry.some((sPath) => {
      if (fs.existsSync(sPath)) {
        if (TS_List[sPath]) return true;
        TS_List[sPath] = true;

        const content = fs.readFileSync(sPath, "utf-8");
        const sDir = path.dirname(sPath);
        // 读取文件内import的所有文件
        const importList = content.match(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g)?.map((relativePath) => {
          return relativePath.replace(/import.*('|")(\.\.\/.*|\.\/.*)('|");/g, "$2");
        })?.map((relativePath) => {
          return path.resolve(sDir, relativePath);
        });
        if (importList) {
          importList.forEach(element => {
            // 不是.less
            if (element.search(/.*\.less/) == -1) {
              // 记录snnipet文件
              if (element.search(/\.s\.xml/) != -1) {
                Snippets[element] = true;
              } else { // 递归查找import的其他ts文件
                GetAllSnippet(TS_List, Snippets, element);
              }
            }
          });
        }

        return true;
      }
    });
    return Snippets;
  }

  return (tree: posthtml.Api) => {
    let TS_List = {};
    let Snippets = {};
    let rootContent = getRoot(tree)?.content ?? [];
    rootContent.filter(createNodeFilter(['scripts']))
      .flatMap((x) => x.content)
      .filter(createNodeFilter(['include']))
      .forEach((node) => {
        let src = node.attrs.src;
        if (typeof src == "string" && src.search(/.*\.(tsx|ts)/) != -1) {
          const sPath = path.resolve(_this.context, src);
          GetAllSnippet(TS_List, Snippets, sPath, true);
        }
      });

    if (Object.keys(Snippets).length <= 0) {
      return;
    }

    let _Node_Snippets: posthtml.NodeTreeElement = false;
    for (const node of rootContent) {
      if (typeof node == "object" && node.tag == "snippets") {
        _Node_Snippets = node;
      }
    }
    if (!(typeof _Node_Snippets == "object" && _Node_Snippets.tag == "snippets")) {
      _Node_Snippets = {
        tag: "snippets",
        attrs: {},
        content: []
      };
      rootContent.unshift("\n\t", _Node_Snippets);
    }

    let Node_Snippets = _Node_Snippets;
    Object.keys(Snippets).forEach((sPath) => {
      if (fs.existsSync(sPath)) {
        Node_Snippets.content.push("\n\t\t");
        const snippet = posthtml().process(fs.readFileSync(sPath, "utf-8").replace(/\n/g, "\n\t\t"), {
          closingSingleTag: 'slash',
          xmlMode: true,
          sync: true,
        }).tree;
        Node_Snippets.content.push(snippet[0]);
      };
    });
    Node_Snippets.content.push("\n\t");

    return;
  };
};