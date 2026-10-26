import { describe, expect, it, vi } from "vitest";
import { columnKeyboardCoordinates } from "./BoardMotion";

/* The boards' keyboard drag (BoardMotion.tsx): an arrow press moves the card
   in hand to the next COLUMN in that direction, by geometry, and parks it just
   under that column's head — where the board's rect-intersection collision
   reads it as over that column and no other. */

type Rect = { left: number; top: number; width: number; height: number; right: number; bottom: number };
const rect = (left: number, top = 100, width = 218, height = 600): Rect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

/* four columns, 12px apart, as the board lays them out */
const COLUMNS: Array<[string, Rect]> = [
  ["new", rect(0)],
  ["following_up", rect(230)],
  ["meeting_setting", rect(460)],
  ["won", rect(690)],
];

function press(code: string, cardLeft: number, disabled: string[] = []) {
  const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
  const collisionRect = rect(cardLeft + 9, 300, 200, 180);
  const context = {
    collisionRect,
    droppableRects: new Map(COLUMNS),
    droppableContainers: new Map(COLUMNS.map(([id]) => [id, { id, disabled: disabled.includes(id) }])),
  };
  const result = columnKeyboardCoordinates(event, {
    active: "card",
    currentCoordinates: { x: collisionRect.left, y: collisionRect.top },
    context: context as never,
  });
  return { result, event };
}

describe("keyboard drag — column to column", () => {
  it("Arrow Right lands centred in the next column, just under its head", () => {
    const { result, event } = press("ArrowRight", 0);
    expect(result).toEqual({ x: 230 + (218 - 200) / 2, y: 100 + 44 });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("Arrow Left goes back one column", () => {
    expect(press("ArrowLeft", 460).result).toEqual({ x: 230 + 9, y: 144 });
  });

  it("is GEOMETRIC, so it mirrors with the layout: from the leftmost column there is nowhere further left", () => {
    /* in Arabic the board flows right-to-left and the browser hands the
       sensor the mirrored rects — the getter only ever reads geometry */
    const { result } = press("ArrowLeft", 0);
    expect(result).toEqual({ x: 9, y: 300 }); // stays where it is
  });

  it("skips a disabled droppable", () => {
    expect(press("ArrowRight", 0, ["following_up"]).result).toEqual({ x: 460 + 9, y: 144 });
  });

  it("Up and Down move nothing and keep the page from scrolling under the card", () => {
    for (const code of ["ArrowUp", "ArrowDown"]) {
      const { result, event } = press(code, 230);
      expect(result).toBeUndefined();
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });

  it("any other key is not its business", () => {
    const { result, event } = press("KeyA", 230);
    expect(result).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
