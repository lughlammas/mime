import type { Line, MapIndex } from './types.ts';

export async function listMaps(): Promise<MapIndex['maps']> {
  const res = await fetch('/maps/index.json');
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  const data = (await res.json()) as MapIndex;
  return data.maps;
}

export async function getMap(path: string): Promise<Line> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as Line;
}
