"use client";

import { useId, useState, type KeyboardEvent } from "react";

export interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({
  items,
  defaultValue,
}: {
  items: TabItem[];
  defaultValue?: string;
}) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value ?? "");
  const id = useId();
  const current = items.find((item) => item.value === active);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = items[nextIndex];
    if (!next) return;
    setActive(next.value);
    document.getElementById(`${id}-tab-${next.value}`)?.focus();
  }

  return (
    <div>
      <div className="tabs__list" role="tablist">
        {items.map((item, index) => (
          <button
            key={item.value}
            id={`${id}-tab-${item.value}`}
            className="tabs__trigger"
            type="button"
            role="tab"
            aria-selected={item.value === active}
            aria-controls={`${id}-panel`}
            onClick={() => setActive(item.value)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {current ? (
        <div
          id={`${id}-panel`}
          className="tabs__panel"
          role="tabpanel"
          aria-labelledby={`${id}-tab-${active}`}
          tabIndex={0}
        >
          {current.content}
        </div>
      ) : null}
    </div>
  );
}
