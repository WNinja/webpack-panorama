export default async function tsCssLoader(source: string) {
    if (source.search(/import.*.less.*;/) != -1) {
        source = source.replace(/import.*.(less|sass|scss|css).*;/g, "");
    }
    return source.replace(/import.*\.s\.xml.*;/g, "");
}
exports.default = tsCssLoader;