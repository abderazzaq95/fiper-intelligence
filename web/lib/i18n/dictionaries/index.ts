import * as common from './common';
import * as landing from './landing';
import * as auth from './auth';
import * as terminal from './terminal';

export const dictionaries = {
  en: {
    common: common.en,
    landing: landing.en,
    auth: auth.en,
    terminal: terminal.en,
  },
  ar: {
    common: common.ar,
    landing: landing.ar,
    auth: auth.ar,
    terminal: terminal.ar,
  },
};

export type Dictionary = typeof dictionaries.en;
