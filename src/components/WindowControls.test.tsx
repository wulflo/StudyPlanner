import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const windowApi = vi.hoisted(() => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onResized: vi.fn().mockResolvedValue(() => undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowApi,
}));

vi.mock("../lib/ipc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ipc")>()),
  runningInTauri: true,
}));

import { WindowControls } from "./WindowControls";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WindowControls", () => {
  it("llama a los comandos de ventana de Tauri desde la barra de título", async () => {
    const user = userEvent.setup();
    render(<WindowControls />);

    const toolbar = await screen.findByRole("toolbar");
    const [minimize, maximize, close] = within(toolbar).getAllByRole("button");

    await user.click(minimize);
    expect(windowApi.minimize).toHaveBeenCalledTimes(1);

    await user.click(maximize);
    expect(windowApi.toggleMaximize).toHaveBeenCalledTimes(1);

    await user.click(close);
    expect(windowApi.close).toHaveBeenCalledTimes(1);

    expect(windowApi.isMaximized).toHaveBeenCalled();
    expect(windowApi.onResized).toHaveBeenCalled();
  });
});
