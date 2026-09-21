import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import type { Side } from './types.ts';

export type UserMoveHandler = (
  from: string,
  to: string,
  promotion?: string,
) => void;

export interface BoardHandle {
  setPosition(opts: {
    fen: string;
    lastMove: [string, string] | null;
    orientation: Side;
    interactive: boolean;
    /** Learner color when interactive; dests = all legal for that side. */
    turnColor: Side | null;
  }): void;
  destroy(): void;
}

function legalDests(fen: string): Map<Key, Key[]> {
  const chess = new Chess(fen);
  const dests = new Map<Key, Key[]>();
  for (const m of chess.moves({ verbose: true })) {
    const from = m.from as Key;
    const list = dests.get(from) ?? [];
    list.push(m.to as Key);
    dests.set(from, list);
  }
  return dests;
}

export function mountBoard(
  el: HTMLElement,
  onUserMove: UserMoveHandler,
): BoardHandle {
  const ground: Api = Chessground(el, {
    fen: 'start',
    orientation: 'white',
    coordinates: true,
    viewOnly: true,
    draggable: { enabled: false },
    selectable: { enabled: false },
    movable: {
      free: false,
      color: undefined,
      showDests: true,
      events: {
        after: (orig, dest) => {
          // Promotion: default to queen if pawn reaches back rank.
          // Loop validates via chess.js against expected UCI (incl. promo).
          const rank = dest[1];
          const piece = ground.state.pieces.get(dest);
          let promotion: string | undefined;
          if (piece?.role === 'pawn' && (rank === '8' || rank === '1')) {
            promotion = 'q';
          }
          onUserMove(orig, dest, promotion);
        },
      },
    },
    animation: { enabled: true, duration: 220 },
  });

  return {
    setPosition({ fen, lastMove, orientation, interactive, turnColor }) {
      const color =
        interactive && turnColor
          ? turnColor === 'white'
            ? 'white'
            : 'black'
          : undefined;

      ground.set({
        fen,
        orientation,
        lastMove: lastMove ? ([lastMove[0], lastMove[1]] as Key[]) : undefined,
        turnColor: fen.includes(' w ') ? 'white' : 'black',
        viewOnly: !interactive,
        draggable: { enabled: !!interactive },
        selectable: { enabled: !!interactive },
        movable: {
          free: false,
          color,
          dests: interactive ? legalDests(fen) : new Map(),
          showDests: !!interactive,
        },
      });
    },
    destroy() {
      ground.destroy();
    },
  };
}
