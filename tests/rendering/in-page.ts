// Runs inside the gate page. Plain browser code, loaded by page.evaluate with the arguments it needs.
export const SETUP = `
  window.gate = (async () => {
    const engine = await import('/build/engine.mjs');
    const FONTS = ['roboto', 'ibm-plex-sans', 'pt-serif'];
    const FACES = ['regular', 'italic', 'bold', 'bold-italic'];
    const bytes = {};
    for (const id of FONTS) { bytes[id] = {}; for (const face of FACES) bytes[id][face] = new Uint8Array(await (await fetch('/fonts/' + id + '/' + face + '.ttf')).arrayBuffer()); }
    const photo = new Uint8Array(await (await fetch('/fixtures/photo.jpg')).arrayBuffer());
    const fonts = engine.createFontBook(bytes);
    const css = [];
    for (const id of FONTS) for (const face of FACES) css.push('@font-face{font-family:"doc-' + id + '-' + face + '";src:url(/fonts/' + id + '/' + face + '.ttf);font-weight:normal;font-style:normal}');
    const style = document.createElement('style'); style.textContent = css.join(''); document.head.append(style);
    const load = async () => { await Promise.all(FONTS.flatMap(id => FACES.map(face => document.fonts.load('10px "doc-' + id + '-' + face + '"', 'AаÑ')))); await document.fonts.ready; };
    await load();
    const sha = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data))).map(b => b.toString(16).padStart(2, '0')).join('');
    return { engine, fonts, photo, sha };
  })();
`;
