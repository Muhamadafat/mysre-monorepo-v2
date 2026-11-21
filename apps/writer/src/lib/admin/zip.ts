/**
 * Minimal streaming ZIP writer ("store", no compression — MP3/WAV don't
 * shrink anyway). Files are produced one at a time, so memory holds only
 * the current file. No ZIP64: fine below 4 GB per archive.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  /** Loaded lazily, right before the entry is written. Return null to skip it. */
  load: () => Promise<Uint8Array | null>;
  date?: Date;
}

/** A ReadableStream of a .zip containing `entries` in order. */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;
  let index = 0;
  let count = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (index < entries.length) {
        const entry = entries[index++];
        let data: Uint8Array | null = null;
        try {
          data = await entry.load();
        } catch {
          data = null;
        }
        if (!data) continue;

        const name = encoder.encode(entry.name);
        const crc = crc32(data);
        const { time, date } = dosDateTime(entry.date ?? new Date());

        const local = new Uint8Array(30 + name.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);
        lv.setUint16(4, 20, true); // version needed
        lv.setUint16(6, 0x0800, true); // UTF-8 names
        lv.setUint16(8, 0, true); // store
        lv.setUint16(10, time, true);
        lv.setUint16(12, date, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, data.length, true);
        lv.setUint32(22, data.length, true);
        lv.setUint16(26, name.length, true);
        local.set(name, 30);

        const header = new Uint8Array(46 + name.length);
        const cv = new DataView(header.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(8, 0x0800, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, time, true);
        cv.setUint16(14, date, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        header.set(name, 46);
        central.push(header);

        offset += local.length + data.length;
        count++;
        controller.enqueue(local);
        controller.enqueue(data);
        return; // one file per pull keeps memory flat
      }

      const size = central.reduce((sum, part) => sum + part.length, 0);
      for (const part of central) controller.enqueue(part);
      const end = new Uint8Array(22);
      const ev = new DataView(end.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(8, count, true);
      ev.setUint16(10, count, true);
      ev.setUint32(12, size, true);
      ev.setUint32(16, offset, true);
      controller.enqueue(end);
      controller.close();
    },
  });
}
