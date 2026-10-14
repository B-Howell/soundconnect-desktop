import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardGrid, CardStack } from "../../src/components/page/CardGrid";

const cells = (container: HTMLElement) => [...container.querySelectorAll(".card-grid > *")];

describe("CardGrid", () => {
  it("drops an empty stack, so the next card takes the left column instead of being stranded on the right", () => {
    // Sound in 0.1.7: the first stack held only the (moved) equalizer, so it was empty and the cards sat on the right.
    const { container } = render(
      <CardGrid>
        <CardStack>{null}</CardStack>
        <CardStack>
          <p>Speak-to-Chat</p>
        </CardStack>
      </CardGrid>,
    );
    expect(cells(container)).toHaveLength(1);
    expect(cells(container)[0]).toHaveTextContent("Speak-to-Chat");
    // Grid cells fill left to right, so the only cell is in column 1.
    expect(cells(container)[0]).toHaveClass("card-stack");
  });

  it("treats a stack of only false, null and undefined children as empty", () => {
    const { container } = render(
      <CardGrid>
        <CardStack>
          {false}
          {undefined}
          {null}
        </CardStack>
        <CardStack>
          <p>A</p>
        </CardStack>
        <CardStack>
          <p>B</p>
        </CardStack>
      </CardGrid>,
    );
    expect(cells(container).map((cell) => cell.textContent)).toEqual(["A", "B"]);
  });

  it("keeps a full-width stack spanning both columns", () => {
    const { container } = render(
      <CardGrid>
        <CardStack span="full">
          <p>Device</p>
        </CardStack>
      </CardGrid>,
    );
    expect(cells(container)[0]).toHaveClass("card-stack--full");
  });
});
