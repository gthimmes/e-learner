"use client";

import { Button } from "./ui";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
