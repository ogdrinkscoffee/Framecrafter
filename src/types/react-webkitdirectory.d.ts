import 'react';

/**
 * Non-standard but widely supported directory-picker attributes. React's
 * built-in InputHTMLAttributes omits them, which produced two standing
 * `webkitdirectory does not exist` errors at StartHub/TopToolbar.
 */
declare module 'react' {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
