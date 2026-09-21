import './style.css';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { mountApp } from './mime/ui.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');
mountApp(app);
