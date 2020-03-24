export type LogOptions = {
  debug?: boolean;
};

export type Color = "green" | "red" | "yellow" | "white";

export const log = (msg: string, color: Color, { debug }: LogOptions): void => {
  if (debug) {
    console.log(`%c${msg}`, `color:${color};font-weight:bold;`);
  }
};
