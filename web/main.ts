// Vite entry. It sits beside index.html so the dev server can reach src/ (outside Vite's root, web/) through a module import.
// The stylesheets, in the order they apply (the build inlines them into the one page):
import './css/tokens.css';
import './css/base.css';
import './css/components.css';
import './css/shell.css';
import './css/conversation.css';
import './css/screens.css';
import './css/herald.css';
import './css/opening.css';
import './css/opening-look.css';
import '../src/web';
