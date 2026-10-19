// Las fotos de piezas se guardan como URL pública; para borrarlas hace falta la ruta dentro del bucket.
const MARCA = "/object/public/products/";

export function pathFromPublicUrl(url: string): string | null {
  const i = url.indexOf(MARCA);
  return i === -1 ? null : decodeURIComponent(url.slice(i + MARCA.length).split("?")[0]);
}

export const pathsFromUrls = (urls: (string | null | undefined)[]) =>
  urls.map((u) => (u ? pathFromPublicUrl(u) : null)).filter((p): p is string => !!p);
