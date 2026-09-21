export type Side = 'white' | 'black';

export type Phase = 'SHOW' | 'MIME' | 'FAIL' | 'COMPLETE';

export interface Line {
  id: string;
  name: string;
  epithet: string;
  side_to_learn: Side;
  start_fen: string;
  moves_uci: string[];
  length: number;
  tags: string[];
  difficulty: number;
  thesis: string;
  validated_at: string;
}

export interface MapIndexEntry {
  id: string;
  name: string;
  path: string;
  side_to_learn: Side;
  length: number;
}

export interface MapIndex {
  maps: MapIndexEntry[];
}

export interface UciParts {
  from: string;
  to: string;
  promotion?: string;
}

export interface MimeSnapshot {
  phase: Phase;
  cursorPly: number;
  fen: string;
  lastMove: [string, string] | null;
  mistakes: number;
  expectedUci: string | null;
  flash: boolean;
}
