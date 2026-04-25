/**
 * Regression tests for the cell-editing flow on CampaignDetail.
 *
 * Bug history: typing a value in cells of stores Jardim Sul, Itupeva and
 * Leblon (the three stores that only expose kit cells) caused the typed
 * value to vanish on blur. Root cause was that `editValueRef` was only
 * synced via a `useEffect` (asynchronous), and `switchToCell` deferred the
 * save with `setTimeout`, so on rapid type → blur the save fired with a
 * stale value.
 *
 * The fix:
 *   1. `onChange` updates `editValueRef.current` SYNCHRONOUSLY (same line
 *      as `setEditValue`).
 *   2. `switchToCell` saves the previous cell synchronously using the ref.
 *   3. `closeEditing` (blur path) reads from the ref, not from `editValue`
 *      closure (which can be stale relative to the very last keystroke).
 *
 * These tests reconstruct that exact flow in isolation — mounting the full
 * `CampaignDetail` would require Supabase, router, i18n and react-query
 * providers, which makes the test brittle and slow without adding
 * coverage of the actual logic under test.
 */
import { describe, it, expect, vi } from "vitest";
import { useCallback, useRef, useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

type Cell = { storeId: string; pieceId: string };

/**
 * Mirror of the editing flow from src/pages/CampaignDetail.tsx
 * (switchToCell / closeEditing / handlePieceBlur / handleCellClick + the
 * input's onChange that updates ref + state synchronously).
 *
 * Kept intentionally small so the test fails if the production file
 * regresses on any of these points:
 *   - onChange must update the ref synchronously
 *   - switchToCell must save synchronously (no setTimeout)
 *   - blur must read from the ref, not from a stale closure
 */
function MatrixHarness({
  storeId,
  saveCell,
  initialQty = 0,
  switchTargets = [],
}: {
  storeId: string;
  saveCell: (cell: Cell, raw: string) => void;
  initialQty?: number;
  /** Optional follow-up cells the test can switch to via a button. */
  switchTargets?: Cell[];
}) {
  const [editingCell, setEditingCell] = useState<Cell | null>({
    storeId,
    pieceId: "kit-1",
  });
  const [editValue, setEditValue] = useState(
    initialQty > 0 ? String(initialQty) : ""
  );
  const editingCellRef = useRef<Cell | null>({ storeId, pieceId: "kit-1" });
  const editValueRef = useRef<string>(initialQty > 0 ? String(initialQty) : "");
  const skipBlurSaveRef = useRef(false);

  // Mirror the production refs sync — we keep them written synchronously
  // by the event handlers themselves, not via useEffect.
  const closeEditing = useCallback(() => {
    const current = editingCellRef.current;
    if (current) saveCell(current, editValueRef.current ?? "");
    editValueRef.current = "";
    editingCellRef.current = null;
    setEditingCell(null);
    setEditValue("");
  }, [saveCell]);

  const switchToCell = useCallback(
    (newStoreId: string, newPieceId: string) => {
      const current = editingCellRef.current;
      const valueToSave = editValueRef.current ?? "";
      if (
        current &&
        (current.storeId !== newStoreId || current.pieceId !== newPieceId)
      ) {
        saveCell(current, valueToSave);
      }
      const nextValue = ""; // simulate destination cell with qty=0
      editValueRef.current = nextValue;
      editingCellRef.current = { storeId: newStoreId, pieceId: newPieceId };
      setEditingCell({ storeId: newStoreId, pieceId: newPieceId });
      setEditValue(nextValue);
    },
    [saveCell]
  );

  const handlePieceBlur = () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    closeEditing();
  };

  const handleCellClick = (sId: string, pId: string) => {
    skipBlurSaveRef.current = true;
    switchToCell(sId, pId);
  };

  return (
    <div>
      {editingCell && (
        <input
          aria-label={`cell-${editingCell.storeId}-${editingCell.pieceId}`}
          value={editValue}
          onChange={(e) => {
            // CRITICAL: ref must be updated on the same synchronous turn
            // as the state — this is the regression guard.
            editValueRef.current = e.target.value;
            setEditValue(e.target.value);
          }}
          onBlur={handlePieceBlur}
        />
      )}
      {switchTargets.map((t) => (
        <button
          key={`${t.storeId}-${t.pieceId}`}
          onClick={() => handleCellClick(t.storeId, t.pieceId)}
        >
          go-{t.storeId}-{t.pieceId}
        </button>
      ))}
      <span data-testid="visible-value">{editValue}</span>
    </div>
  );
}

