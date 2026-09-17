export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
export const lengthOf = text => [...segmenter.segment(text)].length;
const clean = text => text.normalize('NFC').replace(/\r\n?/g, '\n');
const controls = /[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;

export function validateNote(input) {
  if (!input || input.rulesAccepted !== true) throw new HttpError(400, 'Please confirm the note and doodle follow the rules.');
  if (!UUID.test(input.id || '')) throw new HttpError(400, 'Invalid submission. Please reload and try again.');
  if (typeof input.anonymous !== 'boolean') throw new HttpError(400, 'Choose a name or Anonymous.');
  let name = input.anonymous ? 'Anonymous' : typeof input.name === 'string' ? clean(input.name).trim() : '';
  if (!name || lengthOf(name) > 32 || name.length > 128 || controls.test(name) || /\n/.test(name)) {
    throw new HttpError(400, 'Please use a name between 1 and 32 characters.');
  }
  if (!Array.isArray(input.content) || input.content.length > 80) throw new HttpError(400, 'Invalid note formatting.');
  const content = [];
  for (const part of input.content) {
    if (!part || typeof part.text !== 'string' || part.text.length > 2000 || controls.test(part.text)) throw new HttpError(400, 'Invalid note text.');
    const next = { text: clean(part.text), bold: part.bold === true, italic: part.italic === true, underline: part.underline === true };
    if (!next.text) continue;
    const last = content.at(-1);
    if (last && ['bold', 'italic', 'underline'].every(k => last[k] === next[k])) last.text += next.text;
    else content.push(next);
  }
  const text = content.map(p => p.text).join('');
  if (!text.trim() || lengthOf(text) > 250 || text.length > 2000) throw new HttpError(400, 'Write a note between 1 and 250 characters.');
  if (!['yellow', 'pink', 'blue', 'green'].includes(input.colour)) throw new HttpError(400, 'Please select a note colour.');
  return { id: input.id.toLowerCase(), name, anonymous: input.anonymous, content, colour: input.colour };
}

export async function readLimited(stream, limit) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'This submission is too large. Try a simpler doodle.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = table[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Only bounded, non-animated canvas PNGs. The same bytes are reviewed in Discord
// and shown publicly, preventing a different public drawing after moderation.
export async function validateDoodle(value) {
  if (value == null || value === '') return null;
  const fail = () => { throw new HttpError(400, 'The doodle could not be read. Clear it and draw again.'); };
  if (typeof value !== 'string' || value.length > 180000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return fail();
  let bytes;
  try { bytes = Uint8Array.from(atob(value.slice(22)), c => c.charCodeAt(0)); } catch { return fail(); }
  if (bytes.length < 45 || bytes.length > 128000 || [137,80,78,71,13,10,26,10].some((v, i) => bytes[i] !== v)) return fail();
  const view = new DataView(bytes.buffer); const decoder = new TextDecoder();
  let offset = 8, width, height, colourType, bitsPerPixel, paletteEntries = 0, sawData = false, endedData = false, ended = false;
  const chunks = [];
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset); const end = offset + 12 + size;
    if (end > bytes.length) return fail();
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) return fail();
    if (type === 'IHDR') {
      if (offset !== 8 || size !== 13) return fail();
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      const bitDepth = bytes[offset + 16]; colourType = bytes[offset + 17];
      // WebKit can palette-encode a canvas PNG on iPad. It is still a normal,
      // non-animated PNG, so accept it as well as the RGB/RGBA output from other browsers.
      const componentCount = colourType === 6 ? 4 : colourType === 2 ? 3 : colourType === 4 ? 2 : colourType === 0 ? 1 : colourType === 3 ? 1 : 0;
      const validDepth = colourType === 3 ? [1, 2, 4, 8].includes(bitDepth) : bitDepth === 8;
      bitsPerPixel = componentCount * bitDepth;
      if (width !== 480 || height !== 240 || !componentCount || !validDepth || bytes[offset + 18] || bytes[offset + 19] || bytes[offset + 20]) return fail();
    } else if (!width) return fail();
    else if (type === 'PLTE') {
      if (sawData || size < 3 || size > 768 || size % 3 || paletteEntries) return fail();
      paletteEntries = size / 3;
    } else if (type === 'tRNS') {
      if (sawData || !paletteEntries || size > paletteEntries) return fail();
    }
    else if (type === 'IDAT') {
      if (endedData) return fail();
      sawData = true; chunks.push(bytes.slice(offset + 8, end - 4));
    } else if (type === 'IEND') {
      if (size || !sawData || end !== bytes.length) return fail();
      ended = true; break;
    } else {
      // Browsers may include these colour metadata chunks; arbitrary payloads,
      // external references, APNG animation, and uploaded SVGs are not accepted.
      if (!['sRGB', 'gAMA', 'cHRM', 'pHYs', 'tIME'].includes(type) || size > 32) return fail();
      if (sawData) endedData = true;
    }
    offset = end;
  }
  if (!ended) return fail();
  if ((colourType === 3 && !paletteEntries) || (bitsPerPixel < 8 && !paletteEntries)) return fail();
  const rowSize = 1 + Math.ceil(width * bitsPerPixel / 8);
  const expected = height * rowSize;
  try {
    const raw = await readLimited(new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate')), expected);
    if (raw.length !== expected) return fail();
    for (let row = 0; row < height; row++) if (raw[row * rowSize] > 4) return fail();
  } catch { return fail(); }
  return bytes;
}

export function discordText(parts) {
  return parts.map(part => {
    let text = part.text.replace(/([\\`*_{}\[\]()<>#+\-.!|~])/g, '\\$1');
    if (part.underline) text = '__' + text + '__';
    if (part.italic) text = '*' + text + '*';
    if (part.bold) text = '**' + text + '**';
    return text;
  }).join('');
}
