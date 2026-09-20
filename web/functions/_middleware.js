const OLD_HOST = 'adctoolbox.tokenzhang.com';
const OLD_ORIGIN = `https://${OLD_HOST}`;
const NEW_HOST = 'circuits-and-systems.tokenzhang.com';
const NEW_ORIGIN = 'https://circuits-and-systems.tokenzhang.com';

function isTutorialPath(pathname) {
  return pathname === '/'
    || pathname === '/analytics'
    || pathname === '/analytics/'
    || pathname === '/sitemap-index.xml'
    || pathname === '/sitemap-0.xml'
    || pathname.startsWith('/adc/')
    || pathname.startsWith('/pll/');
}

function isManualPath(pathname) {
  return pathname === '/doc' || pathname.startsWith('/doc/');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === OLD_HOST && isTutorialPath(url.pathname)) {
    const destination = new URL(url.pathname + url.search, NEW_ORIGIN);
    return Response.redirect(destination, 301);
  }

  if (url.hostname === NEW_HOST && isManualPath(url.pathname)) {
    const destination = new URL(url.pathname + url.search, OLD_ORIGIN);
    return Response.redirect(destination, 301);
  }

  return context.next();
}
