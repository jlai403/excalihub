import { customAlphabet } from 'nanoid';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const spaceId = customAlphabet(ALPHABET, 10);
export const backupId = customAlphabet(ALPHABET, 8);
