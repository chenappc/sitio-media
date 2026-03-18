const PATH_TOP = "/186299052/Vahica.com/Vahica_Single_Top";
const PATH_BOTTOM = "/186299052/Vahica.com/Vahica_Single_Bottom";
const SIZES: [[number, number], "fluid"] = [[300, 250], "fluid"];

type Googletag = {
  cmd: { push: (fn: () => void) => void };
  defineSlot: (path: string, sizes: unknown, divId: string) => { addService: (s: unknown) => unknown };
  pubads: () => { getSlots: () => { getSlotElementId: () => string }[] };
  display: (id: string) => void;
};

function getSlotId(numero: number, kind: "top" | "bottom"): string {
  if (numero <= 1) {
    return kind === "top" ? "gpt-vahica-single-top" : "gpt-vahica-single-bottom";
  }
  return kind === "top" ? `gpt-vahica-single-top-${numero}` : `gpt-vahica-single-bottom-${numero}`;
}

/** Define slots dinámicos (página 2+) si faltan y hace display en el div correspondiente. */
export function defineSlotIfNeededAndDisplay(numero: number, kind: "top" | "bottom"): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { googletag?: Googletag };
  const id = getSlotId(numero, kind);
  w.googletag?.cmd.push(function () {
    const g = w.googletag;
    if (!g) return;
    if (numero > 1) {
      const slots = g.pubads().getSlots();
      const exists = (divId: string) =>
        slots.some((s) => {
          try {
            return s.getSlotElementId() === divId;
          } catch {
            return false;
          }
        });
      if (kind === "top" && !exists(id)) {
        g.defineSlot(PATH_TOP, SIZES, id).addService(g.pubads());
      }
      if (kind === "bottom" && !exists(id)) {
        g.defineSlot(PATH_BOTTOM, SIZES, id).addService(g.pubads());
      }
    }
    g.display(id);
  });
}

export { getSlotId };
