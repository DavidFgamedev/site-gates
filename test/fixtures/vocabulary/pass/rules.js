/* sweep:allow-start -- a rule must name the words it forbids. */
export const FORBIDDEN = ["projectbluebird", "lorem ipsum"];
/* sweep:allow-end */
export const check = (s) => FORBIDDEN.some((f) => s.includes(f));