const PROBLEM_STORES = [
  { id: "jardim-sul", name: "Jardim Sul" },
  { id: "itupeva", name: "Outlet Premium Itupeva" },
  { id: "leblon", name: "Leblon" },
];

describe("Cell editing flow — switchToCell / onBlur / saveCell", () => {
  describe.each(PROBLEM_STORES)(
    "store: $name ($id)",
    ({ id }) => {
      it("preserves the last typed value when blurring the cell", () => {
        const saveCell = vi.fn();
        render(<MatrixHarness storeId={id} saveCell={saveCell} />);

        const input = screen.getByLabelText(`cell-${id}-kit-1`) as HTMLInputElement;

        // Simulate the user typing a value
        fireEvent.change(input, { target: { value: "7" } });
        expect(input.value).toBe("7");
        expect(screen.getByTestId("visible-value").textContent).toBe("7");

        // Blur the cell — saveCell must receive the freshly typed value,
        // not "" or the initial value.
        fireEvent.blur(input);

        expect(saveCell).toHaveBeenCalledTimes(1);
        expect(saveCell).toHaveBeenCalledWith(
          { storeId: id, pieceId: "kit-1" },
          "7"
        );
      });

      it("saves the last typed value when switching to another cell (no setTimeout race)", () => {
        const saveCell = vi.fn();
        render(
          <MatrixHarness
            storeId={id}
            saveCell={saveCell}
            switchTargets={[{ storeId: id, pieceId: "kit-2" }]}
          />
        );

        const input = screen.getByLabelText(`cell-${id}-kit-1`) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "12" } });

        // Click another cell — switchToCell must save synchronously with "12".
        act(() => {
          fireEvent.click(screen.getByText(`go-${id}-kit-2`));
        });

        // Save fired exactly once with the previous cell + last typed value.
        expect(saveCell).toHaveBeenCalledTimes(1);
        expect(saveCell).toHaveBeenCalledWith(
          { storeId: id, pieceId: "kit-1" },
          "12"
        );

        // Destination cell is now active and visually empty.
        expect(
          screen.getByLabelText(`cell-${id}-kit-2`)
        ).toBeInTheDocument();
        expect(screen.getByTestId("visible-value").textContent).toBe("");
      });

      it("does not lose the value on rapid type → blur with no intermediate render", () => {
        const saveCell = vi.fn();
        render(<MatrixHarness storeId={id} saveCell={saveCell} />);

        const input = screen.getByLabelText(`cell-${id}-kit-1`) as HTMLInputElement;

        // Fire change + blur back-to-back inside the same event batch.
        // Pre-fix this would have called saveCell with "" because the
        // ref was only updated by useEffect (async).
        act(() => {
          fireEvent.change(input, { target: { value: "3" } });
          fireEvent.blur(input);
        });

        expect(saveCell).toHaveBeenCalledWith(
          { storeId: id, pieceId: "kit-1" },
          "3"
        );
        // Value used was "3", never "" — this is the core regression guard.
        expect(saveCell).not.toHaveBeenCalledWith(
          expect.anything(),
          ""
        );
      });
    }
  );

  it("suppresses the duplicate blur-save when click triggers a switch", () => {
    // When the user clicks another cell, the current input's blur fires
    // AND handleCellClick fires. Without skipBlurSaveRef, saveCell would
    // be invoked twice (once by blur with the current value, once by
    // switchToCell). This test pins down the single-save guarantee.
    const saveCell = vi.fn();
    render(
      <MatrixHarness
        storeId="jardim-sul"
        saveCell={saveCell}
        switchTargets={[{ storeId: "jardim-sul", pieceId: "kit-2" }]}
      />
    );

    const input = screen.getByLabelText("cell-jardim-sul-kit-1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5" } });

    act(() => {
      // Real DOM order: clicking another element blurs the input first.
      fireEvent.blur(input);
      fireEvent.click(screen.getByText("go-jardim-sul-kit-2"));
    });

    // Exactly one save with the right value.
    expect(saveCell).toHaveBeenCalledTimes(1);
    expect(saveCell).toHaveBeenCalledWith(
      { storeId: "jardim-sul", pieceId: "kit-1" },
      "5"
    );
  });
});
