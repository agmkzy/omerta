// Fixtures for the hierarchy checks (from the V72 suite).
import { World } from '../../types';
import { members } from '../../career';

export const fam = (w: World, fid: string) => members(w, fid);
